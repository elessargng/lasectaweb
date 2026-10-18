import type { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { farolesVacios, NPC_TOR, limpiarAvatarSala, limpiarNombreSala, SALA_AVATAR_INVITADO, SalaLlegada, SalaService } from '../services/SalaService';
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
// Lo que un jugador no ve de una ficha: de las ajenas, el personaje y los faroles; de ninguna, los recordatorios ni las notas.
const sinPersonaje = (a: SalaAsiento): SalaAsiento => ({
  ...a,
  personaje: null,
  alineamiento: null,
  recordatorios: [],
  notas: [],
  faroles: farolesVacios(),
});
const sinRecordatorios = (a: SalaAsiento): SalaAsiento => ({ ...a, recordatorios: [], notas: [] });

export function iniciarSalaSocket(httpServer: HttpServer, buscarAvatar: BuscarAvatar, deps: DependenciasSala): void {
  const io = new Server(httpServer, {
    path: SALA_SOCKET_PATH,
    cors: { origin: '*' },
    // Un fondo de la sala subido desde el ordenador (data URL) puede pasar de 1 MB
    maxHttpBufferSize: 8 * 1024 * 1024,
  });
  const sala = new SalaService();
  // Al revelar el grimorio, la partida se guarda (las estadísticas de cada uno)
  if (deps.guardarPartida) {
    const guardar = deps.guardarPartida;
    sala.alTerminarPartida = (registro) => {
      guardar(registro)
        .then(async () => {
          // Con una partida más, quien deja de ser novato pierde el pulpito
          if (!deps.contarPartidas) return;
          for (const { userId } of registro.jugadores) sala.cambiarPartidasJugadas(userId, await deps.contarPartidas(userId));
          difundir();
        })
        .catch((err) => console.error('[SALA] No se ha podido guardar la partida:', err));
    };
  }
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
    // Las fichas ajenas, como las ve quien no tiene el grimorio: sin personaje, salvo los
    // viajeros, que son públicos. Se ve quién es de verdad (un Alcalde con «Is The
    // Apprentice» se ve como Aprendiz); el alineamiento de un viajero, no.
    const viajeroDe = (a: SalaAsiento) => {
      const id = sala.identidad(a);
      return id && sala.personaje(id)?.tipo === 'traveller' ? id : null;
    };
    const comoLaVenTodos = (a: SalaAsiento): SalaAsiento => {
      const viajero = viajeroDe(a);
      return viajero ? { ...sinPersonaje(a), personaje: viajero } : sinPersonaje(a);
    };
    // Su jugador ve el personaje y el alineamiento que se le entregaron al repartir la
    // bolsa (lo que el narrador cambie luego es del grimorio: no lo ve), sin recordatorios.
    // Si es un viajero de verdad, como ese viajero (el Aprendiz: la ficha que sacó de la
    // bolsa), como los demás. Con Tor, no sabe quién es hasta que muere: la ve como los
    // demás; muerto, ve quién es de verdad.
    const tor = sala.npcActivo(NPC_TOR);
    const comoLaVeSuJugador = (a: SalaAsiento): SalaAsiento => {
      if (tor && !a.muerto) return comoLaVenTodos(a);
      // Con Tor, al morir sabe quién es de verdad (un Borracho con ficha de aldeano: Borracho)
      if (tor) return { ...sinRecordatorios(a), personaje: sala.identidad(a) };
      const viajero = viajeroDe(a);
      // Un viajero: quien es lo ve todo el mundo; su alineamiento, como se le dijo (al repartir
      // o con «Tú eres»), no el que el narrador le ponga en el grimorio
      return viajero
        ? { ...sinRecordatorios(a), personaje: viajero, alineamiento: sala.fichaEntregada(a.id).alineamiento }
        : { ...sinRecordatorios(a), ...sala.fichaEntregada(a.id) };
    };
    // Con el Gardener, mientras el narrador no los entregue, nadie ve ningún personaje
    // (tampoco el suyo ni los viajeros)
    const retenidas = sala.fichasRetenidas();
    const bolsa = sala.bolsa();
    const faroles = sala.faroles();
    const npcs = sala.npcs();
    const despertares = sala.despertares();
    const recordatoriosNoche = sala.recordatoriosNoche();
    const ahora = Date.now();
    const noche = sala.fase().momento === 'noche';
    for (const { socketId, clave, id } of sala.conexiones()) {
      const yo = sala.participanteDe(clave)!;
      const estado: SalaEstado = {
        participantes,
        asientos:
          yo.rol === 'narrador' || (yo.rol === 'visitante' && yo.accesoGrimorio === 'concedido')
            ? asientos
            : asientos.map((a) => ({
                // La muerte pendiente (de la noche, por anunciar) es del grimorio: los demás no la ven
                ...(reveladas.has(a.id)
                  ? a
                  : retenidas
                    ? sinPersonaje(a)
                    : a.ocupante === yo.id
                      ? comoLaVeSuJugador(a)
                      : comoLaVenTodos(a)),
                muertePendiente: false,
              })),
        configuracion,
        nominacion,
        fase: sala.fase(),
        distribucion,
        revelacion,
        gong: sala.gong(),
        video: !!videollamada,
        // Los jugadores no saben qué visitantes escuchan las conversaciones; de noche, ni
        // siquiera que las hay: solo ven aquella en la que están
        conversaciones:
          yo.rol === 'jugador'
            ? listaConversaciones
                .filter((c) => !noche || c.miembros.includes(yo.id))
                .map((c) => ({ ...c, oyentes: [] }))
            : listaConversaciones,
        invitaciones: conversaciones.invitacionesDe(id),
        // La bolsa es solo para los narradores (son los personajes de la partida)
        bolsa: yo.rol === 'narrador' ? bolsa : [],
        // Los faroles del narrador: también los ven los visitantes (no juegan)
        faroles: yo.rol === 'jugador' ? farolesVacios() : faroles,
        npcs,
        setupAceptado: yo.rol === 'narrador' ? sala.setupAceptado() : null,
        silencio: sala.silencio(),
        voudon: sala.voudonVivo(),
        institutriz: sala.institutrizViva(),
        bootlegger: sala.bootlegger(),
        rolStormcatcher: sala.rolStormcatcher(),
        fichasRetenidas: sala.fichasRetenidas(),
        ahora,
        // El registro de votaciones es solo para los narradores.
        votaciones: yo.rol === 'narrador' ? votaciones : [],
        recordatoriosNoche: yo.rol === 'narrador' ? recordatoriosNoche : {},
        // Los despertares: los narradores y los visitantes que ven el grimorio, todos; un
        // jugador, solo el de su asiento (nadie más sabe a quién se despierta).
        despertares:
          yo.rol === 'narrador' || (yo.rol === 'visitante' && yo.accesoGrimorio === 'concedido')
            ? despertares
            : yo.rol === 'jugador'
              ? despertares.filter((d) => d.asiento === sala.asientoDespiertoDe(yo.id))
              : [],
        grimorioRecibido: yo.rol === 'jugador' ? sala.grimorioRecibidoPor(yo.id) : null,
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
        partidasJugadas: deps.contarPartidas ? await deps.contarPartidas(usuario.id).catch(() => null) : null,
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
        partidasJugadas: null,
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
    enConversaciones('conversacion:pedirUnirse', (yoId, d) => void conversaciones.pedirUnirse(yoId, texto(d.con)));
    enConversaciones('conversacion:responder', (yoId, d) => conversaciones.responder(yoId, texto(d.invitacion), d.aceptar === true));
    enConversaciones('conversacion:cancelar', (yoId, d) => conversaciones.cancelar(yoId, texto(d.invitacion)));
    enConversaciones('conversacion:entrar', (yoId, d) => conversaciones.entrar(yoId, texto(d.conversacion)));
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
