import type { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { limpiarAvatarSala, limpiarNombreSala, SALA_AVATAR_INVITADO, SalaLlegada, SalaService } from '../services/SalaService';
import { SalaAsiento, SalaEstado } from '../types/sala';
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
  });
  const sala = new SalaService();

  // El guion (resuelto, con todos sus personajes) no va en cada estado: se manda
  // aparte, solo cuando cambia y a quien entra.
  let versionGuionMandada = sala.versionGuion();
  const mandarGuionSiCambia = () => {
    if (sala.versionGuion() === versionGuionMandada) return;
    versionGuionMandada = sala.versionGuion();
    io.emit('sala:guion', sala.guion());
  };

  const difundir = () => {
    const participantes = sala.participantes();
    const asientos = sala.asientos();
    const configuracion = sala.configuracion();
    const nominacion = sala.nominacion();
    const votaciones = sala.votaciones();
    const distribucion = sala.distribucion();
    const bolsa = sala.bolsa();
    const ahora = Date.now();
    for (const { socketId, clave, id } of sala.conexiones()) {
      const yo = sala.participanteDe(clave)!;
      const estado: SalaEstado = {
        participantes,
        asientos:
          yo.rol === 'narrador' || (yo.rol === 'visitante' && yo.accesoGrimorio === 'concedido')
            ? asientos
            : asientos.map((a) => (a.ocupante === yo.id ? a : sinPersonaje(a))),
        configuracion,
        nominacion,
        fase: sala.fase(),
        distribucion,
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
