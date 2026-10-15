import type { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { limpiarAvatarSala, limpiarNombreSala, SALA_AVATAR_INVITADO, SalaLlegada, SalaService } from '../services/SalaService';
import { SalaAsiento, SalaEstado } from '../types/sala';
import { ChatError, ChatService } from '../services/chat/ChatService';
import { ConversacionError, ConversacionService } from '../services/conversaciones/ConversacionService';
import { PaseVideo, VideollamadaError, VideollamadaService } from '../services/videollamada/VideollamadaService';
import { accionesPermitidas, DependenciasSala, ejecutarAccion, SalaResultado } from './salaAcciones';

/** Bajo /api para que pase por el mismo proxy que el resto de la API. */
export const SALA_SOCKET_PATH = '/api/socket.io';

interface DatosSocket {
  llegada: SalaLlegada;
  clienteId: string | null;
}

/** Busca el avatar de un usuario de la web; null si no tiene o no se encuentra. */
export type BuscarAvatar = (userId: string) => Promise<string | null>;

function usuarioDelToken(token: string): { id: string; username: string } | null {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    if (typeof payload === 'object' && typeof payload.username === 'string' && typeof payload.id === 'string') {
      return { id: payload.id, username: payload.username };
    }
  } catch {
    // Token caducado o falso.
  }
  return null;
}

/**
 * Sala de juego en tiempo real. Al conectarse, el cliente manda su token de la
 * web o, sin cuenta, el nombre con el que entra; el nombre y el avatar que
 * prefiere mostrar, si los cambió; y su id de cliente para recuperar el sitio si se reconecta. Cada cambio se manda entero a todos.
 */
/** Una ficha sin su personaje ni su alineamiento: así la ven quienes no son su jugador ni narran. */
const sinPersonaje = (a: SalaAsiento): SalaAsiento => ({ ...a, personaje: null, alineamiento: null });

export function iniciarSalaSocket(httpServer: HttpServer, buscarAvatar: BuscarAvatar, deps: DependenciasSala): void {
  const io = new Server(httpServer, {
    path: SALA_SOCKET_PATH,
    cors: { origin: '*' },
    // Un fondo de la sala subido desde el ordenador (data URL) puede pasar de 1 MB
    maxHttpBufferSize: 8 * 1024 * 1024,
  });
  const sala = new SalaService();
  const chat = new ChatService(deps.mensajes, sala);
  const conversaciones = new ConversacionService(sala);
  // Sin servidor de vídeo configurado, la sala funciona igual, sin cámaras ni micrófonos
  const videollamada = deps.video ? new VideollamadaService(deps.video, sala, conversaciones) : null;

  // El guion (resuelto, con todos sus personajes) no va en cada estado: se manda
  // aparte, solo cuando cambia y a quien entra.
  let versionGuionMandada = sala.versionGuion();
  const mandarGuionSiCambia = () => {
    if (sala.versionGuion() === versionGuionMandada) return;
    versionGuionMandada = sala.versionGuion();
    io.emit('sala:guion', sala.guion());
  };

  const difundir = () => {
    // Las conversaciones y el servidor de vídeo, al día con la sala (papeles, fase, quién está)
    conversaciones.depurar();
    videollamada?.sincronizar();
    const listaConversaciones = conversaciones.lista();
    const participantes = sala.participantes();
    const asientos = sala.asientos();
    const configuracion = sala.configuracion();
    const nominacion = sala.nominacion();
    const votaciones = sala.votaciones();
    const distribucion = sala.distribucion();
    const revelacion = sala.revelacion();
    // Las fichas ya reveladas al final de la partida: todos ven su personaje
    const reveladas = new Set(revelacion?.reveladas ?? []);
    const bolsa = sala.bolsa();
    const ahora = Date.now();
    for (const { socketId, clave, id } of sala.conexiones()) {
      const yo = sala.participanteDe(clave)!;
      const estado: SalaEstado = {
        participantes,
        asientos:
          yo.rol === 'narrador' || (yo.rol === 'visitante' && yo.accesoGrimorio === 'concedido')
            ? asientos
            : asientos.map((a) => (a.ocupante === yo.id || reveladas.has(a.id) ? a : sinPersonaje(a))),
        configuracion,
        nominacion,
        fase: sala.fase(),
        distribucion,
        revelacion,
        video: !!videollamada,
        // Los jugadores no saben qué visitantes escuchan las conversaciones
        conversaciones:
          yo.rol === 'jugador' ? listaConversaciones.map((c) => ({ ...c, oyentes: [] })) : listaConversaciones,
        invitaciones: conversaciones.invitacionesDe(id),
        // La bolsa es solo para los narradores (son los personajes de la partida)
        bolsa: yo.rol === 'narrador' ? bolsa : [],
        ahora,
        // El registro de votaciones es solo para los narradores.
        votaciones: yo.rol === 'narrador' ? votaciones : [],
        yo: id,
        acciones: accionesPermitidas(sala, yo),
      };
      io.to(socketId).emit('sala:estado', estado);
    }
  };

  const conexionViva = (socketId: string) => io.sockets.sockets.has(socketId);

  // La votación avanza sola con el tiempo: cada paso se manda a todos.
  sala.alCambiarSola = difundir;

  io.use(async (socket, next) => {
    const { token, nombre, alias, avatar, clienteId } = socket.handshake.auth ?? {};
    let llegada: SalaLlegada;
    if (typeof token === 'string' && token) {
      const usuario = usuarioDelToken(token);
      // El cliente reconoce este mensaje y da la sesión por cerrada.
      if (!usuario) return next(new Error('SESION_CADUCADA'));
      llegada = {
        identidad: `u:${usuario.id}`,
        nombreBase: usuario.username,
        alias: limpiarNombreSala(alias),
        conCuenta: true,
        avatarPorDefecto: await buscarAvatar(usuario.id).catch(() => null),
        avatarElegido: limpiarAvatarSala(avatar),
      };
    } else {
      const nombreBase = limpiarNombreSala(nombre);
      if (!nombreBase) return next(new Error('SIN_NOMBRE'));
      llegada = {
        identidad: 'invitado',
        nombreBase,
        alias: limpiarNombreSala(alias),
        conCuenta: false,
        avatarPorDefecto: SALA_AVATAR_INVITADO,
        avatarElegido: limpiarAvatarSala(avatar),
      };
      // Un invitado no puede entrar con un nombre que ya usa otro: el cliente lo
      // devuelve a la pantalla de entrada para que elija otro.
      const nombreFinal = llegada.alias || llegada.nombreBase;
      const cliente = typeof clienteId === 'string' && clienteId ? clienteId.slice(0, 64) : null;
      if (!sala.nombreLibreParaInvitado(nombreFinal, cliente, conexionViva)) return next(new Error('NOMBRE_OCUPADO'));
    }
    // Aquí solo se identifica: se entra en la sala al completarse la conexión.
    // Si se entrase ya y la conexión se cortara ahora (StrictMode, recarga rápida),
    // nunca llegaría su 'disconnect' y quedaría un participante fantasma.
    const datos: DatosSocket = {
      llegada,
      clienteId: typeof clienteId === 'string' && clienteId ? clienteId.slice(0, 64) : null,
    };
    Object.assign(socket.data, datos);
    next();
  });

  io.on('connection', (socket) => {
    const { llegada, clienteId } = socket.data as DatosSocket;
    const { clave, expulsar } = sala.conectar(socket.id, clienteId, llegada, conexionViva);
    socket.emit('sala:guion', sala.guion());
    // Su cuenta ya estaba en la sala desde otra conexión: esa se cierra. El aviso
    // llega antes que el cierre, y el cliente no intenta reconectar.
    if (expulsar) {
      io.to(expulsar).emit('sala:expulsado', { motivo: 'otraConexion' });
      io.sockets.sockets.get(expulsar)?.disconnect(true);
    }
    difundir();
    const yo = () => sala.participanteDe(clave);
    const miHistorial = () => {
      const p = yo();
      if (p) socket.emit('chat:historial', chat.historial(p));
    };
    miHistorial();

    // Mensajes de texto: { para: 'general' | 'visitantes' | id de participante, texto }.
    // Le llega a quien puede leerlo; si es un susurro entre jugadores, las ondas a todos.
    socket.on('chat:enviar', (peticion: { para?: unknown; texto?: unknown } | null, ack?: (r: SalaResultado) => void) => {
      const responder = (r: SalaResultado) => typeof ack === 'function' && ack(r);
      const p = yo();
      if (!p || typeof peticion?.para !== 'string' || typeof peticion.texto !== 'string') {
        responder({ ok: false, error: 'Mensaje desconocido.' });
        return;
      }
      try {
        const { mensaje, lectores, susurro } = chat.enviar(p.id, peticion.para, peticion.texto);
        responder({ ok: true });
        for (const { socketId, id } of sala.conexiones()) {
          if (lectores.includes(id)) io.to(socketId).emit('chat:mensaje', mensaje);
        }
        if (susurro) io.emit('sala:susurro', susurro);
      } catch (e) {
        responder({ ok: false, error: e instanceof ChatError ? e.message : 'No se ha podido mandar el mensaje.' });
      }
    });
    // Al cambiar de papel cambia lo que se puede leer: el cliente pide su historial.
    socket.on('chat:historial', miHistorial);

    // Videollamada: el pase para la mesa («principal») o para su conversación privada.
    socket.on('video:pase', async (peticion: { sala?: unknown } | null, ack?: (r: SalaResultado & Partial<PaseVideo>) => void) => {
      const responder = (r: SalaResultado & Partial<PaseVideo>) => typeof ack === 'function' && ack(r);
      const p = yo();
      if (!videollamada) return responder({ ok: false, error: 'Esta sala no tiene videollamada.' });
      if (!p || typeof peticion?.sala !== 'string') return responder({ ok: false, error: 'Petición desconocida.' });
      try {
        responder({ ok: true, ...(await videollamada.pase(p.id, peticion.sala)) });
      } catch (e) {
        responder({ ok: false, error: e instanceof VideollamadaError ? e.message : 'No se ha podido conectar con el vídeo.' });
      }
    });

    // Conversaciones privadas: invitar, responder a una invitación, retirarla,
    // escuchar una (visitantes) y salir. Cada una responde por ack y difunde la sala.
    const enConversaciones = (
      evento: string,
      hacer: (yoId: string, datos: Record<string, unknown>) => void,
    ) =>
      socket.on(evento, (datos: Record<string, unknown> | null, ack?: (r: SalaResultado) => void) => {
        const responder = (r: SalaResultado) => typeof ack === 'function' && ack(r);
        const p = yo();
        if (!p) return responder({ ok: false, error: 'Ya no estás en la sala.' });
        try {
          hacer(p.id, datos ?? {});
          responder({ ok: true });
          difundir();
        } catch (e) {
          responder({ ok: false, error: e instanceof ConversacionError ? e.message : 'No se ha podido hacer.' });
        }
      });
    const texto = (v: unknown) => {
      if (typeof v !== 'string') throw new ConversacionError('Petición desconocida.');
      return v;
    };
    enConversaciones('conversacion:invitar', (yoId, d) => void conversaciones.invitar(yoId, texto(d.con)));
    enConversaciones('conversacion:responder', (yoId, d) => conversaciones.responder(yoId, texto(d.invitacion), d.aceptar === true));
    enConversaciones('conversacion:cancelar', (yoId, d) => conversaciones.cancelar(yoId, texto(d.invitacion)));
    enConversaciones('conversacion:escuchar', (yoId, d) => conversaciones.escuchar(yoId, texto(d.conversacion)));
    enConversaciones('conversacion:salir', (yoId) => conversaciones.salir(yoId));

    // Una sola puerta para todas las acciones: { accion, datos } y respuesta por ack.
    socket.on('sala:accion', async (peticion: { accion?: unknown; datos?: unknown } | null, ack?: (r: SalaResultado) => void) => {
      const nombre = typeof peticion?.accion === 'string' ? peticion.accion : '';
      const { expulsar: expulsados = [], ...resultado } = await ejecutarAccion(
        sala,
        sala.participanteDe(clave),
        nombre,
        peticion?.datos,
        deps,
      );
      if (typeof ack === 'function') ack(resultado);
      // Expulsados por un narrador: se les avisa y se cierra su conexión (sin reintento).
      for (const socketId of expulsados) {
        io.to(socketId).emit('sala:expulsado', { motivo: 'narrador' });
        io.sockets.sockets.get(socketId)?.disconnect(true);
      }
      if (resultado.ok) {
        mandarGuionSiCambia();
        difundir();
      }
    });

    socket.on('disconnect', (reason) => {
      // El cliente cerró a propósito («Salir»): se va ya. Si no, se le guarda el sitio.
      if (reason === 'client namespace disconnect') {
        sala.salir(clave, socket.id);
      } else {
        sala.desconectar(clave, socket.id, difundir);
      }
      difundir();
    });
  });
}
