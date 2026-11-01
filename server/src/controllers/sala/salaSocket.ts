import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import type { SalaLlegada } from '../../models/sala/Participantes';
import type { SalaService } from '../../services/sala/SalaService';
import { ConversacionError, type ConversacionService } from '../../services/conversaciones/ConversacionService';
import type { PaseVideo } from '../../services/videollamada/VideollamadaService';
import { mensajeChatDto } from '../../views/VistaChat';
import { ResultadoAccion } from '../../views/dto/sala';
import { usuarioDelToken } from '../middlewares/auth';
import { DifusorSocketIo } from './DifusorSocketIo';

/** Bajo /api para que pase por el mismo proxy que el resto de la API. */
export const SALA_SOCKET_PATH = '/api/socket.io';

interface DatosSocket {
  llegada: SalaLlegada;
  clienteId: string | null;
}

/** Contesta por el ack del evento, si el cliente lo ha pedido. */
const contestar =
  <R>(ack: unknown) =>
  (respuesta: R) =>
    typeof ack === 'function' && ack(respuesta);

/**
 * La sala de juego por WebSocket: lee cada evento, se lo pasa a la sala
 * (SalaService) y contesta por su ack; lo que cambia le llega a cada uno por el
 * difusor (DifusorSocketIo). Al conectarse, el cliente manda su token de la web o,
 * sin cuenta, el nombre con el que entra; el nombre y el avatar que prefiere
 * mostrar, si los cambió; y su id de cliente para recuperar el sitio si se reconecta.
 */
export function iniciarSalaSocket(httpServer: HttpServer, sala: SalaService): void {
  const io = new Server(httpServer, {
    path: SALA_SOCKET_PATH,
    cors: { origin: '*' },
    // Un fondo de la sala subido desde el ordenador (data URL) puede pasar de 1 MB
    maxHttpBufferSize: 8 * 1024 * 1024,
  });
  sala.difundirCon(new DifusorSocketIo(io, sala));

  io.use(async (socket, next) => {
    const { token, nombre, alias, avatar, clienteId } = socket.handshake.auth ?? {};
    let usuario = null;
    if (typeof token === 'string' && token) {
      usuario = usuarioDelToken(token);
      // El cliente reconoce este mensaje y da la sesión por cerrada.
      if (!usuario) return next(new Error('SESION_CADUCADA'));
    }
    const cliente = typeof clienteId === 'string' && clienteId ? clienteId.slice(0, 64) : null;
    const llegada = await sala.llegada({ usuario, nombre, alias, avatar, clienteId: cliente });
    if ('error' in llegada) return next(new Error(llegada.error));
    // Aquí solo se identifica: se entra en la sala al completarse la conexión.
    // Si se entrase ya y la conexión se cortara ahora (StrictMode, recarga rápida),
    // nunca llegaría su 'disconnect' y quedaría un participante fantasma.
    const datos: DatosSocket = { llegada, clienteId: cliente };
    Object.assign(socket.data, datos);
    next();
  });

  io.on('connection', (socket) => {
    const { llegada, clienteId } = socket.data as DatosSocket;
    socket.emit('sala:guion', sala.guion());
    const clave = sala.conectar(socket.id, clienteId, llegada);
    const yo = () => sala.participanteDe(clave);
    const miHistorial = () => {
      const p = yo();
      if (p) socket.emit('chat:historial', sala.historial(p).map(mensajeChatDto));
    };
    miHistorial();

    // Mensajes de texto: { para: 'general' | 'visitantes' | id de participante, texto }.
    socket.on('chat:enviar', (peticion: { para?: unknown; texto?: unknown } | null, ack?: unknown) => {
      const responder = contestar<ResultadoAccion>(ack);
      const p = yo();
      if (!p || typeof peticion?.para !== 'string' || typeof peticion.texto !== 'string') {
        responder({ ok: false, error: 'Mensaje desconocido.' });
        return;
      }
      sala.enviarMensaje(p.id, peticion.para, peticion.texto, responder);
    });
    // Al cambiar de papel cambia lo que se puede leer: el cliente pide su historial.
    socket.on('chat:historial', miHistorial);

    // Videollamada: el pase para la plaza («principal») o para su conversación privada.
    socket.on('video:pase', async (peticion: { sala?: unknown } | null, ack?: unknown) => {
      const responder = contestar<ResultadoAccion & Partial<PaseVideo>>(ack);
      const p = yo();
      if (!p || typeof peticion?.sala !== 'string') return responder({ ok: false, error: 'Petición desconocida.' });
      responder(await sala.pase(p.id, peticion.sala));
    });

    // Conversaciones privadas: invitar, responder a una invitación, retirarla,
    // escuchar una (visitantes) y salir. Cada una responde por ack.
    const texto = (v: unknown) => {
      if (typeof v !== 'string') throw new ConversacionError('Petición desconocida.');
      return v;
    };
    const conversacion: Record<string, (c: ConversacionService, yoId: string, d: Record<string, unknown>) => void> = {
      'conversacion:invitar': (c, yoId, d) => void c.invitar(yoId, texto(d.con)),
      'conversacion:pedirUnirse': (c, yoId, d) => void c.pedirUnirse(yoId, texto(d.con)),
      'conversacion:responder': (c, yoId, d) => c.responder(yoId, texto(d.invitacion), d.aceptar === true),
      'conversacion:cancelar': (c, yoId, d) => c.cancelar(yoId, texto(d.invitacion)),
      'conversacion:entrar': (c, yoId, d) => c.entrar(yoId, texto(d.conversacion)),
      'conversacion:escuchar': (c, yoId, d) => c.escuchar(yoId, texto(d.conversacion)),
      'conversacion:salir': (c, yoId) => c.salir(yoId),
    };
    for (const [evento, hacer] of Object.entries(conversacion)) {
      socket.on(evento, (datos: Record<string, unknown> | null, ack?: unknown) => {
        const responder = contestar<ResultadoAccion>(ack);
        const p = yo();
        if (!p) return responder({ ok: false, error: 'Ya no estás en la sala.' });
        sala.conversar((c) => hacer(c, p.id, datos ?? {}), responder);
      });
    }

    // Una sola puerta para todas las acciones: { accion, datos } y respuesta por ack.
    socket.on('sala:accion', async (peticion: { accion?: unknown; datos?: unknown } | null, ack?: unknown) => {
      const nombre = typeof peticion?.accion === 'string' ? peticion.accion : '';
      await sala.accion(yo(), nombre, peticion?.datos, contestar<ResultadoAccion>(ack));
    });

    // Si el cliente cierra a propósito («Salir»), se va ya. Si no, se le guarda el sitio.
    socket.on('disconnect', (reason) => sala.desconectar(clave, socket.id, reason === 'client namespace disconnect'));
  });
}
