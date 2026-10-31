import type { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { SalaDeJuego } from '../../services/SalaDeJuego';
import { limpiarAvatarSala, limpiarNombreSala, SALA_AVATAR_INVITADO, SalaLlegada } from '../../services/sala/Participantes';
import { VistaPartida } from '../../views/VistaPartida';
import { EstadisticasPartida } from '../../services/estadisticas/EstadisticasPartida';
import { ResultadoAccion } from '../../contrato/sala';
import { ChatError, ChatService } from '../../services/chat/ChatService';
import { ConversacionError, ConversacionService } from '../../services/conversaciones/ConversacionService';
import { PaseVideo, VideollamadaError, VideollamadaService } from '../../services/videollamada/VideollamadaService';
import { accionesPermitidas, DependenciasSala, ejecutarAccion } from './salaAcciones';
import { NarradorVirtualService } from '../../services/narradorVirtual/NarradorVirtualService';
import { temporizadorReal, type Narrador } from '../../services/narradorVirtual/puertos';

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
export function iniciarSalaSocket(httpServer: HttpServer, buscarAvatar: BuscarAvatar, deps: DependenciasSala): void {
  const io = new Server(httpServer, {
    path: SALA_SOCKET_PATH,
    cors: { origin: '*' },
    // Un fondo de la sala subido desde el ordenador (data URL) puede pasar de 1 MB
    maxHttpBufferSize: 8 * 1024 * 1024,
  });
  const juego = new SalaDeJuego();
  const { sala, partida } = juego;
  // Las estadísticas escuchan la partida y, al revelar el grimorio, la guardan
  if (deps.guardarPartida) {
    const guardar = deps.guardarPartida;
    const estadisticas = new EstadisticasPartida((registro) => {
      guardar(registro)
        .then(async () => {
          // Con una partida más, quien deja de ser novato pierde el pulpito
          if (!deps.contarPartidas) return;
          for (const { userId } of registro.jugadores) sala.participantes.cambiarPartidasJugadas(userId, await deps.contarPartidas(userId));
          difundir();
        })
        .catch((err) => console.error('[SALA] No se ha podido guardar la partida:', err));
    });
    partida.suscribir((evento) => estadisticas.registrar(evento));
  }
  const chat = new ChatService(deps.mensajes, juego);
  const conversaciones = new ConversacionService(juego);
  // Sin servidor de vídeo configurado, la sala funciona igual, sin cámaras ni micrófonos
  const videollamada = deps.video ? new VideollamadaService(deps.video, juego, conversaciones) : null;

  // El guion (resuelto, con todos sus personajes) no va en cada estado: se manda
  // aparte, solo cuando cambia y a quien entra.
  let versionGuionMandada = partida.guion.version();
  const mandarGuionSiCambia = () => {
    if (partida.guion.version() === versionGuionMandada) return;
    versionGuionMandada = partida.guion.version();
    io.emit('sala:guion', partida.guion.actual());
  };

  const difundir = () => {
    // Las conversaciones y el servidor de vídeo, al día con la sala (papeles, fase, quién está)
    conversaciones.depurar();
    videollamada?.sincronizar();
    // Cada uno, lo que le toca ver de la partida
    const vista = new VistaPartida(juego, {
      conversaciones: conversaciones.lista(),
      invitacionesDe: (id) => conversaciones.invitacionesDe(id),
      video: !!videollamada,
      accionesDe: (yo) => accionesPermitidas(juego, yo),
    });
    for (const { socketId, clave } of sala.participantes.conexiones()) {
      io.to(socketId).emit('sala:estado', vista.para(sala.participantes.participanteDe(clave)!));
    }
    // El narrador virtual mira si, con la sala así, le toca hacer algo
    narradorVirtual.alCambiarSala();
  };

  // El narrador virtual actúa como un narrador más: con las mismas acciones, y la sala se difunde
  const plazaVirtual = (participanteId: string): Narrador => ({
    accion: async (nombre, datos) => {
      const { expulsar: _expulsar, ...resultado } = await ejecutarAccion(juego, sala.participantes.buscar(participanteId), nombre, datos, depsSala);
      if (resultado.ok) {
        mandarGuionSiCambia();
        difundir();
      }
      return resultado;
    },
  });
  const narradorVirtual = new NarradorVirtualService(
    juego,
    plazaVirtual,
    {
      decir: (texto) => {
        io.emit('sala:voz', { texto });
        difundir();
      },
    },
    deps.relojNarradorVirtual ?? temporizadorReal,
    () => difundir(),
    deps.azarNarradorVirtual,
    // Jarvis: con el modelo de la cuenta de quien lo añade
    deps.modeloJarvisDe && deps.clienteJev
      ? {
          modeloDe: async (participanteId) => {
            const cuenta = sala.participantes.cuentaDe(participanteId);
            return cuenta ? deps.modeloJarvisDe!(cuenta) : 'sinCuenta';
          },
          cliente: deps.clienteJev,
        }
      : null,
    // Las bolsas recientes, de la cuenta de quien lo añade
    deps.bolsasRecientes
      ? {
          de: async (participanteId) => {
            const cuenta = sala.participantes.cuentaDe(participanteId);
            return cuenta ? deps.bolsasRecientes!.de(cuenta) : [];
          },
          apuntar: async (participanteId, personajes) => {
            const cuenta = sala.participantes.cuentaDe(participanteId);
            if (cuenta) await deps.bolsasRecientes!.apuntar(cuenta, personajes);
          },
        }
      : null,
  );
  // Las acciones también lo usan (añadirlo y quitarlo)
  const depsSala: DependenciasSala = { ...deps, narradorVirtual };

  const conexionViva = (socketId: string) => io.sockets.sockets.has(socketId);

  // La votación avanza sola con el tiempo: cada paso se manda a todos.
  partida.alCambiarSola = difundir;

  io.use(async (socket, next) => {
    const { token, nombre, alias, avatar, clienteId } = socket.handshake.auth ?? {};
    let llegada: SalaLlegada;
    if (typeof token === 'string' && token) {
      const usuario = usuarioDelToken(token);
      // El cliente reconoce este mensaje y da la sesión por cerrada.
      if (!usuario) return next(new Error('SESION_CADUCADA'));
      llegada = {
        cuenta: {
          usuarioId: usuario.id,
          partidasJugadas: deps.contarPartidas ? await deps.contarPartidas(usuario.id).catch(() => null) : null,
        },
        nombreBase: usuario.username,
        alias: limpiarNombreSala(alias),
        avatarPorDefecto: await buscarAvatar(usuario.id).catch(() => null),
        avatarElegido: limpiarAvatarSala(avatar),
      };
    } else {
      const nombreBase = limpiarNombreSala(nombre);
      if (!nombreBase) return next(new Error('SIN_NOMBRE'));
      llegada = {
        cuenta: null,
        nombreBase,
        alias: limpiarNombreSala(alias),
        avatarPorDefecto: SALA_AVATAR_INVITADO,
        avatarElegido: limpiarAvatarSala(avatar),
      };
      // Un invitado no puede entrar con un nombre que ya usa otro: el cliente lo
      // devuelve a la pantalla de entrada para que elija otro.
      const nombreFinal = llegada.alias || llegada.nombreBase;
      const cliente = typeof clienteId === 'string' && clienteId ? clienteId.slice(0, 64) : null;
      if (!sala.participantes.nombreLibreParaInvitado(nombreFinal, cliente, conexionViva)) return next(new Error('NOMBRE_OCUPADO'));
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
    const { clave, expulsar } = sala.participantes.conectar(socket.id, clienteId, llegada, conexionViva);
    socket.emit('sala:guion', partida.guion.actual());
    // Su cuenta ya estaba en la sala desde otra conexión: esa se cierra. El aviso
    // llega antes que el cierre, y el cliente no intenta reconectar.
    if (expulsar) {
      io.to(expulsar).emit('sala:expulsado', { motivo: 'otraConexion' });
      io.sockets.sockets.get(expulsar)?.disconnect(true);
    }
    difundir();
    const yo = () => sala.participantes.participanteDe(clave);
    const miHistorial = () => {
      const p = yo();
      if (p) socket.emit('chat:historial', chat.historial(p));
    };
    miHistorial();

    // Mensajes de texto: { para: 'general' | 'visitantes' | id de participante, texto }.
    // Le llega a quien puede leerlo; si es un susurro entre jugadores, las ondas a todos.
    socket.on('chat:enviar', (peticion: { para?: unknown; texto?: unknown } | null, ack?: (r: ResultadoAccion) => void) => {
      const responder = (r: ResultadoAccion) => typeof ack === 'function' && ack(r);
      const p = yo();
      if (!p || typeof peticion?.para !== 'string' || typeof peticion.texto !== 'string') {
        responder({ ok: false, error: 'Mensaje desconocido.' });
        return;
      }
      try {
        const { mensaje, lectores, susurro } = chat.enviar(p.id, peticion.para, peticion.texto);
        responder({ ok: true });
        for (const { socketId, id } of sala.participantes.conexiones()) {
          if (lectores.includes(id)) io.to(socketId).emit('chat:mensaje', mensaje);
        }
        if (susurro) io.emit('sala:susurro', susurro);
      } catch (e) {
        responder({ ok: false, error: e instanceof ChatError ? e.message : 'No se ha podido mandar el mensaje.' });
      }
    });
    // Al cambiar de papel cambia lo que se puede leer: el cliente pide su historial.
    socket.on('chat:historial', miHistorial);

    // Videollamada: el pase para la plaza («principal») o para su conversación privada.
    socket.on('video:pase', async (peticion: { sala?: unknown } | null, ack?: (r: ResultadoAccion & Partial<PaseVideo>) => void) => {
      const responder = (r: ResultadoAccion & Partial<PaseVideo>) => typeof ack === 'function' && ack(r);
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
      socket.on(evento, (datos: Record<string, unknown> | null, ack?: (r: ResultadoAccion) => void) => {
        const responder = (r: ResultadoAccion) => typeof ack === 'function' && ack(r);
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
    enConversaciones('conversacion:pedirUnirse', (yoId, d) => void conversaciones.pedirUnirse(yoId, texto(d.con)));
    enConversaciones('conversacion:responder', (yoId, d) => conversaciones.responder(yoId, texto(d.invitacion), d.aceptar === true));
    enConversaciones('conversacion:cancelar', (yoId, d) => conversaciones.cancelar(yoId, texto(d.invitacion)));
    enConversaciones('conversacion:entrar', (yoId, d) => conversaciones.entrar(yoId, texto(d.conversacion)));
    enConversaciones('conversacion:escuchar', (yoId, d) => conversaciones.escuchar(yoId, texto(d.conversacion)));
    enConversaciones('conversacion:salir', (yoId) => conversaciones.salir(yoId));

    // Una sola puerta para todas las acciones: { accion, datos } y respuesta por ack.
    socket.on('sala:accion', async (peticion: { accion?: unknown; datos?: unknown } | null, ack?: (r: ResultadoAccion) => void) => {
      const nombre = typeof peticion?.accion === 'string' ? peticion.accion : '';
      const { expulsar: expulsados = [], ...resultado } = await ejecutarAccion(
        juego,
        sala.participantes.participanteDe(clave),
        nombre,
        peticion?.datos,
        depsSala,
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
        sala.participantes.salir(clave, socket.id);
      } else {
        sala.participantes.desconectar(clave, socket.id, difundir);
      }
      difundir();
    });
  });
}
