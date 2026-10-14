import { ChatRepository } from '../repositories/ChatRepository';
import { ProveedorVideo } from '../services/videollamada/ProveedorVideo';
import { MENSAJES_PRIVADOS, SalaMensajesPrivados } from '../types/chat';
import {
  limpiarAvatarSala,
  limpiarNombreSala,
  SALA_ASIENTOS,
  SALA_SEGUNDOS_POR_FICHA,
  SalaService,
} from '../services/SalaService';
import { SALA_FORMAS_MANO, SalaFormaMano, SalaParticipante } from '../types/sala';
import { guardarAvatarSala } from '../utils/salaAvatarStorage';
import { GuionResuelto } from '../types/guiones';
import { GuionInvalidoError } from '../services/guiones/errores';

/** `valor`: lo que la acción devuelve a quien la pidió (p. ej. la ruta del avatar subido). */
export type SalaResultado = { ok: true; valor?: string } | { ok: false; error: string };

/** Lo que devuelve una acción: el resultado y, si saca a alguien de la sala, qué conexiones cerrar. */
export type SalaEfecto = SalaResultado & { expulsar?: string[] };

/**
 * Lo que necesitan los guiones de la sala. Es una interfaz (la implementa
 * GuionService): las acciones no conocen el servicio concreto, se les inyecta.
 * Si el guion no vale, rechaza con un GuionInvalidoError.
 */
export interface ServicioGuiones {
  guionPredeterminado(id: string): Promise<GuionResuelto>;
  importar(contenido: unknown, nombreArchivo?: string): Promise<GuionResuelto>;
}

/** Servicios de fuera de la sala que usan algunas acciones; se inyectan al iniciar la sala. */
export interface DependenciasSala {
  guiones: ServicioGuiones;
  /** Dónde se guardan los mensajes de texto de la sala. */
  mensajes: ChatRepository;
  /** El servidor de vídeo (cámaras y micrófonos), o null si no está configurado. */
  video: ProveedorVideo | null;
}

interface Accion {
  /** Si quien la pide puede hacerla ahora. Es la única comprobación de permisos. */
  puede: (sala: SalaService, yo: SalaParticipante) => boolean;
  /** Mensaje cuando no puede. */
  noPuede: string | ((sala: SalaService, yo: SalaParticipante) => string);
  /** La ejecuta; solo valida los datos que recibe, no los permisos. */
  hacer: (sala: SalaService, yo: SalaParticipante, datos: unknown, deps: DependenciasSala) => SalaEfecto | Promise<SalaEfecto>;
}

const cualquiera = () => true;
const esNarrador = (_sala: SalaService, yo: SalaParticipante) => yo.rol === 'narrador';

/**
 * Todo lo que se puede pedir a la sala, con quién puede pedirlo. Las del
 * narrador van con el prefijo `narrador:`.
 *
 * El socket comprueba `puede` antes de `hacer`, y a cada participante se le
 * manda la lista de las que puede usar en ese momento: el cliente pinta sus
 * botones a partir de ella, sin decidir permisos por su cuenta. Para añadir una
 * acción basta con añadirla aquí (y su botón en el cliente).
 */
/** Los tipos de personaje que pueden ir en la ficha de un jugador (no los legendarios ni los lóricos). */
const TIPOS_EN_FICHA: string[] = ['townsfolk', 'outsider', 'minion', 'demon', 'traveller'];
/** Los que van en la bolsa para repartir (los viajeros se ponen aparte, ficha a ficha). */
const TIPOS_EN_BOLSA: string[] = ['townsfolk', 'outsider', 'minion', 'demon'];

export const SALA_ACCIONES: Record<string, Accion> = {
  /** datos: { nombre }. Vacío: vuelve al nombre de usuario (solo con cuenta). */
  'sala:cambiarNombre': {
    puede: cualquiera,
    noPuede: '',
    hacer: (sala, yo, datos) => {
      const pedido = limpiarNombreSala((datos as { nombre?: unknown } | null)?.nombre);
      const nombre = pedido || (yo.conCuenta ? sala.nombreBase(yo.id) : '');
      if (!nombre) return { ok: false, error: 'Escribe un nombre.' };
      if (sala.nombreOcupado(nombre, yo.id)) return { ok: false, error: `Ya hay alguien llamado ${nombre} en la sala.` };
      sala.renombrar(yo.id, nombre);
      return { ok: true };
    },
  },

  /**
   * datos: { avatar } uno de `SALA_AVATARES` o una imagen ya subida a la sala, o
   * null para el por defecto (el de su cuenta, o el logo si es invitado).
   */
  'sala:cambiarAvatar': {
    puede: cualquiera,
    noPuede: '',
    hacer: (sala, yo, datos) => {
      const pedido = (datos as { avatar?: unknown } | null)?.avatar ?? null;
      const avatar = limpiarAvatarSala(pedido);
      if (pedido !== null && !avatar) return { ok: false, error: 'Ese avatar no está disponible.' };
      sala.cambiarAvatar(yo.id, avatar);
      return { ok: true };
    },
  },

  /** Un visitante se sienta en un asiento libre y pasa a jugador. datos: { asientoId }. */
  /** Un visitante pide ver el grimorio del narrador (los narradores lo aceptan o lo rechazan). */
  'sala:solicitarGrimorio': {
    puede: (sala, yo) => yo.rol === 'visitante' && yo.accesoGrimorio === 'ninguno' && sala.hayNarrador(),
    noPuede: (sala, yo) =>
      yo.rol !== 'visitante'
        ? 'Solo los visitantes piden ver el grimorio.'
        : yo.accesoGrimorio !== 'ninguno'
          ? yo.accesoGrimorio === 'concedido'
            ? 'Ya ves el grimorio.'
            : 'Ya lo has pedido.'
          : 'La sala no tiene narrador.',
    hacer: (sala, yo) => {
      sala.cambiarAccesoGrimorio(yo.id, 'solicitado');
      return { ok: true };
    },
  },

  /**
   * El narrador responde a quien ha pedido ver el grimorio: se lo concede (y ya
   * no lo pierde mientras sea visitante: lo ha visto) o no.
   * datos: { participanteId, conceder: boolean }.
   */
  'narrador:accesoGrimorio': {
    puede: esNarrador,
    noPuede: 'Solo un narrador decide quién ve el grimorio.',
    hacer: (sala, _yo, datos) => {
      const { participanteId, conceder } = (datos as { participanteId?: unknown; conceder?: unknown }) ?? {};
      const quien = typeof participanteId === 'string' ? sala.buscar(participanteId) : undefined;
      if (!quien || quien.rol !== 'visitante') return { ok: false, error: 'Esa persona ya no es visitante de la sala.' };
      if (typeof conceder !== 'boolean') return { ok: false, error: 'Respuesta desconocida.' };
      if (quien.accesoGrimorio !== 'solicitado') return { ok: false, error: 'Esa persona ya no lo está pidiendo.' };
      sala.cambiarAccesoGrimorio(quien.id, conceder ? 'concedido' : 'ninguno');
      return { ok: true };
    },
  },

  // Quien ve el grimorio del narrador no puede jugar: sabría los personajes de todos.
  'sala:sentarse': {
    puede: (_sala, yo) => yo.rol === 'visitante' && yo.accesoGrimorio !== 'concedido',
    noPuede: (_sala, yo) =>
      yo.rol === 'jugador'
        ? 'Ya estás sentado.'
        : yo.rol === 'narrador'
          ? 'Los narradores no se sientan en la mesa.'
          : 'Quien ha visto el grimorio del narrador no puede sentarse en la mesa.',
    hacer: (sala, yo, datos) => {
      const asientoId = (datos as { asientoId?: unknown } | null)?.asientoId;
      const error = typeof asientoId === 'string' ? sala.sentar(yo.id, asientoId) : 'Asiento desconocido.';
      return error ? { ok: false, error } : { ok: true };
    },
  },

  /** Un jugador levanta o baja la mano. datos: { levantada: boolean }. */
  'sala:levantarMano': {
    puede: (_sala, yo) => yo.rol === 'jugador',
    noPuede: 'Solo los jugadores sentados pueden levantar la mano.',
    hacer: (sala, yo, datos) => {
      const levantada = (datos as { levantada?: unknown } | null)?.levantada;
      if (typeof levantada !== 'boolean') return { ok: false, error: 'Estado desconocido.' };
      sala.levantarMano(yo.id, levantada);
      return { ok: true };
    },
  },

  /** Un jugador elige la forma de su mano (palma, puño o tijera). datos: { forma }. */
  'sala:elegirMano': {
    puede: (_sala, yo) => yo.rol === 'jugador',
    noPuede: 'Solo los jugadores sentados tienen mano que levantar.',
    hacer: (sala, yo, datos) => {
      const forma = (datos as { forma?: unknown } | null)?.forma;
      if (!SALA_FORMAS_MANO.includes(forma as SalaFormaMano)) return { ok: false, error: 'Forma de mano desconocida.' };
      sala.elegirFormaMano(yo.id, forma as SalaFormaMano);
      return { ok: true };
    },
  },

  /** Un jugador deja su asiento y vuelve a visitante. */
  'sala:levantarse': {
    puede: (_sala, yo) => yo.rol === 'jugador',
    noPuede: 'No estás sentado.',
    hacer: (sala, yo) => {
      sala.levantar(yo.id);
      return { ok: true };
    },
  },

  /**
   * Sube una imagen propia como avatar para la sala (su perfil de la web no
   * cambia). datos: { imagen } JPEG en base64. Devuelve su ruta en `valor`.
   */
  'sala:subirAvatar': {
    puede: cualquiera,
    noPuede: '',
    hacer: (sala, yo, datos) => {
      const guardado = guardarAvatarSala((datos as { imagen?: unknown } | null)?.imagen);
      if ('error' in guardado) return { ok: false, error: guardado.error };
      sala.cambiarAvatar(yo.id, guardado.ruta);
      return { ok: true, valor: guardado.ruta };
    },
  },

  'sala:hacerseNarrador': {
    puede: (sala) => !sala.hayNarrador(),
    noPuede: 'La sala ya tiene narrador.',
    hacer: (sala, yo) => {
      sala.cambiarRol(yo.id, 'narrador');
      return { ok: true };
    },
  },

  'narrador:dejar': {
    puede: esNarrador,
    noPuede: 'No eres narrador.',
    hacer: (sala, yo) => {
      sala.cambiarRol(yo.id, 'visitante');
      return { ok: true };
    },
  },

  /**
   * Ajustes de la partida (Preferencias > Partida). datos: cualquiera de
   * { grimorioJugadores: boolean, segundosPorFicha: número de 0,25 en 0,25,
   *   mensajes: 'ninguno' | 'vecinos' | 'todos' (mensajes privados entre jugadores) }.
   * (La cuenta atrás no se configura: siempre es de 3 a 0.)
   */
  'narrador:configurarPartida': {
    puede: esNarrador,
    noPuede: 'Solo un narrador puede cambiar los ajustes de la partida.',
    hacer: (sala, _yo, datos) => {
      const { grimorioJugadores, segundosPorFicha, mensajes } = (datos as Record<string, unknown>) ?? {};
      const cambios: Parameters<SalaService['configurar']>[0] = {};
      if (grimorioJugadores !== undefined) {
        if (typeof grimorioJugadores !== 'boolean') return { ok: false, error: 'Ajuste desconocido.' };
        cambios.grimorioJugadores = grimorioJugadores;
      }
      if (segundosPorFicha !== undefined) {
        const { min, max, paso } = SALA_SEGUNDOS_POR_FICHA;
        const segundos = segundosPorFicha as number;
        if (typeof segundos !== 'number' || segundos < min || segundos > max || !Number.isInteger(segundos / paso)) {
          const es = (n: number) => n.toLocaleString('es');
          return {
            ok: false,
            error: `La velocidad de las agujas tiene que ser de ${es(min)} a ${es(max)} segundos, de ${es(paso)} en ${es(paso)}.`,
          };
        }
        cambios.segundosPorFicha = segundos;
      }
      if (mensajes !== undefined) {
        if (!MENSAJES_PRIVADOS.includes(mensajes as SalaMensajesPrivados)) return { ok: false, error: 'Ajuste desconocido.' };
        cambios.mensajes = mensajes as SalaMensajesPrivados;
      }
      if (Object.keys(cambios).length === 0) return { ok: false, error: 'Ajuste desconocido.' };
      sala.configurar(cambios);
      return { ok: true };
    },
  },

  /** Carga un guion en la sala (por defecto o leído de un JSON). datos: { guion: SalaGuion }. */
  /**
   * Carga un guion en la sala: uno por defecto o uno importado de un JSON, que
   * interpreta y resuelve GuionService. datos: { predeterminado: id } o
   * { json: texto del archivo, archivo?: su nombre }.
   */
  'narrador:cambiarGuion': {
    puede: esNarrador,
    noPuede: 'Solo un narrador puede cambiar el guion.',
    hacer: async (sala, _yo, datos, { guiones }) => {
      const { predeterminado, json, archivo } = (datos as Record<string, unknown>) ?? {};
      try {
        const guion =
          typeof predeterminado === 'string'
            ? await guiones.guionPredeterminado(predeterminado)
            : await guiones.importar(json, typeof archivo === 'string' ? archivo : undefined);
        sala.cambiarGuion(guion);
        return { ok: true };
      } catch (e) {
        // Un guion inválido trae un mensaje para quien lo carga; cualquier otro fallo, no.
        if (e instanceof GuionInvalidoError) return { ok: false, error: e.message };
        console.error('[Sala] Error al cargar un guion:', e);
        return { ok: false, error: 'No se pudo cargar el guion. Inténtalo de nuevo.' };
      }
    },
  },

  /** La ficha de un asiento nomina a la de otro (o a sí misma). datos: { desde, hasta } (ids de asiento). */
  'narrador:nominar': {
    // Solo de día
    puede: (sala, yo) => yo.rol === 'narrador' && sala.fase().momento === 'dia' && sala.asientos().length >= 2,
    noPuede: (sala, yo) =>
      yo.rol !== 'narrador'
        ? 'Solo un narrador puede abrir una nominación.'
        : sala.fase().momento !== 'dia'
          ? 'Solo se nomina de día.'
          : 'Hacen falta al menos dos asientos.',
    hacer: (sala, _yo, datos) => {
      const { desde, hasta } = (datos as { desde?: unknown; hasta?: unknown }) ?? {};
      if (typeof desde !== 'string' || typeof hasta !== 'string' || !sala.hayAsiento(desde) || !sala.hayAsiento(hasta)) {
        return { ok: false, error: 'Ese asiento ya no existe.' };
      }
      sala.nominar(desde, hasta);
      return { ok: true };
    },
  },

  'narrador:cerrarNominacion': {
    puede: (sala, yo) => yo.rol === 'narrador' && !!sala.nominacion(),
    noPuede: 'No hay ninguna nominación abierta.',
    hacer: (sala) => {
      sala.cerrarNominacion();
      return { ok: true };
    },
  },

  /**
   * Cambia los votos que hacen falta en la nominación abierta. datos: { votos:
   * número entero de 1 al número de asientos, o null para volver a los de por defecto }.
   */
  'narrador:votosNecesarios': {
    puede: (sala, yo) => yo.rol === 'narrador' && !!sala.nominacion(),
    noPuede: 'No hay ninguna nominación abierta.',
    hacer: (sala, _yo, datos) => {
      const votos = (datos as { votos?: unknown } | null)?.votos;
      const maximo = Math.max(1, sala.asientos().length);
      if (votos !== null && (typeof votos !== 'number' || !Number.isInteger(votos) || votos < 1 || votos > maximo)) {
        return { ok: false, error: `Los votos tienen que ser de 1 a ${maximo}.` };
      }
      sala.elegirVotosNecesarios(votos);
      return { ok: true };
    },
  },

  /** Arranca (o reinicia) la cuenta atrás de la nominación abierta; al acabar, empieza la votación. */
  'narrador:cuentaAtras': {
    puede: (sala, yo) => yo.rol === 'narrador' && !!sala.nominacion() && !sala.hayVotacion(),
    noPuede: (sala) => (sala.hayVotacion() ? 'Esta nominación ya se ha votado.' : 'No hay ninguna nominación abierta.'),
    hacer: (sala) => {
      sala.iniciarCuentaAtras(Date.now());
      return { ok: true };
    },
  },

  /**
   * Pone o quita la calavera a la ficha de un asiento (solo una puede llevarla).
   * Desde el panel de la nominación, además la cierra; desde el menú de la ficha
   * no (cerrarNominacion: false). datos: { asientoId, marcado: boolean, cerrarNominacion?: boolean }.
   */
  'narrador:marcar': {
    puede: (sala, yo) => yo.rol === 'narrador' && sala.asientos().length > 0,
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'La mesa no tiene asientos.' : 'Solo un narrador puede marcar una ficha.'),
    hacer: (sala, _yo, datos) => {
      const { asientoId, marcado, cerrarNominacion } =
        (datos as { asientoId?: unknown; marcado?: unknown; cerrarNominacion?: unknown }) ?? {};
      if (typeof asientoId !== 'string' || !sala.hayAsiento(asientoId)) return { ok: false, error: 'Ese asiento ya no existe.' };
      if (typeof marcado !== 'boolean') return { ok: false, error: 'Estado desconocido.' };
      // Si se marca al nominado de una nominación ya votada, se guardan sus votos
      // (el narrador los ve, para saber si otra votación empata).
      const n = sala.nominacion();
      const votos = n?.votacion?.terminada && n.hasta === asientoId ? n.votacion.votos : null;
      sala.marcar(asientoId, marcado, votos);
      if (cerrarNominacion !== false) sala.cerrarNominacion();
      return { ok: true };
    },
  },

  /** Quita la calavera a quien la lleve (desde el panel de la nominación) y, como marcar, cierra la nominación. */
  'narrador:desmarcar': {
    puede: (sala, yo) => yo.rol === 'narrador' && sala.hayMarca(),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'Nadie lleva la calavera.' : 'Solo un narrador puede desmarcar.'),
    hacer: (sala) => {
      sala.desmarcar();
      sala.cerrarNominacion();
      return { ok: true };
    },
  },

  /**
   * Anochece: desde la preparación, la noche 1; desde un día, la noche siguiente.
   * Cierra la nominación y quita la calavera y el récord de votos del día.
   */
  'narrador:irANoche': {
    puede: (sala, yo) => yo.rol === 'narrador' && sala.fase().momento !== 'noche',
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'Ya es de noche.' : 'Solo un narrador puede hacer que anochezca.'),
    hacer: (sala) => {
      sala.irANoche();
      return { ok: true };
    },
  },

  /** Amanece: de la noche N al día N. */
  'narrador:amanecer': {
    puede: (sala, yo) => yo.rol === 'narrador' && sala.fase().momento === 'noche',
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'Solo amanece de noche.' : 'Solo un narrador puede hacer que amanezca.'),
    hacer: (sala) => {
      sala.amanecer();
      return { ok: true };
    },
  },

  /**
   * Limpia el grimorio: borra el registro de votaciones, deja las fichas como al
   * principio y vuelve a la preparación de la partida.
   */
  'narrador:limpiarGrimorio': {
    puede: (_sala, yo) => yo.rol === 'narrador',
    noPuede: 'Solo un narrador puede limpiar el grimorio.',
    hacer: (sala) => {
      sala.limpiarGrimorio();
      return { ok: true };
    },
  },

  /** Quita el papel de narrador a otro narrador (pasa a visitante). datos: { participanteId }. */
  'narrador:expulsarNarrador': {
    // Solo sale si hay a quién: otro narrador además de uno mismo.
    puede: (sala, yo) => yo.rol === 'narrador' && sala.participantes().some((p) => p.rol === 'narrador' && p.id !== yo.id),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'No hay otro narrador.' : 'Solo un narrador puede quitar a otro.'),
    hacer: (sala, yo, datos) => {
      const id = (datos as { participanteId?: unknown } | null)?.participanteId;
      const elegido = typeof id === 'string' ? sala.buscar(id) : undefined;
      if (!elegido) return { ok: false, error: 'Esa persona ya no está en la sala.' };
      if (elegido.id === yo.id) return { ok: false, error: 'Para dejar de narrar, usa «Dejar de ser narrador».' };
      if (elegido.rol !== 'narrador') return { ok: false, error: `${elegido.nombre} ya no es narrador.` };
      sala.cambiarRol(elegido.id, 'visitante');
      return { ok: true };
    },
  },

  /**
   * Pone un personaje del guion en la ficha de un asiento (aldeanos, forasteros,
   * esbirros, demonios o viajeros), o se lo quita. datos: { asientoId, personajeId: string | null }.
   */
  'narrador:cambiarPersonaje': {
    puede: (sala, yo) => yo.rol === 'narrador' && sala.asientos().length > 0,
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'La mesa no tiene asientos.' : 'Solo un narrador puede cambiar las fichas.'),
    hacer: (sala, _yo, datos) => {
      const { asientoId, personajeId } = (datos as { asientoId?: unknown; personajeId?: unknown }) ?? {};
      if (typeof asientoId !== 'string' || !sala.hayAsiento(asientoId)) return { ok: false, error: 'Ese asiento ya no existe.' };
      if (personajeId !== null) {
        const personaje =
          typeof personajeId === 'string' ? sala.guion()?.personajes.find((p) => p.id === personajeId) : undefined;
        if (!personaje) return { ok: false, error: 'Ese personaje no está en el guion.' };
        if (!TIPOS_EN_FICHA.includes(personaje.tipo)) return { ok: false, error: 'Ese personaje no puede ir en una ficha.' };
      }
      sala.cambiarPersonaje(asientoId, personajeId as string | null);
      return { ok: true };
    },
  },

  /**
   * Mete en la bolsa un personaje del guion (aldeano, forastero, esbirro o
   * demonio), o lo saca si ya estaba. No se limita cuántos: lo decide el narrador.
   * datos: { personajeId }.
   */
  'narrador:bolsa': {
    puede: (sala, yo) => yo.rol === 'narrador' && !!sala.guion(),
    noPuede: (sala, yo) => (yo.rol !== 'narrador' ? 'Solo un narrador puede preparar la bolsa.' : 'Antes hay que elegir un guion.'),
    hacer: (sala, _yo, datos) => {
      const personajeId = (datos as { personajeId?: unknown } | null)?.personajeId;
      const personaje = typeof personajeId === 'string' ? sala.guion()?.personajes.find((p) => p.id === personajeId) : undefined;
      if (!personaje) return { ok: false, error: 'Ese personaje no está en el guion.' };
      if (!TIPOS_EN_BOLSA.includes(personaje.tipo)) return { ok: false, error: 'En la bolsa solo van aldeanos, forasteros, esbirros y demonios.' };
      sala.alternarEnBolsa(personaje.id);
      return { ok: true };
    },
  },

  /**
   * Reparte al azar los personajes de la bolsa entre los asientos que no llevan
   * viajero. Solo si hay en la bolsa tantos como esos asientos.
   */
  'narrador:asignarPersonajes': {
    puede: (sala, yo) => yo.rol === 'narrador' && !!sala.guion(),
    noPuede: (sala, yo) => (yo.rol !== 'narrador' ? 'Solo un narrador puede repartir los personajes.' : 'Antes hay que elegir un guion.'),
    hacer: (sala) => {
      const hacen = sala.fichasParaRepartir();
      const hay = sala.bolsa().length;
      if (hacen === 0) return { ok: false, error: 'No hay asientos a los que repartir.' };
      if (hay !== hacen) return { ok: false, error: `En la bolsa tiene que haber ${hacen} personajes y hay ${hay}.` };
      sala.repartirBolsa();
      return { ok: true };
    },
  },

  /**
   * Revelar el grimorio (final de la partida): el narrador dice qué bando ha
   * ganado y todas las fichas se dan la vuelta. datos: { ganador: 'bueno' | 'malvado' }.
   */
  'narrador:revelarGrimorio': {
    puede: (sala, yo) => yo.rol === 'narrador' && !sala.revelacion() && sala.asientos().length > 0,
    noPuede: (sala, yo) =>
      yo.rol !== 'narrador'
        ? 'Solo un narrador puede revelar el grimorio.'
        : sala.revelacion()
          ? 'Ya se está revelando el grimorio.'
          : 'La mesa no tiene asientos.',
    hacer: (sala, _yo, datos) => {
      const ganador = (datos as { ganador?: unknown } | null)?.ganador;
      if (ganador !== 'bueno' && ganador !== 'malvado') return { ok: false, error: 'Bando desconocido.' };
      sala.empezarRevelacion(ganador);
      return { ok: true };
    },
  },

  /** Revela la ficha de un asiento, para todos. datos: { asientoId }. */
  'narrador:revelarFicha': {
    puede: (sala, yo) => yo.rol === 'narrador' && !!sala.revelacion() && !sala.revelacion()!.terminada,
    noPuede: 'No se está revelando el grimorio.',
    hacer: (sala, _yo, datos) => {
      const asientoId = (datos as { asientoId?: unknown } | null)?.asientoId;
      if (typeof asientoId !== 'string' || !sala.hayAsiento(asientoId)) return { ok: false, error: 'Ese asiento ya no existe.' };
      sala.revelarFicha(asientoId);
      return { ok: true };
    },
  },

  /** Termina la revelación: revela de una vez las fichas que quedan. */
  'narrador:terminarRevelacion': {
    puede: (sala, yo) => yo.rol === 'narrador' && !!sala.revelacion() && !sala.revelacion()!.terminada,
    noPuede: 'No se está revelando el grimorio.',
    hacer: (sala) => {
      sala.revelarTodas();
      return { ok: true };
    },
  },

  /** Cambia el alineamiento de la ficha de un asiento. datos: { asientoId, alineamiento: 'bueno' | 'malvado' }. */
  'narrador:cambiarAlineamiento': {
    puede: (sala, yo) => yo.rol === 'narrador' && sala.asientos().length > 0,
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'La mesa no tiene asientos.' : 'Solo un narrador puede cambiar las fichas.'),
    hacer: (sala, _yo, datos) => {
      const { asientoId, alineamiento } = (datos as { asientoId?: unknown; alineamiento?: unknown }) ?? {};
      if (typeof asientoId !== 'string' || !sala.hayAsiento(asientoId)) return { ok: false, error: 'Ese asiento ya no existe.' };
      if (alineamiento !== 'bueno' && alineamiento !== 'malvado') return { ok: false, error: 'Alineamiento desconocido.' };
      if (!sala.asientos().find((a) => a.id === asientoId)?.personaje) {
        return { ok: false, error: 'Esa ficha no tiene personaje.' };
      }
      sala.cambiarAlineamiento(asientoId, alineamiento);
      return { ok: true };
    },
  },

  /** Mata o revive la ficha de un asiento (haya alguien sentado o no). datos: { asientoId, muerto: boolean }. */
  'narrador:cambiarVida': {
    puede: (sala, yo) => yo.rol === 'narrador' && sala.asientos().length > 0,
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'La mesa no tiene asientos.' : 'Solo un narrador puede matar o revivir.'),
    hacer: (sala, _yo, datos) => {
      const { asientoId, muerto } = (datos as { asientoId?: unknown; muerto?: unknown }) ?? {};
      if (typeof asientoId !== 'string' || !sala.hayAsiento(asientoId)) return { ok: false, error: 'Ese asiento ya no existe.' };
      if (typeof muerto !== 'boolean') return { ok: false, error: 'Estado desconocido.' };
      sala.cambiarVida(asientoId, muerto);
      return { ok: true };
    },
  },

  /** Levanta a un jugador de su asiento: vuelve a visitante. datos: { participanteId }. */
  'narrador:levantarJugador': {
    // Solo sale si hay a quién: algún jugador sentado.
    puede: (sala, yo) => yo.rol === 'narrador' && sala.participantes().some((p) => p.rol === 'jugador'),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'No hay nadie sentado.' : 'Solo un narrador puede levantar a un jugador.'),
    hacer: (sala, _yo, datos) => {
      const id = (datos as { participanteId?: unknown } | null)?.participanteId;
      const elegido = typeof id === 'string' ? sala.buscar(id) : undefined;
      if (!elegido) return { ok: false, error: 'Esa persona ya no está en la sala.' };
      if (elegido.rol !== 'jugador') return { ok: false, error: `${elegido.nombre} no está en ningún asiento.` };
      sala.levantar(elegido.id);
      return { ok: true };
    },
  },

  /** Saca de la sala a un jugador o visitante (no a otro narrador). datos: { participanteId }. */
  'narrador:expulsarJugador': {
    // Solo sale si hay a quién: alguien que no narra.
    puede: (sala, yo) => yo.rol === 'narrador' && sala.participantes().some((p) => p.rol !== 'narrador'),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'No hay nadie a quien expulsar.' : 'Solo un narrador puede expulsar a alguien.'),
    hacer: (sala, _yo, datos) => {
      const id = (datos as { participanteId?: unknown } | null)?.participanteId;
      const elegido = typeof id === 'string' ? sala.buscar(id) : undefined;
      if (!elegido) return { ok: false, error: 'Esa persona ya no está en la sala.' };
      if (elegido.rol === 'narrador') return { ok: false, error: 'Para quitar a un narrador, usa «Expulsar narrador».' };
      const conexion = sala.expulsar(elegido.id);
      return { ok: true, expulsar: conexion ? [conexion] : [] };
    },
  },

  /**
   * Añade o quita un asiento al final del círculo, mezcla a quienes están
   * sentados o mueve a uno a otro asiento (intercambiándolos si está ocupado).
   * datos: { cambio: 'añadir' | 'quitar' | 'mezclar' } o
   * { cambio: 'mover', desde: asientoId, hasta: asientoId }.
   */
  'narrador:asientos': {
    puede: esNarrador,
    noPuede: 'Solo un narrador puede cambiar los asientos.',
    hacer: (sala, _yo, datos) => {
      const cambio = (datos as { cambio?: unknown } | null)?.cambio;
      const total = sala.asientos().length;
      if (cambio === 'añadir') {
        if (total >= SALA_ASIENTOS.max) return { ok: false, error: `La mesa ya tiene el máximo de ${SALA_ASIENTOS.max} asientos.` };
        sala.anadirAsiento();
        return { ok: true };
      }
      if (cambio === 'quitar') {
        if (total <= SALA_ASIENTOS.min) return { ok: false, error: 'La mesa ya no tiene asientos.' };
        sala.quitarAsiento();
        return { ok: true };
      }
      if (cambio === 'mover') {
        const { desde, hasta } = (datos as { desde?: unknown; hasta?: unknown }) ?? {};
        if (typeof desde !== 'string' || typeof hasta !== 'string') return { ok: false, error: 'Asiento desconocido.' };
        const error = sala.moverOcupante(desde, hasta);
        return error ? { ok: false, error } : { ok: true };
      }
      if (cambio === 'mezclar') {
        if (sala.mezclarAsientos() === 0) return { ok: false, error: 'No hay nadie sentado para mezclar.' };
        return { ok: true };
      }
      return { ok: false, error: 'Cambio de asientos desconocido.' };
    },
  },

  /** datos: { participanteId } de un visitante o jugador. */
  'narrador:nombrarNarrador': {
    puede: esNarrador,
    noPuede: 'Solo un narrador puede nombrar a otro.',
    hacer: (sala, _yo, datos) => {
      const id = (datos as { participanteId?: unknown } | null)?.participanteId;
      const elegido = typeof id === 'string' ? sala.buscar(id) : undefined;
      if (!elegido) return { ok: false, error: 'Esa persona ya no está en la sala.' };
      if (elegido.rol === 'narrador') return { ok: false, error: `${elegido.nombre} ya es narrador.` };
      sala.cambiarRol(elegido.id, 'narrador');
      return { ok: true };
    },
  },
};

/** Las acciones que este participante puede usar ahora mismo. */
export function accionesPermitidas(sala: SalaService, yo: SalaParticipante): string[] {
  return Object.entries(SALA_ACCIONES)
    .filter(([, accion]) => accion.puede(sala, yo))
    .map(([nombre]) => nombre);
}

/** Ejecuta una acción si existe y quien la pide tiene permiso. */
export async function ejecutarAccion(
  sala: SalaService,
  yo: SalaParticipante | undefined,
  nombre: string,
  datos: unknown,
  deps: DependenciasSala,
): Promise<SalaEfecto> {
  const accion = Object.prototype.hasOwnProperty.call(SALA_ACCIONES, nombre) ? SALA_ACCIONES[nombre] : undefined;
  if (!accion) return { ok: false, error: 'Acción desconocida.' };
  if (!yo) return { ok: false, error: 'No estás en la sala.' };
  if (!accion.puede(sala, yo)) {
    return { ok: false, error: typeof accion.noPuede === 'function' ? accion.noPuede(sala, yo) : accion.noPuede };
  }
  return accion.hacer(sala, yo, datos, deps);
}
