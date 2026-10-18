import { randomUUID } from 'crypto';
import { ChatRepository } from '../repositories/ChatRepository';
import { datosDeDataUrl, guardarFondoSala } from '../utils/salaFondoStorage';
import { ProveedorVideo } from '../services/videollamada/ProveedorVideo';
import { MENSAJES_PRIVADOS, SalaMensajesPrivados } from '../types/chat';
import {
  limpiarAvatarSala,
  limpiarNombreSala,
  NPC_BOOTLEGGER,
  NPC_FERRYMAN,
  NPC_GARDENER,
  NPC_POPE,
  NPC_SILENCIO,
  NPC_STORMCATCHER,
  SALA_ASIENTOS,
  SALA_SEGUNDOS_POR_FICHA,
  SalaService,
} from '../services/SalaService';
import {
  ADJUNTOS_DESPERTAR,
  CAUSAS_FIN_PARTIDA,
  FICHAS_DESPERTAR,
  FichaDespertar,
  ICONOS_RECORDATORIO_TEXTO,
  MensajeDespertar,
  NUM_FAROLES,
  RECORDATORIO_TEXTO,
  SALA_ESTILOS_MANO,
  SALA_FORMAS_MANO,
  SALA_NOTA_LARGO_MAX,
  SALA_NOTAS_MAX,
  SALA_RECORDATORIO_TEXTO_MAX,
  SalaFichaEnviada,
  SalaFormaMano,
  SalaParticipante,
  TARJETAS_DESPERTAR,
  TarjetaDespertar,
} from '../types/sala';
import { guardarAvatarSala } from '../utils/salaAvatarStorage';
import { GuionResuelto, TIPOS_NPC, TipoPersonaje } from '../types/guiones';
import { GuionInvalidoError } from '../services/guiones/errores';
import type { RegistroPartida } from '../services/estadisticas/SeguimientoPartida';

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
  /** Las imágenes de la Biblioteca (para elegir un fondo de la sala). */
  imagenesBiblioteca: ImagenesBiblioteca;
  /** Dónde se guarda cada partida al terminar (las estadísticas); sin esto, no se guarda. */
  guardarPartida?: (registro: RegistroPartida) => Promise<void>;
  /** Cuántas partidas ha jugado alguien (para el pulpito de novato); sin esto, nadie lo es. */
  contarPartidas?: (userId: string) => Promise<number>;
}

/**
 * Lee una imagen pública de la Biblioteca (como la vería alguien sin cuenta).
 * Rechaza si no existe, no es pública o no es una imagen. Es una interfaz: la
 * implementa LibraryService (se inyecta en index.ts).
 */
export interface ImagenesBiblioteca {
  leerPublica(versionId: string): Promise<Buffer>;
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

/** Tiempo mínimo (ms) entre dos gongs. */
const SALA_PAUSA_GONG_MS = 5000;

/** Largo máximo del texto «Personalizado» al despertar. */
export const SALA_TEXTO_DESPERTAR_MAX = 200;

/**
 * Comprueba un mensaje para los despiertos: una ficha (o, si lo manda el
 * narrador, una tarjeta) con justo lo que lleva. Devuelve el mensaje limpio o el error.
 */
function leerMensajeDespertar(
  sala: SalaService,
  datos: unknown,
  conTarjetas: boolean,
): { error: string } | Omit<MensajeDespertar, 'id' | 'hora' | 'autor' | 'fase'> {
  const { ficha, tarjeta, jugadores, personajes, texto, alineamiento } =
    (datos as {
      ficha?: unknown;
      tarjeta?: unknown;
      jugadores?: unknown;
      personajes?: unknown;
      texto?: unknown;
      alineamiento?: unknown;
    } | null) ?? {};
  const esFicha = typeof ficha === 'string' && (FICHAS_DESPERTAR as readonly string[]).includes(ficha);
  const esTarjeta = conTarjetas && typeof tarjeta === 'string' && (TARJETAS_DESPERTAR as readonly string[]).includes(tarjeta);
  if (esFicha === esTarjeta) return { error: 'Mensaje desconocido.' };
  const clave = (esFicha ? ficha : tarjeta) as FichaDespertar | TarjetaDespertar;
  const adjunto = ADJUNTOS_DESPERTAR[clave] ?? {};

  const ids = (valor: unknown): string[] | null =>
    Array.isArray(valor) && valor.every((v) => typeof v === 'string') ? [...new Set(valor as string[])] : null;
  const asientos = adjunto.jugadores ? ids(jugadores) : [];
  if (adjunto.jugadores && (!asientos?.length || asientos.some((a) => !sala.hayAsiento(a)))) {
    return { error: 'Elige al menos un jugador.' };
  }
  const elegidos = adjunto.personajes ? ids(personajes) : [];
  if (adjunto.personajes && (!elegidos?.length || elegidos.some((id) => !sala.personaje(id)))) {
    return { error: 'Elige al menos un personaje del guion.' };
  }
  const limpio = adjunto.texto && typeof texto === 'string' ? texto.replace(/\s+/g, ' ').trim().slice(0, SALA_TEXTO_DESPERTAR_MAX) : '';
  if (adjunto.texto && !limpio) return { error: 'Escribe el mensaje.' };
  const bando = adjunto.alineamiento && (alineamiento === 'bueno' || alineamiento === 'malvado') ? alineamiento : null;
  return {
    ficha: esFicha ? (ficha as FichaDespertar) : null,
    tarjeta: esTarjeta ? (tarjeta as TarjetaDespertar) : null,
    jugadores: asientos ?? [],
    personajes: elegidos ?? [],
    texto: adjunto.texto ? limpio : null,
    alineamiento: bando,
  };
}
/** Comprueba una casilla de farol: su posición y un personaje del guion (o null, para vaciarla). */
function leerFarol(sala: SalaService, datos: unknown): { error: string } | { posicion: number; personajeId: string | null } {
  const { posicion, personajeId } = (datos as { posicion?: unknown; personajeId?: unknown } | null) ?? {};
  if (typeof posicion !== 'number' || !Number.isInteger(posicion) || posicion < 0 || posicion >= NUM_FAROLES) {
    return { error: 'Esa casilla de farol no existe.' };
  }
  if (personajeId === null) return { posicion, personajeId: null };
  if (typeof personajeId !== 'string' || !sala.personaje(personajeId)) {
    return { error: 'Ese personaje no está en el guion.' };
  }
  return { posicion, personajeId };
}
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
/** Fichas de un mismo personaje como mucho en la bolsa (con el Pope). */
const MAX_REPETIDOS = 5;
/** Recordatorios como mucho en una ficha (de sobra para una partida). */
const MAX_RECORDATORIOS = 20;

/**
 * El icono de un recordatorio con texto propio: uno de los fijos o un personaje del
 * guion. Sin icono, null (el de por defecto); undefined si no vale.
 */
function leerIconoRecordatorio(sala: SalaService, icono: unknown): string | null | undefined {
  if (icono === undefined || icono === null) return null;
  if (typeof icono !== 'string') return undefined;
  return ICONOS_RECORDATORIO_TEXTO.includes(icono) || sala.personaje(icono) ? icono : undefined;
}
/** Los que van en la bolsa para repartir (también viajeros, de cualquier guion: no cuentan para el reparto por tipos). */
const TIPOS_EN_BOLSA: string[] = ['townsfolk', 'outsider', 'minion', 'demon', 'traveller'];

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

  /** Cualquiera dice si ha quitado el sonido (no oye a los demás). datos: { sinSonido: boolean }. */
  'sala:sonido': {
    puede: cualquiera,
    noPuede: '',
    hacer: (sala, yo, datos) => {
      const sinSonido = (datos as { sinSonido?: unknown } | null)?.sinSonido;
      if (typeof sinSonido !== 'boolean') return { ok: false, error: 'Estado desconocido.' };
      sala.cambiarSonido(yo.id, sinSonido);
      return { ok: true };
    },
  },

  /**
   * Un jugador o un narrador levanta o baja la mano (un muerto sin voto solo puede
   * bajarla). La del narrador no vota: es para hacerse ver. datos: { levantada: boolean }.
   */
  'sala:levantarMano': {
    puede: (_sala, yo) => yo.rol === 'jugador' || yo.rol === 'narrador',
    noPuede: 'Solo los jugadores sentados y los narradores pueden levantar la mano.',
    hacer: (sala, yo, datos) => {
      const levantada = (datos as { levantada?: unknown } | null)?.levantada;
      if (typeof levantada !== 'boolean') return { ok: false, error: 'Estado desconocido.' };
      if (levantada && yo.rol === 'jugador' && sala.sinVoto(yo.id)) return { ok: false, error: sala.voudonVivo() ? 'Con el Voudon vivo, solo votan él y los muertos.' : 'Ya has gastado tu voto: no puedes levantar la mano.' };
      sala.levantarMano(yo.id, levantada);
      return { ok: true };
    },
  },

  /**
   * Levanta las dos manos (dos votos): solo la Banshee muerta con «Has Ability».
   * Para bajarlas o dejar una, 'sala:levantarMano'.
   */
  'sala:levantarDosManos': {
    puede: (sala, yo) => yo.rol === 'jugador' && sala.puedeVotarDoble(yo.id),
    noPuede: 'Solo la Banshee con su habilidad puede levantar las dos manos.',
    hacer: (sala, yo) => {
      if (sala.sinVoto(yo.id)) return { ok: false, error: sala.voudonVivo() ? 'Con el Voudon vivo, solo votan él y los muertos.' : 'Ya has gastado tu voto: no puedes levantar la mano.' };
      sala.levantarMano(yo.id, true, true);
      return { ok: true };
    },
  },

  /**
   * Un jugador o un narrador elige la forma de su mano: una de SALA_FORMAS_MANO o un
   * personaje del guion (su icono). datos: { forma }.
   */
  /**
   * Cualquiera dice cómo se ve su mano (su «skin», de las preferencias): todos la ven
   * así. datos: { estilo } (uno de SALA_ESTILOS_MANO).
   */
  'sala:estiloMano': {
    puede: cualquiera,
    noPuede: '',
    hacer: (sala, yo, datos) => {
      const estilo = (datos as { estilo?: unknown } | null)?.estilo;
      if (typeof estilo !== 'string' || !SALA_ESTILOS_MANO.includes(estilo)) return { ok: false, error: 'Estilo de mano desconocido.' };
      sala.elegirEstiloMano(yo.id, estilo);
      return { ok: true };
    },
  },

  'sala:elegirMano': {
    puede: (_sala, yo) => yo.rol === 'jugador' || yo.rol === 'narrador',
    noPuede: 'Solo los jugadores sentados y los narradores tienen mano que levantar.',
    hacer: (sala, yo, datos) => {
      const forma = (datos as { forma?: unknown } | null)?.forma;
      if (typeof forma !== 'string' || (!SALA_FORMAS_MANO.includes(forma) && !sala.personaje(forma))) {
        return { ok: false, error: 'Forma de mano desconocida.' };
      }
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

  /**
   * Abre de noche el despertar de un asiento (también de uno libre: cuenta como un
   * jugador más), para mandarle información y que conteste. Se pueden tener
   * varios a la vez; si ya lo tiene, no hace nada. datos: { asientoId }.
   */
  'narrador:despertar': {
    puede: (sala, yo) => yo.rol === 'narrador' && sala.fase().momento === 'noche',
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'Solo se despierta a alguien de noche.' : 'Solo un narrador puede despertar a alguien.'),
    hacer: (sala, _yo, datos) => {
      const asientoId = (datos as { asientoId?: unknown } | null)?.asientoId;
      if (typeof asientoId !== 'string') return { ok: false, error: 'Ese asiento ya no existe.' };
      const error = sala.despertar(asientoId);
      return error ? { ok: false, error } : { ok: true };
    },
  },

  /**
   * Un mensaje en un despertar: el narrador manda una ficha o una tarjeta al de un
   * asiento; el jugador, solo fichas al narrador (en el suyo). datos: { asientoId
   * (solo el narrador), ficha | tarjeta, jugadores?: asientoId[], personajes?: id[],
   * texto?, alineamiento? } (según lo que lleve).
   */
  'despertar:enviar': {
    puede: (sala, yo) =>
      yo.rol === 'narrador' ? sala.despertares().length > 0 : yo.rol === 'jugador' && !!sala.asientoDespiertoDe(yo.id),
    noPuede: 'No tienes ningún despertar abierto.',
    hacer: (sala, yo, datos) => {
      const narra = yo.rol === 'narrador';
      const pedido = (datos as { asientoId?: unknown } | null)?.asientoId;
      const asientoId = narra ? (typeof pedido === 'string' ? pedido : null) : sala.asientoDespiertoDe(yo.id);
      if (!asientoId || !sala.hayDespertar(asientoId)) return { ok: false, error: 'Ese despertar ya no está abierto.' };
      const mensaje = leerMensajeDespertar(sala, datos, narra);
      if ('error' in mensaje) return { ok: false, error: mensaje.error };
      sala.enviarDespertar(asientoId, { ...mensaje, autor: narra ? 'narrador' : asientoId });
      // «Tú eres»: su ficha pasa a ser la que se le dice (con alineamiento, solo si se le dice)
      if (narra && mensaje.tarjeta === 'tuEres') sala.comunicarFicha(asientoId, mensaje.personajes, mensaje.alineamiento);
      return { ok: true };
    },
  },

  /**
   * Pone o quita la ficha recordatorio (estrella) de una fila del orden de noche,
   * para todos los narradores. datos: { id: personaje del guion | 'esbirros' | 'demonios', activo }.
   */
  'narrador:recordatorio': {
    puede: (sala, yo) => yo.rol === 'narrador' && !!sala.guion(),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'Aún no hay guion.' : 'Solo un narrador puede cambiar los recordatorios.'),
    hacer: (sala, _yo, datos) => {
      const { id, activo } = (datos as { id?: unknown; activo?: unknown } | null) ?? {};
      const valido =
        typeof id === 'string' && (id === 'esbirros' || id === 'demonios' || !!sala.guion()?.personajes.some((p) => p.id === id));
      if (!valido) return { ok: false, error: 'Ese personaje no está en el guion.' };
      if (typeof activo !== 'boolean') return { ok: false, error: 'Estado desconocido.' };
      sala.cambiarRecordatorio(id, activo);
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

  /** Suena el gong: todos oyen y ven el aviso de volver a la plaza del pueblo. */
  'narrador:sonarGong': {
    puede: (_sala, yo) => yo.rol === 'narrador',
    noPuede: 'Solo un narrador puede sonar el gong.',
    hacer: (sala) => {
      // Uno cada pocos segundos, para que no se pisen
      const ultimo = sala.gong();
      if (ultimo && Date.now() - ultimo < SALA_PAUSA_GONG_MS) return { ok: false, error: 'El gong aún está sonando.' };
      sala.sonarGong();
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
          typeof personajeId === 'string' ? sala.personaje(personajeId) : undefined;
        if (!personaje) return { ok: false, error: 'Ese personaje no está en el guion.' };
        if (!TIPOS_EN_FICHA.includes(personaje.tipo)) return { ok: false, error: 'Ese personaje no puede ir en una ficha.' };
      }
      sala.cambiarPersonaje(asientoId, personajeId as string | null);
      return { ok: true };
    },
  },

  /**
   * Con el Gardener: intercambia el personaje y el alineamiento de dos fichas
   * (arrastrando una sobre otra), mientras los personajes repartidos no se hayan
   * entregado: al entregarlos, se acaba. datos: { desde, hasta } (ids de asiento).
   */
  'narrador:intercambiarFichas': {
    puede: (sala, yo) => yo.rol === 'narrador' && sala.npcActivo(NPC_GARDENER) && sala.fichasRetenidas() && sala.asientos().length > 1,
    noPuede: (sala, yo) =>
      yo.rol !== 'narrador'
        ? 'Solo un narrador puede intercambiar las fichas.'
        : !sala.npcActivo(NPC_GARDENER)
          ? 'Las fichas solo se intercambian con el Gardener en juego.'
          : !sala.fichasRetenidas()
            ? 'Los personajes ya se han entregado: ya no se intercambian.'
            : 'Hacen falta dos asientos.',
    hacer: (sala, _yo, datos) => {
      const { desde, hasta } = (datos as { desde?: unknown; hasta?: unknown }) ?? {};
      if (typeof desde !== 'string' || typeof hasta !== 'string' || !sala.hayAsiento(desde) || !sala.hayAsiento(hasta)) {
        return { ok: false, error: 'Ese asiento ya no existe.' };
      }
      if (desde === hasta) return { ok: false, error: 'Elige otra ficha.' };
      sala.intercambiarFichas(desde, hasta);
      return { ok: true };
    },
  },

  /**
   * Pone una ficha recordatorio junto a la de un asiento: uno de los recordatorios
   * de un personaje del guion (esté en juego o no). Se pueden poner las que se quiera.
   * datos: { asientoId, personajeId, indice }.
   */
  'narrador:ponerRecordatorio': {
    puede: (sala, yo) => yo.rol === 'narrador' && sala.asientos().length > 0,
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'La mesa no tiene asientos.' : 'Solo un narrador pone recordatorios.'),
    hacer: (sala, _yo, datos) => {
      const { asientoId, personajeId, indice } = (datos as { asientoId?: unknown; personajeId?: unknown; indice?: unknown }) ?? {};
      const asiento = sala.asientos().find((a) => a.id === asientoId);
      if (!asiento || typeof asientoId !== 'string') return { ok: false, error: 'Ese asiento ya no existe.' };
      const personaje = typeof personajeId === 'string' ? sala.personaje(personajeId) : undefined;
      if (!personaje) return { ok: false, error: 'Ese personaje no está en el guion.' };
      const texto = typeof indice === 'number' && Number.isInteger(indice) ? personaje.recordatorios[indice] : undefined;
      if (texto === undefined) return { ok: false, error: 'Ese recordatorio no existe.' };
      if (asiento.recordatorios.length >= MAX_RECORDATORIOS) {
        return { ok: false, error: `Una ficha no puede llevar más de ${MAX_RECORDATORIOS} recordatorios.` };
      }
      sala.ponerRecordatorio(asientoId, { personaje: personaje.id, indice: indice as number, texto });
      return { ok: true };
    },
  },

  /**
   * Pone un recordatorio con texto propio (sin personaje): lo que escriba el
   * narrador, corto, porque va en redondo en una ficha pequeña. datos: { asientoId, texto, icono? }.
   */
  'narrador:ponerRecordatorioTexto': {
    puede: (sala, yo) => yo.rol === 'narrador' && sala.asientos().length > 0,
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'La mesa no tiene asientos.' : 'Solo un narrador pone recordatorios.'),
    hacer: (sala, _yo, datos) => {
      const { asientoId, texto, icono } = (datos as { asientoId?: unknown; texto?: unknown; icono?: unknown }) ?? {};
      const asiento = sala.asientos().find((a) => a.id === asientoId);
      if (!asiento || typeof asientoId !== 'string') return { ok: false, error: 'Ese asiento ya no existe.' };
      const limpio = typeof texto === 'string' ? texto.replace(/\s+/g, ' ').trim() : '';
      if (!limpio) return { ok: false, error: 'Escribe el texto del recordatorio.' };
      if ([...limpio].length > SALA_RECORDATORIO_TEXTO_MAX) {
        return { ok: false, error: `El recordatorio puede tener como mucho ${SALA_RECORDATORIO_TEXTO_MAX} caracteres.` };
      }
      if (asiento.recordatorios.length >= MAX_RECORDATORIOS) {
        return { ok: false, error: `Una ficha no puede llevar más de ${MAX_RECORDATORIOS} recordatorios.` };
      }
      const conIcono = leerIconoRecordatorio(sala, icono);
      if (conIcono === undefined) return { ok: false, error: 'Ese icono no está en el guion.' };
      sala.ponerRecordatorio(asientoId, { personaje: RECORDATORIO_TEXTO, indice: -1, texto: limpio, ...(conIcono ? { icono: conIcono } : {}) });
      return { ok: true };
    },
  },

  /**
   * Escribe una nota sobre un asiento (texto libre, hasta SALA_NOTAS_MAX por
   * asiento): nueva o, con `notaId`, cambia esa. Devuelve el id de la nota.
   * datos: { asientoId, notaId?, texto }.
   */
  'narrador:escribirNota': {
    puede: (sala, yo) => yo.rol === 'narrador' && sala.asientos().length > 0,
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'La mesa no tiene asientos.' : 'Solo un narrador escribe notas.'),
    hacer: (sala, _yo, datos) => {
      const { asientoId, notaId, texto } = (datos as { asientoId?: unknown; notaId?: unknown; texto?: unknown }) ?? {};
      const asiento = sala.asientos().find((a) => a.id === asientoId);
      if (!asiento || typeof asientoId !== 'string') return { ok: false, error: 'Ese asiento ya no existe.' };
      if (notaId !== undefined && notaId !== null && typeof notaId !== 'string') return { ok: false, error: 'Petición desconocida.' };
      // Se respetan los saltos de línea; solo se quitan los espacios de los extremos
      const limpio = typeof texto === 'string' ? texto.replace(/\r\n?/g, '\n').trim() : '';
      if (!limpio) return { ok: false, error: 'La nota está vacía.' };
      if (limpio.length > SALA_NOTA_LARGO_MAX) return { ok: false, error: `Una nota puede tener como mucho ${SALA_NOTA_LARGO_MAX} caracteres.` };
      if (!notaId && asiento.notas.length >= SALA_NOTAS_MAX) {
        return { ok: false, error: `Cada asiento puede tener como mucho ${SALA_NOTAS_MAX} notas.` };
      }
      const id = sala.escribirNota(asientoId, (notaId as string | undefined) ?? null, limpio);
      return id ? { ok: true, valor: id } : { ok: false, error: 'Esa nota ya no existe.' };
    },
  },

  /**
   * Envía un grimorio (el Espía, la Viuda) a quien se sienta en un asiento: una
   * copia del de la partida que el narrador puede haber cambiado. Se comprueba que
   * cada ficha sea de un asiento de la mesa y lleve personajes del guion.
   * datos: { asientoId, fichas: SalaFichaEnviada[], faroles?: string[] }.
   */
  'narrador:enviarGrimorio': {
    puede: (sala, yo) => yo.rol === 'narrador' && sala.asientos().some((a) => a.ocupante),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'No hay nadie sentado.' : 'Solo un narrador envía el grimorio.'),
    hacer: (sala, _yo, datos) => {
      const { asientoId, fichas } = (datos as { asientoId?: unknown; fichas?: unknown }) ?? {};
      const destino = sala.asientos().find((a) => a.id === asientoId);
      if (!destino || typeof asientoId !== 'string') return { ok: false, error: 'Ese asiento ya no existe.' };
      if (!destino.ocupante) return { ok: false, error: 'En ese asiento no hay nadie a quien enviárselo.' };
      if (!Array.isArray(fichas) || fichas.length > SALA_ASIENTOS.max) return { ok: false, error: 'El grimorio no es válido.' };
      const mesa = new Set(sala.asientos().map((a) => a.id));
      const limpias: SalaFichaEnviada[] = [];
      for (const f of fichas as Record<string, unknown>[]) {
        if (!f || typeof f.asientoId !== 'string' || !mesa.has(f.asientoId)) return { ok: false, error: 'El grimorio no es válido.' };
        const personaje = f.personaje === null ? null : typeof f.personaje === 'string' && sala.personaje(f.personaje) ? f.personaje : undefined;
        if (personaje === undefined) return { ok: false, error: 'Hay un personaje que no está en el guion.' };
        const alineamiento = f.alineamiento === 'bueno' || f.alineamiento === 'malvado' ? f.alineamiento : null;
        const recordatorios = Array.isArray(f.recordatorios) ? (f.recordatorios as Record<string, unknown>[]) : [];
        if (recordatorios.length > MAX_RECORDATORIOS) return { ok: false, error: 'Hay una ficha con demasiados recordatorios.' };
        const limpios = [];
        for (const r of recordatorios) {
          const texto = typeof r?.texto === 'string' ? r.texto.replace(/\s+/g, ' ').trim() : '';
          if (r?.personaje === RECORDATORIO_TEXTO) {
            if (!texto || [...texto].length > SALA_RECORDATORIO_TEXTO_MAX) return { ok: false, error: 'Hay un recordatorio con un texto no válido.' };
            const icono = leerIconoRecordatorio(sala, r.icono);
            if (icono === undefined) return { ok: false, error: 'Hay un recordatorio con un icono que no está en el guion.' };
            limpios.push({ id: randomUUID(), personaje: RECORDATORIO_TEXTO, indice: -1, texto, ...(icono ? { icono } : {}) });
            continue;
          }
          const del = typeof r?.personaje === 'string' ? sala.personaje(r.personaje) : undefined;
          const indice = typeof r?.indice === 'number' && Number.isInteger(r.indice) ? r.indice : -1;
          const original = del?.recordatorios[indice];
          if (!del || original === undefined) return { ok: false, error: 'Hay un recordatorio que no está en el guion.' };
          limpios.push({ id: randomUUID(), personaje: del.id, indice, texto: original });
        }
        limpias.push({ asientoId: f.asientoId, personaje, alineamiento, muerto: f.muerto === true, recordatorios: limpios });
      }
      // Los faroles del demonio (los que el narrador haya dejado en la copia)
      const faroles = (datos as { faroles?: unknown }).faroles ?? [];
      if (!Array.isArray(faroles) || faroles.length > NUM_FAROLES) return { ok: false, error: 'Los faroles no son válidos.' };
      if (faroles.some((id) => typeof id !== 'string' || !sala.personaje(id))) return { ok: false, error: 'Hay un farol que no está en el guion.' };
      sala.enviarGrimorio(asientoId, limpias, faroles as string[]);
      return { ok: true };
    },
  },

  /** Borra una nota de un asiento. datos: { asientoId, notaId }. */
  'narrador:borrarNota': {
    puede: esNarrador,
    noPuede: 'Solo un narrador borra notas.',
    hacer: (sala, _yo, datos) => {
      const { asientoId, notaId } = (datos as { asientoId?: unknown; notaId?: unknown }) ?? {};
      if (typeof asientoId !== 'string' || typeof notaId !== 'string') return { ok: false, error: 'Petición desconocida.' };
      sala.borrarNota(asientoId, notaId);
      return { ok: true };
    },
  },

  /** Quita una ficha recordatorio. datos: { asientoId, recordatorioId }. */
  'narrador:quitarRecordatorio': {
    puede: esNarrador,
    noPuede: 'Solo un narrador quita recordatorios.',
    hacer: (sala, _yo, datos) => {
      const { asientoId, recordatorioId } = (datos as { asientoId?: unknown; recordatorioId?: unknown }) ?? {};
      if (typeof asientoId !== 'string' || typeof recordatorioId !== 'string') return { ok: false, error: 'Petición desconocida.' };
      sala.quitarRecordatorio(asientoId, recordatorioId);
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
      const personaje = typeof personajeId === 'string' ? sala.personaje(personajeId) : undefined;
      if (!personaje) return { ok: false, error: 'Ese personaje no está en el guion.' };
      if (!TIPOS_EN_BOLSA.includes(personaje.tipo)) {
        return { ok: false, error: 'En la bolsa solo van aldeanos, forasteros, esbirros, demonios y viajeros.' };
      }
      sala.alternarEnBolsa(personaje.id);
      return { ok: true };
    },
  },

  /**
   * Cuántas fichas de un personaje hay en la bolsa (0 la saca). Más de una, solo
   * con el Pope en juego y de personajes buenos (aldeanos y forasteros).
   * datos: { personajeId, cantidad }.
   */
  'narrador:bolsaCantidad': {
    puede: (sala, yo) => yo.rol === 'narrador' && !!sala.guion(),
    noPuede: (_sala, yo) => (yo.rol !== 'narrador' ? 'Solo un narrador puede preparar la bolsa.' : 'Antes hay que elegir un guion.'),
    hacer: (sala, _yo, datos) => {
      const { personajeId, cantidad } = (datos as { personajeId?: unknown; cantidad?: unknown } | null) ?? {};
      const personaje = typeof personajeId === 'string' ? sala.personaje(personajeId) : undefined;
      if (!personaje || !TIPOS_EN_BOLSA.includes(personaje.tipo)) return { ok: false, error: 'Ese personaje no va en la bolsa.' };
      if (typeof cantidad !== 'number' || !Number.isInteger(cantidad) || cantidad < 0 || cantidad > MAX_REPETIDOS) {
        return { ok: false, error: 'Cantidad desconocida.' };
      }
      const bueno = personaje.tipo === 'townsfolk' || personaje.tipo === 'outsider';
      if (cantidad > 1 && !(bueno && sala.npcActivo(NPC_POPE))) {
        return { ok: false, error: 'Solo con el Pope puede haber aldeanos o forasteros repetidos.' };
      }
      sala.ponerEnBolsa(personaje.id, cantidad);
      return { ok: true };
    },
  },

  /** Vacía la bolsa: saca todos los personajes (también los viajeros). */
  'narrador:vaciarBolsa': {
    puede: esNarrador,
    noPuede: 'Solo un narrador puede preparar la bolsa.',
    hacer: (sala) => {
      sala.vaciarBolsa();
      return { ok: true };
    },
  },

  /**
   * Llena la bolsa de una vez (el narrador la ha llenado al azar): sustituye sus
   * aldeanos, forasteros, esbirros y demonios por estos; los viajeros se quedan.
   * Repetidos, solo buenos y con el Pope. datos: { personajes: string[] }.
   */
  'narrador:llenarBolsa': {
    puede: (sala, yo) => yo.rol === 'narrador' && !!sala.guion(),
    noPuede: (_sala, yo) => (yo.rol !== 'narrador' ? 'Solo un narrador puede preparar la bolsa.' : 'Antes hay que elegir un guion.'),
    hacer: (sala, _yo, datos) => {
      const ids = (datos as { personajes?: unknown } | null)?.personajes;
      if (!Array.isArray(ids) || ids.length > 100 || ids.some((id) => typeof id !== 'string')) {
        return { ok: false, error: 'Personajes desconocidos.' };
      }
      const vistos = new Set<string>();
      for (const id of ids as string[]) {
        const personaje = sala.personaje(id);
        if (!personaje || personaje.tipo === 'traveller' || !TIPOS_EN_BOLSA.includes(personaje.tipo)) {
          return { ok: false, error: 'En la bolsa al azar solo van aldeanos, forasteros, esbirros y demonios del guion.' };
        }
        const bueno = personaje.tipo === 'townsfolk' || personaje.tipo === 'outsider';
        if (vistos.has(id) && !(bueno && sala.npcActivo(NPC_POPE))) {
          return { ok: false, error: 'Solo con el Pope puede haber aldeanos o forasteros repetidos.' };
        }
        vistos.add(id);
      }
      sala.reemplazarBolsa(ids as string[]);
      return { ok: true };
    },
  },

  /** Con el Gardener: entrega a los jugadores los personajes ya repartidos. */
  'narrador:entregarFichas': {
    puede: (sala, yo) => yo.rol === 'narrador' && sala.fichasRetenidas(),
    noPuede: 'No hay personajes por entregar.',
    hacer: (sala) => {
      // Lo que hay ahora en las fichas (el narrador puede haberlas cambiado tras repartir)
      sala.entregarFichas();
      return { ok: true };
    },
  },

  /**
   * Las reglas del Bootlegger (con él en juego): una por elemento; null o vacío
   * vuelve a las del guion. datos: { reglas: string[] | null }.
   */
  'narrador:bootlegger': {
    puede: (sala, yo) => yo.rol === 'narrador' && sala.npcActivo(NPC_BOOTLEGGER),
    noPuede: 'Solo un narrador, con el Bootlegger en juego, escribe sus reglas.',
    hacer: (sala, _yo, datos) => {
      const reglas = (datos as { reglas?: unknown } | null)?.reglas;
      if (reglas !== null && !Array.isArray(reglas)) return { ok: false, error: 'Reglas desconocidas.' };
      const limpias = (reglas ?? [])
        .filter((r): r is string => typeof r === 'string')
        .map((r) => r.replace(/\s+/g, ' ').trim().slice(0, 600))
        .filter(Boolean)
        .slice(0, 20);
      sala.escribirBootlegger(reglas === null ? null : limpias);
      return { ok: true };
    },
  },

  /**
   * El personaje bueno que nombra el Storm Catcher (con él en juego), o null.
   * datos: { personajeId: string | null }.
   */
  'narrador:stormcatcher': {
    puede: (sala, yo) => yo.rol === 'narrador' && sala.npcActivo(NPC_STORMCATCHER),
    noPuede: 'Solo un narrador, con el Storm Catcher en juego, nombra su personaje.',
    hacer: (sala, _yo, datos) => {
      const personajeId = (datos as { personajeId?: unknown } | null)?.personajeId;
      if (personajeId === null) {
        sala.nombrarStormcatcher(null);
        return { ok: true };
      }
      const personaje = typeof personajeId === 'string' ? sala.personaje(personajeId) : undefined;
      if (!personaje || (personaje.tipo !== 'townsfolk' && personaje.tipo !== 'outsider')) {
        return { ok: false, error: 'El Storm Catcher nombra un personaje bueno (aldeano o forastero).' };
      }
      sala.nombrarStormcatcher(personaje.id);
      return { ok: true };
    },
  },

  /**
   * Pide silencio a todos (o lo levanta): los jugadores no pueden emitir su
   * micrófono. Solo con el Bibliotecario del Infierno en juego. datos: { activo }.
   */
  'narrador:silencio': {
    puede: (sala, yo) => yo.rol === 'narrador' && sala.npcs().includes(NPC_SILENCIO),
    noPuede: (_sala, yo) =>
      yo.rol !== 'narrador' ? 'Solo un narrador pide silencio.' : 'Solo se pide silencio con el Bibliotecario del Infierno en juego.',
    hacer: (sala, _yo, datos) => {
      const activo = (datos as { activo?: unknown } | null)?.activo;
      if (typeof activo !== 'boolean') return { ok: false, error: 'Petición desconocida.' };
      sala.pedirSilencio(activo);
      return { ok: true };
    },
  },

  /**
   * Da por bueno el reparto aunque no cuadre con las reglas (el narrador se sale del
   * guion a propósito), o deja de darlo (null). datos: { firma: string | null }.
   */
  'narrador:aceptarSetup': {
    puede: esNarrador,
    noPuede: 'Solo un narrador da por bueno el reparto.',
    hacer: (sala, _yo, datos) => {
      const firma = (datos as { firma?: unknown } | null)?.firma;
      if (firma !== null && (typeof firma !== 'string' || firma.length > 100)) return { ok: false, error: 'Reparto desconocido.' };
      sala.aceptarSetup(firma);
      return { ok: true };
    },
  },

  /**
   * Pone en juego un NPC (un legendario o un lórico, del guion o del catálogo), o
   * lo quita si ya estaba. Lo ven todos. datos: { personajeId }.
   */
  'narrador:npc': {
    puede: (sala, yo) => yo.rol === 'narrador' && !!sala.guion(),
    noPuede: (_sala, yo) => (yo.rol !== 'narrador' ? 'Solo un narrador pone NPCs en juego.' : 'Antes hay que elegir un guion.'),
    hacer: (sala, _yo, datos) => {
      const personajeId = (datos as { personajeId?: unknown } | null)?.personajeId;
      const personaje = typeof personajeId === 'string' ? sala.personaje(personajeId) : undefined;
      if (!personaje) return { ok: false, error: 'Ese personaje no existe.' };
      if (!TIPOS_NPC.includes(personaje.tipo as TipoPersonaje)) {
        return { ok: false, error: 'Como NPC solo van legendarios y lóricos.' };
      }
      sala.alternarNpc(personaje.id);
      return { ok: true };
    },
  },

  /**
   * Pone un personaje del guion en una casilla de los faroles que el narrador
   * prepara para el demonio, o la vacía. datos: { posicion: 0..2, personajeId: string | null }.
   */
  'narrador:farol': {
    puede: (sala, yo) => yo.rol === 'narrador' && !!sala.guion(),
    noPuede: (_sala, yo) => (yo.rol !== 'narrador' ? 'Solo un narrador prepara los faroles.' : 'Antes hay que elegir un guion.'),
    hacer: (sala, _yo, datos) => {
      const farol = leerFarol(sala, datos);
      if ('error' in farol) return { ok: false, error: farol.error };
      sala.ponerFarol(farol.posicion, farol.personajeId);
      return { ok: true };
    },
  },

  /**
   * Un jugador se pone (o se quita) un farol en una de sus casillas, tenga grimorio
   * o no. datos: { posicion: 0..2, personajeId: string | null }.
   */
  'jugador:farol': {
    puede: (sala, yo) => yo.rol === 'jugador' && !!sala.asientoDe(yo.id) && !!sala.guion(),
    noPuede: 'Solo un jugador sentado se pone faroles.',
    hacer: (sala, yo, datos) => {
      const asiento = sala.asientoDe(yo.id);
      if (!asiento) return { ok: false, error: 'Ya no estás sentado.' };
      const farol = leerFarol(sala, datos);
      if ('error' in farol) return { ok: false, error: farol.error };
      sala.ponerFarolAsiento(asiento.id, farol.posicion, farol.personajeId);
      return { ok: true };
    },
  },

  /**
   * El jugador despierto copia en sus faroles los personajes que el narrador le
   * ha enseñado con «Estos personajes no están en juego». datos: { personajes: id[] }
   * (los de esa tarjeta, que tiene que estar en su despertar).
   */
  'jugador:copiarFaroles': {
    puede: (sala, yo) => yo.rol === 'jugador' && !!sala.asientoDespiertoDe(yo.id),
    noPuede: 'No tienes ningún despertar abierto.',
    hacer: (sala, yo, datos) => {
      const asientoId = sala.asientoDespiertoDe(yo.id);
      const personajes = (datos as { personajes?: unknown } | null)?.personajes;
      if (!asientoId || !Array.isArray(personajes)) return { ok: false, error: 'No hay faroles que copiar.' };
      const mismos = (m: MensajeDespertar) =>
        m.autor === 'narrador' &&
        m.tarjeta === 'noEnJuego' &&
        m.personajes.length === personajes.length &&
        m.personajes.every((id, i) => id === personajes[i]);
      const hilo = sala.despertares().find((d) => d.asiento === asientoId);
      if (!hilo?.mensajes.some(mismos)) return { ok: false, error: 'El narrador no te ha enseñado esos personajes.' };
      sala.copiarFaroles(asientoId, (personajes as string[]).slice(0, NUM_FAROLES));
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
      // Con el Gardener, los jugadores no los ven hasta que el narrador los entregue
      if (sala.npcActivo(NPC_GARDENER)) sala.retenerFichas(true);
      else sala.entregarFichas();
      return { ok: true };
    },
  },

  /**
   * Revelar el grimorio (final de la partida): el narrador dice qué bando ha
   * ganado y todas las fichas se dan la vuelta. datos: { ganador: 'bueno' | 'malvado', causas?: string[] }
   * (ver CAUSAS_FIN_PARTIDA: lo que ha pasado con los personajes de la lista en juego).
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
      const { ganador, causas = [] } = (datos as { ganador?: unknown; causas?: unknown } | null) ?? {};
      if (ganador !== 'bueno' && ganador !== 'malvado') return { ok: false, error: 'Bando desconocido.' };
      // Lo que ha pasado: solo de los personajes de la lista que están en juego (quien es de verdad cada uno)
      const enJuego = new Set(sala.asientos().map((a) => sala.identidad(a)));
      if (!Array.isArray(causas) || causas.some((c) => typeof c !== 'string' || !CAUSAS_FIN_PARTIDA.includes(c) || !enJuego.has(c))) {
        return { ok: false, error: 'Hay un personaje que no está en juego.' };
      }
      sala.empezarRevelacion(ganador, [...new Set(causas as string[])]);
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

  /**
   * Cambia el fondo de la sala (para todos). datos: { predeterminado: true }
   * (el de por defecto), { imagen: data URL } (subida desde el ordenador) o
   * { biblioteca: id de la versión de una imagen pública de la Biblioteca } (se
   * copia). De la Biblioteca solo vale lo público, aunque el narrador tenga cuenta:
   * lo que pide registro no se puede poner a la vista de toda la partida.
   */
  'narrador:cambiarFondo': {
    puede: esNarrador,
    noPuede: 'Solo un narrador puede cambiar el fondo de la sala.',
    hacer: async (sala, _yo, datos, deps) => {
      const { predeterminado, imagen, biblioteca } = (datos as Record<string, unknown>) ?? {};
      if (predeterminado === true) {
        sala.configurar({ fondo: null });
        return { ok: true };
      }
      let bytes: Buffer | null = null;
      if (imagen !== undefined) {
        bytes = datosDeDataUrl(imagen);
        if (!bytes) return { ok: false, error: 'La imagen no es válida (JPEG, PNG o WebP).' };
      } else if (typeof biblioteca === 'string') {
        try {
          bytes = await deps.imagenesBiblioteca.leerPublica(biblioteca);
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : 'No se ha podido leer la imagen.' };
        }
      } else {
        return { ok: false, error: 'Fondo desconocido.' };
      }
      const guardado = guardarFondoSala(bytes);
      if ('error' in guardado) return { ok: false, error: guardado.error };
      sala.configurar({ fondo: guardado.ruta });
      return { ok: true, valor: guardado.ruta };
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

  /**
   * Mata o revive la ficha de un asiento (haya alguien sentado o no). De noche, matar
   * deja la muerte pendiente (ver SalaService.cambiarVida). datos: { asientoId, muerto: boolean }.
   */
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

  /**
   * Hace efectiva la muerte pendiente de un asiento (la de la noche): el narrador la
   * anuncia y ya la ven todos. datos: { asientoId }.
   */
  'narrador:confirmarMuerte': {
    puede: (sala, yo) => yo.rol === 'narrador' && sala.asientos().some((a) => a.muertePendiente),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'No hay ninguna muerte por anunciar.' : 'Solo un narrador puede anunciar una muerte.'),
    hacer: (sala, _yo, datos) => {
      const asientoId = (datos as { asientoId?: unknown } | null)?.asientoId;
      if (typeof asientoId !== 'string' || !sala.hayAsiento(asientoId)) return { ok: false, error: 'Ese asiento ya no existe.' };
      if (!sala.confirmarMuerte(asientoId)) return { ok: false, error: 'Esa ficha no tiene una muerte por anunciar.' };
      return { ok: true };
    },
  },

  /**
   * Quita o devuelve a mano el voto de un muerto (el que le queda): se apaga o se
   * enciende su vela. datos: { asientoId, gastado: boolean }.
   */
  'narrador:cambiarVoto': {
    puede: (sala, yo) => yo.rol === 'narrador' && sala.asientos().some((a) => a.muerto),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'No hay ningún muerto.' : 'Solo un narrador quita o devuelve votos.'),
    hacer: (sala, _yo, datos) => {
      const { asientoId, gastado } = (datos as { asientoId?: unknown; gastado?: unknown }) ?? {};
      if (typeof asientoId !== 'string' || !sala.hayAsiento(asientoId)) return { ok: false, error: 'Ese asiento ya no existe.' };
      if (typeof gastado !== 'boolean') return { ok: false, error: 'Estado desconocido.' };
      if (!sala.cambiarVoto(asientoId, gastado)) return { ok: false, error: 'Solo los muertos tienen un voto que quitar o devolver.' };
      return { ok: true };
    },
  },

  /** El Barquero (con él en juego): todos los muertos recuperan su voto. */
  'narrador:barquero': {
    puede: (sala, yo) => yo.rol === 'narrador' && sala.npcActivo(NPC_FERRYMAN),
    noPuede: 'Solo un narrador, con el Barquero en juego, devuelve los votos a los muertos.',
    hacer: (sala) => {
      if (sala.devolverVotos() === 0) return { ok: false, error: 'Ningún muerto ha gastado su voto.' };
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
