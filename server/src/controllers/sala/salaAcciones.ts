import { randomUUID } from 'crypto';
import { ChatRepository } from '../../repositories/ChatRepository';
import { datosDeDataUrl, guardarFondoSala } from '../../infra/almacenamiento/salaFondoStorage';
import { ProveedorVideo } from '../../services/videollamada/ProveedorVideo';
import { MENSAJES_PRIVADOS, MensajesPrivados } from '../../contrato/chat';
import { limpiarAvatarSala, limpiarNombreSala, type Participante } from '../../models/sala/Participantes';
import { SALA_RELOJ } from '../../models/partida/RelojSala';
import type { SalaDeJuego } from '../../services/SalaDeJuego';
import { SALA_ASIENTOS } from '../../models/sala/Sala';
import { SALA_SEGUNDOS_POR_FICHA, type Configuracion } from '../../models/partida/Configuracion';
import { identidadDe } from '../../models/partida/Grimorio';
import {
  NPC_BOOTLEGGER,
  NPC_FERRYMAN,
  NPC_GARDENER,
  NPC_POPE,
  NPC_SILENCIO,
  NPC_STORMCATCHER,
} from '../../models/partida/personajesEspeciales';
import {
  GUIONES_NARRADOR_VIRTUAL,
  JUGADORES_NARRADOR_VIRTUAL,
  NARRADORES_VIRTUALES,
  type GuionNarradorVirtual,
  type IdNarradorVirtual,
} from '../../contrato/narradorVirtual';
import { SALA_SENALAMIENTO } from '../../contrato/partida';
import { type ResultadoAccion } from '../../contrato/sala';
import {
  ADJUNTOS_DESPERTAR,
  FICHAS_DESPERTAR,
  FICHAS_RESPUESTA_GUIADA,
  FichaDespertar,
  MensajeDespertar,
  EleccionDespertar,
  EnvioDespertar,
  TARJETAS_DESPERTAR,
  TarjetaDespertar,
} from '../../contrato/despertar';
import {
  ICONOS_RECORDATORIO_TEXTO,
  RECORDATORIO_TEXTO,
  SALA_NOTA_LARGO_MAX,
  SALA_RECORDATORIO_TEXTO_MAX,
  FichaEnviadaDto,
} from '../../contrato/grimorio';
import { NUM_FAROLES } from '../../contrato/jugador';
import { SALA_ESTILOS_MANO, SALA_FORMAS_MANO, FormaMano } from '../../contrato/participante';
import { CAUSAS_DE_ESBIRRO, CAUSAS_FIN_PARTIDA } from '../../contrato/partida';
import { guardarAvatarSala } from '../../infra/almacenamiento/salaAvatarStorage';
import { GuionResuelto, PersonajeDeGuion, TIPOS_NPC, TipoPersonaje } from '../../models/guiones';
import { GuionInvalidoError } from '../../models/guiones/errores';
import type { RegistroPartida } from '../../models/estadisticas/SeguimientoPartida';
import type { AccionSuelta, ServicioNarradorVirtual } from '../../services/narradorVirtual/NarradorVirtualService';
import type { Azar, ClienteJev, DatosJev, Temporizador } from '../../models/narradorVirtual/puertos';
import type { AccionJugador } from '../../models/narradorVirtual/etapas/Etapa';
import { diaVirtual, noPuedeNominar, nominoHoy } from '../../models/narradorVirtual/dia/reglasDia';


/** Lo que devuelve una acción: el resultado y, si saca a alguien de la sala, qué conexiones cerrar. */
export type SalaEfecto = ResultadoAccion & { expulsar?: string[] };

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
  /** El narrador virtual de la sala (lo pone la sala al iniciarse); sin esto, no se puede añadir. */
  narradorVirtual?: ServicioNarradorVirtual;
  /** El reloj y el azar del narrador virtual (en los tests, unos que no esperan y con semilla); si no, los de verdad. */
  relojNarradorVirtual?: Temporizador;
  azarNarradorVirtual?: Azar;
  /**
   * Para Jarvis: el modelo que ha puesto cada usuario (comprobado alguna vez), o
   * null si no lo tiene; y cómo hablar con él (en los tests, uno falso). Sin esto, no hay Jarvis.
   */
  modeloJarvisDe?: (userId: string) => Promise<DatosJev | null>;
  clienteJev?: (datos: DatosJev) => ClienteJev & { comprobar(): Promise<string | null> };
  /** Las bolsas del narrador virtual en las últimas partidas de cada usuario; sin esto, no se tienen en cuenta. */
  bolsasRecientes?: { de(userId: string): Promise<string[][]>; apuntar(userId: string, personajes: string[]): Promise<void> };
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
  puede: (juego: SalaDeJuego, yo: Participante) => boolean;
  /** Mensaje cuando no puede. */
  noPuede: string | ((juego: SalaDeJuego, yo: Participante) => string);
  /** La ejecuta; solo valida los datos que recibe, no los permisos. */
  hacer: (juego: SalaDeJuego, yo: Participante, datos: unknown, deps: DependenciasSala) => SalaEfecto | Promise<SalaEfecto>;
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
  juego: SalaDeJuego,
  datos: unknown,
  conTarjetas: boolean,
): { error: string } | EnvioDespertar {
  const { sala, partida } = juego;
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
  if (adjunto.jugadores && (!asientos?.length || asientos.some((a) => !sala.jugador(a)))) {
    return { error: 'Elige al menos un jugador.' };
  }
  const elegidos = adjunto.personajes ? ids(personajes) : [];
  if (adjunto.personajes && (!elegidos?.length || elegidos.some((id) => !partida.guion.personaje(id)))) {
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
/** Si lo elegido no es lo que pide la habilidad (cuántos y si puede elegirse a sí mismo): el error, o null. */
/** A qué asientos manda el narrador: `jugadorIds` (sin repetir) o, si no, `jugadorId`. */
function asientosDelEnvio(datos: unknown): string[] {
  const { jugadorId, jugadorIds } = (datos as { jugadorId?: unknown; jugadorIds?: unknown } | null) ?? {};
  if (Array.isArray(jugadorIds)) return jugadorIds.every((id) => typeof id === 'string') ? [...new Set(jugadorIds as string[])] : [];
  return typeof jugadorId === 'string' ? [jugadorId] : [];
}
function errorDeEleccion(pide: EleccionDespertar, mensaje: { ficha: FichaDespertar | null; jugadores: string[] }, jugadorId: string): string | null {
  const cuantos = pide.cantidad === 1 ? 'un jugador' : `${pide.cantidad} jugadores`;
  if (mensaje.ficha !== 'jugador' || mensaje.jugadores.length !== pide.cantidad) return `Elige ${cuantos}.`;
  if (!pide.puedeElegirse && mensaje.jugadores.includes(jugadorId)) return 'No puedes elegirte a ti.';
  return null;
}
/** Comprueba una casilla de farol: su posición y un personaje del guion (o null, para vaciarla). */
function leerFarol(juego: SalaDeJuego, datos: unknown): { error: string } | { posicion: number; personajeId: string | null } {
  const { partida } = juego;
  const { posicion, personajeId } = (datos as { posicion?: unknown; personajeId?: unknown } | null) ?? {};
  if (typeof posicion !== 'number' || !Number.isInteger(posicion) || posicion < 0 || posicion >= NUM_FAROLES) {
    return { error: 'Esa casilla de farol no existe.' };
  }
  if (personajeId === null) return { posicion, personajeId: null };
  if (typeof personajeId !== 'string' || !partida.guion.personaje(personajeId)) {
    return { error: 'Ese personaje no está en el guion.' };
  }
  return { posicion, personajeId };
}
const esNarrador = (_juego: SalaDeJuego, yo: Participante) => yo.rol === 'narrador';

/** Lo que pide un jugador al narrador virtual en el día: se lo pasa (ya comprobado que puede). */
const alNarradorVirtual =
  (accion: AccionJugador | AccionSuelta) =>
  async (_juego: SalaDeJuego, yo: Participante, datos: unknown, deps: DependenciasSala): Promise<SalaEfecto> => {
    if (!deps.narradorVirtual) return { ok: false, error: 'Esta sala no tiene narradores virtuales.' };
    const error = await deps.narradorVirtual.pedir(yo.id, accion, datos);
    return error ? { ok: false, error } : { ok: true };
  };

/** El turno de la nominación del narrador virtual en el que está el de ese jugador (quien nomina o el nominado). */
const enSuTurno = (juego: SalaDeJuego, yo: Participante, turno: 'acusacion' | 'defensa') => {
  const { partida, narrador } = juego;
  const n = partida.nominaciones.nominacion();
  const mio = partida.jugadorDe(yo.id)?.id;
  return narrador.actual()?.turno === turno && !!n && !!mio && (turno === 'acusacion' ? n.desde : n.hasta) === mio;
};

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
/** Fichas de un mismo personaje como mucho en la bolsa (con el Pope, o si es repetible). */
const MAX_REPETIDOS = 5;
/**
 * Si un personaje puede ir repetido en la bolsa: los repetibles («bag-duplicate»,
 * como el Village Idiot), siempre; los aldeanos y forasteros, con el Pope en juego.
 */
const puedeRepetirse = ({ partida }: SalaDeJuego, personaje: PersonajeDeGuion): boolean =>
  !!personaje.repetible ||
  ((personaje.tipo === 'townsfolk' || personaje.tipo === 'outsider') && partida.npcs.activo(NPC_POPE));
const ERROR_REPETIDOS = 'Solo con el Pope puede haber aldeanos o forasteros repetidos.';
/** Recordatorios como mucho en una ficha (de sobra para una partida). */
const MAX_RECORDATORIOS = 20;

/**
 * El icono de un recordatorio con texto propio: uno de los fijos o un personaje del
 * guion. Sin icono, null (el de por defecto); undefined si no vale.
 */
function leerIconoRecordatorio(juego: SalaDeJuego, icono: unknown): string | null | undefined {
  const { partida } = juego;
  if (icono === undefined || icono === null) return null;
  if (typeof icono !== 'string') return undefined;
  return ICONOS_RECORDATORIO_TEXTO.includes(icono) || partida.guion.personaje(icono) ? icono : undefined;
}
/** Los que van en la bolsa para repartir (también viajeros, de cualquier guion: no cuentan para el reparto por tipos). */
const TIPOS_EN_BOLSA: string[] = ['townsfolk', 'outsider', 'minion', 'demon', 'traveller'];

export const SALA_ACCIONES: Record<string, Accion> = {
  /** datos: { nombre }. Vacío: vuelve al nombre de usuario (solo con cuenta). */
  'sala:cambiarNombre': {
    puede: cualquiera,
    noPuede: '',
    hacer: (juego, yo, datos) => {
      const { sala } = juego;
      const pedido = limpiarNombreSala((datos as { nombre?: unknown } | null)?.nombre);
      const nombre = pedido || (yo.persona.tipo === 'usuario' ? sala.participantes.nombreBase(yo.id) : '');
      if (!nombre) return { ok: false, error: 'Escribe un nombre.' };
      if (sala.participantes.nombreOcupado(nombre, yo.id)) return { ok: false, error: `Ya hay alguien llamado ${nombre} en la sala.` };
      sala.participantes.renombrar(yo.id, nombre);
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
    hacer: (juego, yo, datos) => {
      const { sala } = juego;
      const pedido = (datos as { avatar?: unknown } | null)?.avatar ?? null;
      const avatar = limpiarAvatarSala(pedido);
      if (pedido !== null && !avatar) return { ok: false, error: 'Ese avatar no está disponible.' };
      sala.participantes.cambiarAvatar(yo.id, avatar);
      return { ok: true };
    },
  },

  /** Un visitante se sienta en un asiento libre y pasa a jugador. datos: { jugadorId }. */
  /** Un visitante pide ver el grimorio del narrador (los narradores lo aceptan o lo rechazan). */
  'sala:solicitarGrimorio': {
    // Con narrador virtual, lo concede él al momento
    puede: ({ sala, partida }, yo) => yo.rol === 'visitante' && partida.acceso.de(yo.id) === 'ninguno' && sala.participantes.hayNarrador(),
    noPuede: ({ partida }, yo) =>
      yo.rol !== 'visitante'
        ? 'Solo los visitantes piden ver el grimorio.'
        : partida.acceso.de(yo.id) !== 'ninguno'
          ? partida.acceso.de(yo.id) === 'concedido'
            ? 'Ya ves el grimorio.'
            : 'Ya lo has pedido.'
          : 'La sala no tiene narrador.',
    hacer: (juego, yo) => {
      const { partida } = juego;
      partida.acceso.cambiar(yo.id, 'solicitado');
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
    hacer: (juego, _yo, datos) => {
      const { sala, partida } = juego;
      const { participanteId, conceder } = (datos as { participanteId?: unknown; conceder?: unknown }) ?? {};
      const quien = typeof participanteId === 'string' ? sala.participantes.buscar(participanteId) : undefined;
      if (!quien || quien.rol !== 'visitante') return { ok: false, error: 'Esa persona ya no es visitante de la sala.' };
      if (typeof conceder !== 'boolean') return { ok: false, error: 'Respuesta desconocida.' };
      if (partida.acceso.de(quien.id) !== 'solicitado') return { ok: false, error: 'Esa persona ya no lo está pidiendo.' };
      partida.acceso.cambiar(quien.id, conceder ? 'concedido' : 'ninguno');
      return { ok: true };
    },
  },

  // Quien ve el grimorio del narrador no puede jugar: sabría los personajes de todos.
  'sala:sentarse': {
    puede: ({ partida }, yo) => yo.rol === 'visitante' && partida.acceso.de(yo.id) !== 'concedido',
    noPuede: (_sala, yo) =>
      yo.rol === 'jugador'
        ? 'Ya estás sentado.'
        : yo.rol === 'narrador'
          ? 'Los narradores no se sientan en la plaza.'
          : 'Quien ha visto el grimorio del narrador no puede sentarse en la plaza.',
    hacer: (juego, yo, datos) => {
      const { sala } = juego;
      const jugadorId = (datos as { jugadorId?: unknown } | null)?.jugadorId;
      const error = typeof jugadorId === 'string' ? sala.sentar(yo.id, jugadorId) : 'Asiento desconocido.';
      return error ? { ok: false, error } : { ok: true };
    },
  },

  /** Cualquiera dice si ha quitado el sonido (no oye a los demás). datos: { sinSonido: boolean }. */
  'sala:sonido': {
    puede: cualquiera,
    noPuede: '',
    hacer: (juego, yo, datos) => {
      const { sala } = juego;
      const sinSonido = (datos as { sinSonido?: unknown } | null)?.sinSonido;
      if (typeof sinSonido !== 'boolean') return { ok: false, error: 'Estado desconocido.' };
      sala.participantes.cambiarSonido(yo.id, sinSonido);
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
    hacer: (juego, yo, datos) => {
      const { sala, partida } = juego;
      const levantada = (datos as { levantada?: unknown } | null)?.levantada;
      if (typeof levantada !== 'boolean') return { ok: false, error: 'Estado desconocido.' };
      if (levantada && partida.manosBloqueadas(yo)) return { ok: false, error: 'Mientras se señala no se puede levantar la mano.' };
      if (levantada && yo.rol === 'jugador' && partida.sinVoto(yo.id)) return { ok: false, error: partida.voudonVivo() ? 'Con el Voudon vivo, solo votan él y los muertos.' : 'Ya has gastado tu voto: no puedes levantar la mano.' };
      sala.participantes.levantarMano(yo.id, levantada);
      return { ok: true };
    },
  },

  /**
   * Levanta las dos manos (dos votos): solo la Banshee muerta con «Has Ability».
   * Para bajarlas o dejar una, 'sala:levantarMano'.
   */
  'sala:levantarDosManos': {
    puede: ({ partida }, yo) => yo.rol === 'jugador' && partida.puedeVotarDoble(yo.id),
    noPuede: 'Solo la Banshee con su habilidad puede levantar las dos manos.',
    hacer: (juego, yo) => {
      const { sala, partida } = juego;
      if (partida.manosBloqueadas(yo)) return { ok: false, error: 'Mientras se señala no se puede levantar la mano.' };
      if (partida.sinVoto(yo.id)) return { ok: false, error: partida.voudonVivo() ? 'Con el Voudon vivo, solo votan él y los muertos.' : 'Ya has gastado tu voto: no puedes levantar la mano.' };
      sala.participantes.levantarMano(yo.id, true, true);
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
    hacer: (juego, yo, datos) => {
      const { sala } = juego;
      const estilo = (datos as { estilo?: unknown } | null)?.estilo;
      if (typeof estilo !== 'string' || !SALA_ESTILOS_MANO.includes(estilo)) return { ok: false, error: 'Estilo de mano desconocido.' };
      sala.participantes.elegirEstiloMano(yo.id, estilo);
      return { ok: true };
    },
  },

  'sala:elegirMano': {
    puede: (_sala, yo) => yo.rol === 'jugador' || yo.rol === 'narrador',
    noPuede: 'Solo los jugadores sentados y los narradores tienen mano que levantar.',
    hacer: (juego, yo, datos) => {
      const { sala, partida } = juego;
      const forma = (datos as { forma?: unknown } | null)?.forma;
      if (typeof forma !== 'string' || (!SALA_FORMAS_MANO.includes(forma) && !partida.guion.personaje(forma))) {
        return { ok: false, error: 'Forma de mano desconocida.' };
      }
      sala.participantes.elegirFormaMano(yo.id, forma as FormaMano);
      return { ok: true };
    },
  },

  /** Un jugador deja su asiento y vuelve a visitante. */
  'sala:levantarse': {
    puede: (_sala, yo) => yo.rol === 'jugador',
    noPuede: 'No estás sentado.',
    hacer: (juego, yo) => {
      const { sala } = juego;
      sala.levantar(yo.id);
      return { ok: true };
    },
  },

  /**
   * Sube una imagen propia como avatar para la sala (su perfil de la web no
   * cambia). datos: { imagen } JPEG o GIF (animado) en base64. Devuelve su ruta en `valor`.
   */
  'sala:subirAvatar': {
    puede: cualquiera,
    noPuede: '',
    hacer: (juego, yo, datos) => {
      const { sala } = juego;
      const guardado = guardarAvatarSala((datos as { imagen?: unknown } | null)?.imagen);
      if ('error' in guardado) return { ok: false, error: guardado.error };
      sala.participantes.cambiarAvatar(yo.id, guardado.ruta);
      return { ok: true, valor: guardado.ruta };
    },
  },

  'sala:hacerseNarrador': {
    puede: ({ sala }) => !sala.participantes.hayNarrador(),
    noPuede: 'La sala ya tiene narrador.',
    hacer: (juego, yo) => {
      const { sala } = juego;
      sala.participantes.cambiarRol(yo.id, 'narrador');
      return { ok: true };
    },
  },

  /**
   * En lugar de hacerse narrador, añade un narrador virtual que lleva la partida
   * solo. datos: { narrador: id de NARRADORES_VIRTUALES (disponible), guion: id de
   * GUIONES_NARRADOR_VIRTUAL, jugadores: de JUGADORES_NARRADOR_VIRTUAL.min a .max, y
   * de los que admite ese guion }.
   * Solo con cuenta: los invitados, no.
   */
  'sala:anadirNarradorVirtual': {
    puede: ({ sala }, yo) => !sala.participantes.hayNarrador() && yo.rol !== 'narrador' && yo.persona.tipo === 'usuario',
    noPuede: ({ sala }, yo) => (sala.participantes.hayNarrador() || yo.rol === 'narrador' ? 'La sala ya tiene narrador.' : 'Para añadir un narrador virtual necesitas una cuenta.'),
    hacer: async (_sala, yo, datos, { narradorVirtual }) => {
      if (!narradorVirtual) return { ok: false, error: 'Esta sala no tiene narradores virtuales.' };
      const { narrador, guion, jugadores } = (datos as Record<string, unknown>) ?? {};
      if (!NARRADORES_VIRTUALES.some((n) => n.id === narrador && n.disponible)) {
        return { ok: false, error: 'Ese narrador virtual aún no está disponible.' };
      }
      const delGuion = GUIONES_NARRADOR_VIRTUAL.find((g) => g.id === guion);
      if (!delGuion) return { ok: false, error: 'Ese guion aún no se puede jugar con narrador virtual.' };
      const { min, max } = JUGADORES_NARRADOR_VIRTUAL;
      if (typeof jugadores !== 'number' || !Number.isInteger(jugadores) || jugadores < min || jugadores > max) {
        return { ok: false, error: `Tiene que haber de ${min} a ${max} jugadores.` };
      }
      if (jugadores < delGuion.jugadores.min || jugadores > delGuion.jugadores.max) {
        return { ok: false, error: `${delGuion.nombre} es para ${delGuion.jugadores.min} a ${delGuion.jugadores.max} jugadores.` };
      }
      const error = await narradorVirtual.anadir(yo.id, {
        narrador: narrador as IdNarradorVirtual,
        guion: guion as GuionNarradorVirtual,
        jugadores,
      });
      return error ? { ok: false, error } : { ok: true };
    },
  },

  /** Quita el narrador virtual: solo quien lo añadió. */
  'sala:quitarNarradorVirtual': {
    puede: ({ narrador }, yo) => narrador.actual()?.creador === yo.id,
    noPuede: ({ narrador }) => (narrador.actual() ? 'Solo quien añadió al narrador virtual puede quitarlo.' : 'La sala no tiene narrador virtual.'),
    hacer: (_sala, _yo, _datos, { narradorVirtual }) => {
      narradorVirtual?.quitar();
      return { ok: true };
    },
  },

  /**
   * Con narrador virtual, de día: un jugador vivo nomina a otro (una vez al día, y a
   * cada uno se le nomina una vez). datos: { jugadorId } del nominado.
   */
  'jugador:nominar': {
    puede: (juego, yo) => !noPuedeNominar(juego, yo),
    noPuede: (juego, yo) => noPuedeNominar(juego, yo) ?? '',
    hacer: alNarradorVirtual('nominar'),
  },

  /** Quien nomina termina su acusación: le toca hablar al nominado. */
  'jugador:defensa': {
    puede: (juego, yo) => enSuTurno(juego, yo, 'acusacion'),
    noPuede: 'Ahora no te toca acusar.',
    hacer: alNarradorVirtual('defensa'),
  },

  /** El nominado termina su defensa: empieza la votación. */
  'jugador:voto': {
    puede: (juego, yo) => enSuTurno(juego, yo, 'defensa'),
    noPuede: 'Ahora no te toca defenderte.',
    hacer: alNarradorVirtual('voto'),
  },

  /** Listo para pasar a la noche (con narrador virtual, en las nominaciones). */
  'jugador:listo': {
    // En medio de una nominación, no: se decide al acabarla
    puede: ({ partida, narrador }, yo) =>
      narrador.actual()?.etapa === 'nominaciones' && !partida.nominaciones.nominacion() && !!partida.jugadorDe(yo.id) && !narrador.actual()!.listos.includes(yo.id),
    noPuede: 'Ahora no hay que decir si estás listo.',
    hacer: alNarradorVirtual('listo'),
  },

  /** Ya no está listo: quiere seguir nominando (quien ya ha nominado hoy, no). */
  'jugador:seguirNominando': {
    puede: (juego, yo) => {
      const { partida, narrador } = juego;
      const jugador = partida.jugadorDe(yo.id);
      return (
        narrador.actual()?.etapa === 'nominaciones' &&
        !partida.nominaciones.nominacion() &&
        !!jugador &&
        !jugador.muerto &&
        narrador.actual()!.listos.includes(yo.id) &&
        !nominoHoy(juego, jugador.id)
      );
    },
    noPuede: 'Ahora no puedes dejar de estar listo.',
    hacer: alNarradorVirtual('seguirNominando'),
  },

  /**
   * Con narrador virtual, de día: un jugador se declara Exterminador y dispara a
   * otro (una vez por partida). datos: { jugadorId }.
   */
  'jugador:exterminar': {
    puede: (juego, yo) => {
      const { partida } = juego;
      const dia = diaVirtual(juego);
      return !!dia && !!partida.jugadorDe(yo.id) && !dia.exterminadores.includes(yo.id) && !partida.nominaciones.nominacion();
    },
    noPuede: ({ narrador }, yo) => (narrador.actual()?.exterminadores.includes(yo.id) ? 'Ya has disparado en esta partida.' : 'Ahora no se puede disparar.'),
    hacer: alNarradorVirtual('exterminar'),
  },

  /**
   * Con narrador virtual: un muerto se declara Patoso (lo sea o no) y elige a un vivo,
   * mientras puede (ver NarradorVirtualDto.patosos). datos: { jugadorId } del elegido.
   */
  'jugador:patoso': {
    puede: (juego, yo) => {
      const { partida } = juego;
      const narrador = juego.narrador.actual();
      const mio = partida.jugadorDe(yo.id)?.id;
      return !!narrador && narrador.etapa !== 'revelando' && !!mio && narrador.patosos.some((p) => p.jugador === mio);
    },
    noPuede: 'Ya no puedes declararte Patoso.',
    hacer: alNarradorVirtual('patoso'),
  },

  /**
   * Con narrador virtual, de día: un jugador vivo le hace la pregunta del Artista
   * (lo sea o no; una vez por partida, salvo que le pida que la reformule). datos: {
   * texto } (libre) o { pregunta } (montada, ver contrato/artista). Contesta en
   * `valor`: 'si', 'no' o 'reformular'.
   */
  'jugador:artista': {
    puede: (juego, yo) => {
      const { partida } = juego;
      const dia = diaVirtual(juego);
      const jugador = partida.jugadorDe(yo.id);
      return !!dia && !!jugador && !jugador.muerto && !dia.artistas.includes(yo.id);
    },
    noPuede: ({ narrador }, yo) =>
      narrador.actual()?.artistas.includes(yo.id) ? 'Ya has hecho tu pregunta de Artista.' : 'Ahora no se puede preguntar como Artista.',
    hacer: async (_sala, yo, datos, { narradorVirtual }) => {
      if (!narradorVirtual) return { ok: false, error: 'Esta sala no tiene narradores virtuales.' };
      const r = await narradorVirtual.preguntarArtista(yo.id, datos);
      return 'error' in r ? { ok: false, error: r.error } : { ok: true, valor: r.respuesta };
    },
  },

  /** En la nominación, da la palabra a un participante (los demás jugadores callan) o, con null, a todos. datos: { participanteId | null }. */
  'narrador:darPalabra': {
    puede: esNarrador,
    noPuede: 'Solo un narrador da la palabra.',
    hacer: (juego, _yo, datos) => {
      const { sala, partida } = juego;
      const id = (datos as { participanteId?: unknown } | null)?.participanteId;
      if (id !== null && (typeof id !== 'string' || !sala.participantes.buscar(id))) return { ok: false, error: 'Esa persona ya no está en la sala.' };
      const error = partida.nominaciones.darPalabra(id);
      return error ? { ok: false, error } : { ok: true };
    },
  },

  /** Abre o cierra las conversaciones privadas (al cerrarlas se terminan). datos: { abiertos: boolean }. */
  'narrador:privados': {
    puede: esNarrador,
    noPuede: 'Solo un narrador abre o cierra los privados.',
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const abiertos = (datos as { abiertos?: unknown } | null)?.abiertos;
      if (typeof abiertos !== 'boolean') return { ok: false, error: 'Estado desconocido.' };
      partida.configuracion.permitirPrivados(abiertos);
      return { ok: true };
    },
  },

  'narrador:dejar': {
    puede: esNarrador,
    noPuede: 'No eres narrador.',
    hacer: (juego, yo) => {
      const { sala } = juego;
      sala.participantes.cambiarRol(yo.id, 'visitante');
      return { ok: true };
    },
  },

  /**
   * Ajustes de la partida (Preferencias > Partida). datos: cualquiera de
   * { grimorioJugadores: boolean, segundosPorFicha: número de 0,25 en 0,25,
   *   mensajes: 'ninguno' | 'vecinos' | 'todos' (mensajes privados entre jugadores),
   *   ocultarCamarasConversacion: boolean }.
   * (La cuenta atrás no se configura: siempre es de 3 a 0.)
   */
  'narrador:configurarPartida': {
    puede: esNarrador,
    noPuede: 'Solo un narrador puede cambiar los ajustes de la partida.',
    hacer: (juego, _yo, datos) => {
      const { partida, narrador } = juego;
      const { grimorioJugadores, segundosPorFicha, mensajes, ocultarCamarasConversacion } = (datos as Record<string, unknown>) ?? {};
      const cambios: Parameters<Configuracion['cambiar']>[0] = {};
      if (grimorioJugadores !== undefined) {
        if (typeof grimorioJugadores !== 'boolean') return { ok: false, error: 'Ajuste desconocido.' };
        // Con narrador virtual, los jugadores siempre tienen su grimorio
        if (!grimorioJugadores && narrador.actual()) return { ok: false, error: 'Con narrador virtual, los jugadores siempre tienen su grimorio.' };
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
        if (!MENSAJES_PRIVADOS.includes(mensajes as MensajesPrivados)) return { ok: false, error: 'Ajuste desconocido.' };
        cambios.mensajes = mensajes as MensajesPrivados;
      }
      if (ocultarCamarasConversacion !== undefined) {
        if (typeof ocultarCamarasConversacion !== 'boolean') return { ok: false, error: 'Ajuste desconocido.' };
        cambios.ocultarCamarasConversacion = ocultarCamarasConversacion;
      }
      if (Object.keys(cambios).length === 0) return { ok: false, error: 'Ajuste desconocido.' };
      partida.configuracion.cambiar(cambios);
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
    hacer: async (juego, _yo, datos, { guiones }) => {
      const { partida } = juego;
      const { predeterminado, json, archivo } = (datos as Record<string, unknown>) ?? {};
      try {
        const guion =
          typeof predeterminado === 'string'
            ? await guiones.guionPredeterminado(predeterminado)
            : await guiones.importar(json, typeof archivo === 'string' ? archivo : undefined);
        partida.cambiarGuion(guion);
        // Si el guion trae su imagen de fondo, es la de la sala (luego se puede cambiar)
        if (guion.fondo) partida.configuracion.cambiar({ fondo: guion.fondo });
        return { ok: true };
      } catch (e) {
        // Un guion inválido trae un mensaje para quien lo carga; cualquier otro fallo, no.
        if (e instanceof GuionInvalidoError) return { ok: false, error: e.message };
        console.error('[Sala] Error al cargar un guion:', e);
        return { ok: false, error: 'No se pudo cargar el guion. Inténtalo de nuevo.' };
      }
    },
  },

  /**
   * La ficha de un asiento nomina a la de otro (o a sí misma). datos: { desde, hasta
   * (ids de asiento), comoAldeano? (si quien nomina registra como aldeano: el Espía
   * que nomina a la Virgen) }. Si hace falta saberlo y no viene, no se nomina: valor
   * «comoAldeano», para volver a pedirlo con la respuesta.
   */
  'narrador:nominar': {
    // Solo de día
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.fases.actual().momento === 'dia' && partida.plaza().length >= 2,
    noPuede: ({ partida }, yo) =>
      yo.rol !== 'narrador'
        ? 'Solo un narrador puede abrir una nominación.'
        : partida.fases.actual().momento !== 'dia'
          ? 'Solo se nomina de día.'
          : 'Hacen falta al menos dos asientos.',
    hacer: (juego, _yo, datos) => {
      const { sala, partida } = juego;
      const { desde, hasta, comoAldeano } = (datos as { desde?: unknown; hasta?: unknown; comoAldeano?: unknown }) ?? {};
      if (typeof desde !== 'string' || typeof hasta !== 'string' || !sala.jugador(desde) || !sala.jugador(hasta)) {
        return { ok: false, error: 'Ese asiento ya no existe.' };
      }
      // La Virgen: si se ejecuta al momento a quien nomina, «ejecutado» o, si quedan dos vivos, «final» (ver narrador:ejecutar)
      const resultado = partida.nominar(desde, hasta, typeof comoAldeano === 'boolean' ? { comoAldeano } : {});
      if (!resultado) return { ok: true };
      if ('pregunta' in resultado) return { ok: true, valor: resultado.pregunta };
      return { ok: true, valor: resultado.final ? 'final' : 'ejecutado' };
    },
  },

  'narrador:cerrarNominacion': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && !!partida.nominaciones.nominacion(),
    noPuede: 'No hay ninguna nominación abierta.',
    hacer: (juego) => {
      const { partida } = juego;
      partida.nominaciones.cerrarNominacion();
      return { ok: true };
    },
  },

  /**
   * Cambia los votos que hacen falta en la nominación abierta. datos: { votos:
   * número entero de 1 al número de asientos, o null para volver a los de por defecto }.
   */
  'narrador:votosNecesarios': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && !!partida.nominaciones.nominacion(),
    noPuede: 'No hay ninguna nominación abierta.',
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const votos = (datos as { votos?: unknown } | null)?.votos;
      const maximo = Math.max(1, partida.plaza().length);
      if (votos !== null && (typeof votos !== 'number' || !Number.isInteger(votos) || votos < 1 || votos > maximo)) {
        return { ok: false, error: `Los votos tienen que ser de 1 a ${maximo}.` };
      }
      partida.nominaciones.elegirVotosNecesarios(votos);
      return { ok: true };
    },
  },

  /**
   * Arranca la cuenta atrás de la nominación abierta; al acabar, empieza la votación.
   * Una vez arrancada no se puede volver a pulsar (para eso está reiniciarVotacion).
   */
  'narrador:cuentaAtras': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.nominaciones.nominacion()?.cuentaAtrasFin === null && !partida.nominaciones.hayVotacion(),
    noPuede: ({ partida }) =>
      partida.nominaciones.hayVotacion()
        ? 'Esta nominación ya se ha votado.'
        : partida.nominaciones.votacionEnMarcha()
          ? 'La cuenta atrás ya está en marcha.'
          : 'No hay ninguna nominación abierta.',
    hacer: (juego) => {
      const { partida } = juego;
      partida.nominaciones.iniciarCuentaAtras(Date.now());
      return { ok: true };
    },
  },

  /** Para la cuenta atrás o la votación en marcha y deja la nominación como recién abierta. */
  'narrador:reiniciarVotacion': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.nominaciones.votacionEnMarcha(),
    noPuede: 'No hay ninguna votación en marcha.',
    hacer: (juego) => {
      const { partida } = juego;
      partida.nominaciones.reiniciarVotacion();
      return { ok: true };
    },
  },

  /**
   * Pone o quita la calavera a la ficha de un asiento (solo una puede llevarla).
   * Desde el panel de la nominación, además la cierra; desde el menú de la ficha
   * no (cerrarNominacion: false). datos: { jugadorId, marcado: boolean, cerrarNominacion?: boolean }.
   */
  'narrador:marcar': {
    // De noche no se marca a nadie: la calavera es de las ejecuciones del día
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.fases.actual().momento !== 'noche' && partida.plaza().length > 0,
    noPuede: ({ partida }, yo) =>
      yo.rol !== 'narrador'
        ? 'Solo un narrador puede marcar una ficha.'
        : partida.fases.actual().momento === 'noche'
          ? 'De noche no se marca a nadie.'
          : 'La plaza no tiene asientos.',
    hacer: (juego, _yo, datos) => {
      const { sala, partida } = juego;
      const { jugadorId, marcado, cerrarNominacion } =
        (datos as { jugadorId?: unknown; marcado?: unknown; cerrarNominacion?: unknown }) ?? {};
      if (typeof jugadorId !== 'string' || !sala.jugador(jugadorId)) return { ok: false, error: 'Ese asiento ya no existe.' };
      if (typeof marcado !== 'boolean') return { ok: false, error: 'Estado desconocido.' };
      // Si se marca al nominado de una nominación ya votada, se guardan sus votos
      // (el narrador los ve, para saber si otra votación empata).
      const n = partida.nominaciones.nominacion();
      const votos = n?.votacion?.terminada && n.hasta === jugadorId ? n.votacion.votos : null;
      partida.grimorio.marcar(jugadorId, marcado, votos);
      if (cerrarNominacion !== false) partida.nominaciones.cerrarNominacion();
      return { ok: true };
    },
  },

  /** Quita la calavera a quien la lleve (desde el panel de la nominación) y, como marcar, cierra la nominación. */
  'narrador:desmarcar': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.grimorio.hayMarca(),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'Nadie lleva la calavera.' : 'Solo un narrador puede desmarcar.'),
    hacer: (juego) => {
      const { partida } = juego;
      partida.grimorio.desmarcar();
      partida.nominaciones.cerrarNominacion();
      return { ok: true };
    },
  },

  /**
   * Anochece: desde la preparación, la noche 1; desde un día, la noche siguiente.
   * Cierra la nominación y quita la calavera y el récord de votos del día.
   */
  'narrador:irANoche': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.fases.actual().momento !== 'noche',
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'Ya es de noche.' : 'Solo un narrador puede hacer que anochezca.'),
    hacer: (juego) => {
      const { partida } = juego;
      partida.irANoche();
      return { ok: true };
    },
  },

  /**
   * La máquina del tiempo: vuelve a la fase anterior (del día N a la noche N, de la
   * noche N al día anterior o, de la noche 1, a la preparación), por si el narrador
   * se ha precipitado. Ver Partida.volverAtras.
   */
  'narrador:volverAtras': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && !!partida.fases.anterior(),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'En la preparación no hay a dónde volver.' : 'Solo un narrador puede volver atrás.'),
    hacer: ({ partida }) => (partida.volverAtras() ? { ok: true } : { ok: false, error: 'No hay a dónde volver.' }),
  },

  /**
   * Abre de noche el despertar de un asiento (también de uno libre: cuenta como un
   * jugador más), para mandarle información y que conteste. Se pueden tener
   * varios a la vez; si ya lo tiene, no hace nada. El jugador no se entera hasta
   * que el narrador le manda algo (ver Despertares.asientoDespiertoDe). datos: { jugadorId }.
   */
  'narrador:despertar': {
    // De día, solo el narrador virtual con el Violinista (el demonio elige en secreto)
    puede: ({ partida, narrador }, yo) => yo.rol === 'narrador' && (partida.fases.actual().momento === 'noche' || narrador.actual()?.etapa === 'violinista'),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'Solo se despierta a alguien de noche.' : 'Solo un narrador puede despertar a alguien.'),
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const jugadorId = (datos as { jugadorId?: unknown } | null)?.jugadorId;
      if (typeof jugadorId !== 'string') return { ok: false, error: 'Ese asiento ya no existe.' };
      const error = partida.despertares.despertar(jugadorId);
      return error ? { ok: false, error } : { ok: true };
    },
  },

  /**
   * Un mensaje en un despertar: el narrador manda una ficha o una tarjeta al de un
   * asiento (o lo mismo a varios: `jugadorIds`, y de noche se despierta a los que aún
   * no lo estaban); el jugador, solo fichas al narrador (en el suyo). datos: {
   * jugadorId | jugadorIds (solo el narrador), ficha | tarjeta, jugadores?:
   * jugadorId[], personajes?: id[], texto?, alineamiento? } (según lo que lleve).
   */
  'despertar:enviar': {
    puede: ({ partida }, yo) =>
      yo.rol === 'narrador' ? partida.despertares.despertares().length > 0 : yo.rol === 'jugador' && !!partida.despertares.asientoDespiertoDe(yo.id),
    noPuede: 'No tienes ningún despertar abierto.',
    hacer: (juego, yo, datos) => {
      const { sala, partida } = juego;
      const narra = yo.rol === 'narrador';
      const jugadorIds = narra ? asientosDelEnvio(datos) : [partida.despertares.asientoDespiertoDe(yo.id)].filter((id): id is string => !!id);
      if (!jugadorIds.length || jugadorIds.some((id) => !sala.jugador(id))) return { ok: false, error: 'Ese despertar ya no está abierto.' };
      // A uno solo, en su despertar; a varios, también a los que aún no están despiertos (de noche)
      const despiertaMas = jugadorIds.length > 1 && partida.fases.actual().momento === 'noche';
      if (!despiertaMas && jugadorIds.some((id) => !partida.despertares.hayDespertar(id))) return { ok: false, error: 'Ese despertar ya no está abierto.' };
      const mensaje = leerMensajeDespertar(juego, datos, narra);
      if ('error' in mensaje) return { ok: false, error: mensaje.error };
      // Si su habilidad le ha pedido que elija (el despertar guiado), solo contesta con
      // quienes elige. Por un asiento libre (cuenta como un jugador) elige el narrador.
      const destinos = jugadorIds.map((jugadorId) => {
        const libre = !partida.plaza().find((a) => a.id === jugadorId)?.participanteId;
        const pide = !narra || libre ? partida.guiado.eleccionPendiente(jugadorId) : null;
        return { jugadorId, pide, eligiendo: !!pide && (!narra || mensaje.ficha === 'jugador') };
      });
      for (const { jugadorId, pide, eligiendo } of destinos) {
        if (pide && eligiendo) {
          const error = errorDeEleccion(pide, mensaje, jugadorId);
          if (error) return { ok: false, error };
        }
        // A lo demás del despertar guiado, el jugador solo contesta «Entendido» o con un texto
        if (!narra && !pide && partida.despertares.respuestaGuiada(jugadorId) && !(mensaje.ficha && FICHAS_RESPUESTA_GUIADA.includes(mensaje.ficha))) {
          return { ok: false, error: 'Contesta «Entendido» o escribe un mensaje al narrador.' };
        }
      }
      for (const { jugadorId, eligiendo } of destinos) {
        if (!partida.despertares.hayDespertar(jugadorId)) partida.despertares.despertar(jugadorId);
        // «Tú eres»: su ficha pasa a ser la que se le dice (con alineamiento, solo si se le dice)
        // Lo que escribe el narrador virtual en un despertar guiado (que diga «Entendido»)
        // lo sigue siendo: el jugador sigue contestando solo «Entendido» o un texto
        if (narra) partida.mandarDelNarrador(jugadorId, mensaje, { guiado: yo.persona.tipo === 'virtual' && partida.despertares.respuestaGuiada(jugadorId) });
        else partida.despertares.enviar(jugadorId, { ...mensaje, autor: jugadorId });
        if (eligiendo) partida.guiado.alElegir(jugadorId, mensaje.jugadores);
        // Entendido lo anterior (lo dice el jugador, o el narrador a lo que eligió): le llega lo siguiente de su cola
        if (mensaje.ficha === 'entendido') partida.guiado.alEntender(jugadorId);
      }
      return { ok: true };
    },
  },

  /**
   * El despertar guiado (ver HabilidadNocheDto): despierta al de una fila del orden
   * de noche según su habilidad, si está listo. datos: { personajeId }.
   */
  'narrador:despertarHabilidad': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.fases.actual().momento === 'noche',
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'Solo se despierta a alguien de noche.' : 'Solo un narrador puede despertar a alguien.'),
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const personajeId = (datos as { personajeId?: unknown } | null)?.personajeId;
      if (typeof personajeId !== 'string') return { ok: false, error: 'Ese personaje no se despierta solo.' };
      const error = partida.guiado.despertar(personajeId);
      return error ? { ok: false, error } : { ok: true };
    },
  },

  /**
   * El despertar guiado, revisado: el narrador manda lo que ha decidido (una de las
   * opciones, o cambiada) al de una fila que había que revisar. datos: { personajeId,
   * ficha | tarjeta, jugadores?, personajes?, texto?, alineamiento? }.
   */
  'narrador:resolverHabilidad': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.fases.actual().momento === 'noche',
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'Solo se despierta a alguien de noche.' : 'Solo un narrador puede despertar a alguien.'),
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const personajeId = (datos as { personajeId?: unknown } | null)?.personajeId;
      if (typeof personajeId !== 'string') return { ok: false, error: 'Ese personaje no se despierta solo.' };
      const mensaje = leerMensajeDespertar(juego, datos, true);
      if ('error' in mensaje) return { ok: false, error: mensaje.error };
      const error = partida.guiado.resolver(personajeId, mensaje);
      return error ? { ok: false, error } : { ok: true };
    },
  },

  /** El Imp se ha elegido a sí mismo: el narrador dice quién es el nuevo. datos: { jugadorId }. */
  'narrador:nuevoImp': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && !!partida.guiado.nuevoImp(),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'No hay que elegir un nuevo Imp.' : 'Solo un narrador elige al nuevo Imp.'),
    hacer: (juego, _yo, datos) => {
      const { sala, partida } = juego;
      const jugadorId = (datos as { jugadorId?: unknown } | null)?.jugadorId;
      if (typeof jugadorId !== 'string' || !sala.jugador(jugadorId)) return { ok: false, error: 'Ese asiento ya no existe.' };
      const error = partida.guiado.elegirNuevoImp(jugadorId);
      return error ? { ok: false, error } : { ok: true };
    },
  },

  /**
   * Pone o quita la ficha recordatorio (estrella) de una fila del orden de noche,
   * para todos los narradores. datos: { id: personaje del guion | 'esbirros' | 'demonios', activo }.
   */
  'narrador:recordatorio': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && !!partida.guion.actual(),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'Aún no hay guion.' : 'Solo un narrador puede cambiar los recordatorios.'),
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const { id, activo } = (datos as { id?: unknown; activo?: unknown } | null) ?? {};
      // sala.personaje también encuentra viajeros y NPCs, que no van en guion.personajes
      const valido = typeof id === 'string' && (id === 'esbirros' || id === 'demonios' || !!partida.guion.personaje(id));
      if (!valido) return { ok: false, error: 'Ese personaje no está en el guion.' };
      if (typeof activo !== 'boolean') return { ok: false, error: 'Estado desconocido.' };
      partida.cambiarRecordatorio(id, activo);
      return { ok: true };
    },
  },

  /** Amanece: de la noche N al día N. */
  'narrador:amanecer': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.fases.actual().momento === 'noche',
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'Solo amanece de noche.' : 'Solo un narrador puede hacer que amanezca.'),
    hacer: (juego) => {
      const { partida } = juego;
      partida.amanecer();
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
    hacer: (juego) => {
      const { partida } = juego;
      partida.limpiarGrimorio();
      return { ok: true };
    },
  },

  /** Suena el gong: todos oyen y ven el aviso de volver a la plaza del pueblo. */
  'narrador:sonarGong': {
    puede: (_sala, yo) => yo.rol === 'narrador',
    noPuede: 'Solo un narrador puede sonar el gong.',
    hacer: (juego) => {
      // Uno cada pocos segundos, para que no se pisen
      const { partida } = juego;
      const ultimo = partida.reloj.gong();
      if (ultimo && Date.now() - ultimo < SALA_PAUSA_GONG_MS) return { ok: false, error: 'El gong aún está sonando.' };
      partida.reloj.sonarGong();
      return { ok: true };
    },
  },

  /**
   * Pone el reloj: una cuenta atrás para todos con un mensaje; al acabar suena el
   * gong. Sustituye al que hubiera. datos: { segundos, mensaje }.
   */
  'narrador:reloj': {
    puede: (_sala, yo) => yo.rol === 'narrador',
    noPuede: 'Solo un narrador puede poner el reloj.',
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const { segundos, mensaje } = (datos as { segundos?: unknown; mensaje?: unknown } | null) ?? {};
      if (typeof segundos !== 'number' || !Number.isInteger(segundos)) return { ok: false, error: 'Indica cuánto dura el reloj.' };
      if (segundos < SALA_RELOJ.minSegundos) return { ok: false, error: `El reloj tiene que durar al menos ${SALA_RELOJ.minSegundos} segundos.` };
      if (segundos > SALA_RELOJ.maxSegundos) return { ok: false, error: `El reloj puede durar como mucho ${SALA_RELOJ.maxSegundos / 60} minutos.` };
      if (mensaje !== undefined && typeof mensaje !== 'string') return { ok: false, error: 'Mensaje no válido.' };
      partida.reloj.ponerReloj(segundos, (mensaje ?? '').trim().slice(0, SALA_RELOJ.mensajeMax));
      return { ok: true };
    },
  },

  /** Acaba el reloj antes de tiempo: suena el gong para todos, como si se hubiera agotado. */
  'narrador:terminarReloj': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.reloj.relojEnMarcha(),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'No hay ningún reloj en marcha.' : 'Solo un narrador puede terminar el reloj.'),
    hacer: (juego) => {
      const { partida } = juego;
      partida.reloj.terminarReloj();
      return { ok: true };
    },
  },

  /** Quita el reloj sin que suene (antes de que acabe, o el «¡Tiempo!» que se queda al acabar). */
  'narrador:quitarReloj': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && !!partida.reloj.reloj(),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'No hay ningún reloj en marcha.' : 'Solo un narrador puede quitar el reloj.'),
    hacer: (juego) => {
      const { partida } = juego;
      partida.reloj.quitarReloj();
      return { ok: true };
    },
  },

  /**
   * Empieza un señalamiento (sustituye al que hubiera): quiénes señalan, a
   * quiénes (listas vacías: todos), el mensaje y la cuenta atrás (null: sin ella).
   * datos: { mensaje?, segundos: number | null, senaladores?: jugadorId[], objetivos?: jugadorId[] }.
   */
  'narrador:senalamiento': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.plaza().length > 0,
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'La plaza no tiene asientos.' : 'Solo un narrador puede pedir que se señale.'),
    hacer: (juego, _yo, datos) => {
      const { sala, partida } = juego;
      const d = (datos as { mensaje?: unknown; segundos?: unknown; senaladores?: unknown; objetivos?: unknown } | null) ?? {};
      const { minSegundos, maxSegundos, mensajeMax } = SALA_SENALAMIENTO;
      if (d.segundos !== null && (typeof d.segundos !== 'number' || !Number.isInteger(d.segundos))) {
        return { ok: false, error: 'Indica cuántos segundos dura la cuenta atrás.' };
      }
      if (d.segundos !== null && (d.segundos < minSegundos || d.segundos > maxSegundos)) {
        return { ok: false, error: `La cuenta atrás tiene que durar entre ${minSegundos} y ${maxSegundos} segundos.` };
      }
      if (d.mensaje !== undefined && typeof d.mensaje !== 'string') return { ok: false, error: 'Mensaje no válido.' };
      const asientos = (lista: unknown) =>
        Array.isArray(lista) && lista.every((id) => typeof id === 'string' && sala.jugador(id)) ? (lista as string[]) : null;
      const senaladores = d.senaladores === undefined ? [] : asientos(d.senaladores);
      const objetivos = d.objetivos === undefined ? [] : asientos(d.objetivos);
      if (!senaladores || !objetivos) return { ok: false, error: 'Alguno de esos asientos ya no existe.' };
      partida.empezarSenalamiento({
        mensaje: (d.mensaje ?? '').replace(/\s+/g, ' ').trim().slice(0, mensajeMax),
        segundos: d.segundos,
        senaladores,
        objetivos,
      });
      return { ok: true };
    },
  },

  /**
   * Lil' Monsta (de noche, con él en el guion, sin demonio y con un esbirro de más):
   * despierta a los esbirros vivos y señalan, sin cuenta atrás, hasta que todos
   * eligen al mismo (ese lo cuida: ver Partida.senalar).
   */
  'narrador:lilmonsta': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && !!partida.esbirrosLilmonsta(),
    noPuede: (_sala, yo) =>
      yo.rol === 'narrador'
        ? "Lil' Monsta se empieza de noche, sin demonio en la plaza y con un esbirro de más."
        : "Solo un narrador puede empezar Lil' Monsta.",
    hacer: (juego) => {
      const { partida } = juego;
      const esbirros = partida.esbirrosLilmonsta()!;
      partida.empezarSenalamiento({
        tipo: 'lilmonsta',
        mensaje: "Esbirros, elegid quién cuida de Lil' Monsta",
        segundos: null,
        senaladores: esbirros,
        objetivos: esbirros,
      });
      return { ok: true };
    },
  },

  /** Quita el señalamiento (en marcha o ya congelado). */
  'narrador:terminarSenalamiento': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && !!partida.senalamientos.senalamiento(),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'No hay ningún señalamiento.' : 'Solo un narrador puede terminar el señalamiento.'),
    hacer: (juego) => {
      const { partida } = juego;
      partida.senalamientos.terminar();
      return { ok: true };
    },
  },

  /**
   * El jugador de un asiento que señala elige a quién (o deja de señalar), mientras
   * no se congele. datos: { jugadorId: string | null }.
   */
  'jugador:senalar': {
    puede: (juego, yo) => {
      const { partida } = juego;
      const s = partida.senalamientos.senalamiento();
      const jugador = partida.jugadorDe(yo.id);
      return yo.rol === 'jugador' && !!s && !s.congelado && !!jugador && s.senaladores.includes(jugador.id);
    },
    noPuede: 'No te toca señalar.',
    hacer: (juego, yo, datos) => {
      const { partida } = juego;
      const jugadorId = (datos as { jugadorId?: unknown } | null)?.jugadorId;
      if (jugadorId !== null && typeof jugadorId !== 'string') return { ok: false, error: 'Ese asiento ya no existe.' };
      const error = partida.senalar(yo.id, jugadorId);
      return error ? { ok: false, error } : { ok: true };
    },
  },

  /** Quita el papel de narrador a otro narrador (pasa a visitante). datos: { participanteId }. */
  'narrador:expulsarNarrador': {
    // Solo sale si hay a quién: otro narrador además de uno mismo.
    puede: ({ sala }, yo) => yo.rol === 'narrador' && sala.participantes.participantes().some((p) => p.rol === 'narrador' && p.id !== yo.id),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'No hay otro narrador.' : 'Solo un narrador puede quitar a otro.'),
    hacer: (juego, yo, datos) => {
      const { sala } = juego;
      const id = (datos as { participanteId?: unknown } | null)?.participanteId;
      const elegido = typeof id === 'string' ? sala.participantes.buscar(id) : undefined;
      if (!elegido) return { ok: false, error: 'Esa persona ya no está en la sala.' };
      if (elegido.id === yo.id) return { ok: false, error: 'Para dejar de narrar, usa «Dejar de ser narrador».' };
      if (elegido.rol !== 'narrador') return { ok: false, error: `${elegido.nombre} ya no es narrador.` };
      sala.participantes.cambiarRol(elegido.id, 'visitante');
      return { ok: true };
    },
  },

  /**
   * Pone un personaje del guion en la ficha de un asiento (aldeanos, forasteros,
   * esbirros, demonios o viajeros), o se lo quita. datos: { jugadorId, personajeId: string | null }.
   */
  'narrador:cambiarPersonaje': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.plaza().length > 0,
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'La plaza no tiene asientos.' : 'Solo un narrador puede cambiar las fichas.'),
    hacer: (juego, _yo, datos) => {
      const { sala, partida } = juego;
      const { jugadorId, personajeId } = (datos as { jugadorId?: unknown; personajeId?: unknown }) ?? {};
      if (typeof jugadorId !== 'string' || !sala.jugador(jugadorId)) return { ok: false, error: 'Ese asiento ya no existe.' };
      if (personajeId !== null) {
        const personaje =
          typeof personajeId === 'string' ? partida.guion.personaje(personajeId) : undefined;
        if (!personaje) return { ok: false, error: 'Ese personaje no está en el guion.' };
        if (!TIPOS_EN_FICHA.includes(personaje.tipo)) return { ok: false, error: 'Ese personaje no puede ir en una ficha.' };
      }
      partida.grimorio.cambiarPersonaje(jugadorId, personajeId as string | null);
      return { ok: true };
    },
  },

  /**
   * Con el Gardener: intercambia el personaje y el alineamiento de dos fichas
   * (arrastrando una sobre otra), mientras los personajes repartidos no se hayan
   * entregado: al entregarlos, se acaba. datos: { desde, hasta } (ids de asiento).
   */
  'narrador:intercambiarFichas': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.npcs.activo(NPC_GARDENER) && partida.entregas.fichasRetenidas() && partida.plaza().length > 1,
    noPuede: ({ partida }, yo) =>
      yo.rol !== 'narrador'
        ? 'Solo un narrador puede intercambiar las fichas.'
        : !partida.npcs.activo(NPC_GARDENER)
          ? 'Las fichas solo se intercambian con el Gardener en juego.'
          : !partida.entregas.fichasRetenidas()
            ? 'Los personajes ya se han entregado: ya no se intercambian.'
            : 'Hacen falta dos asientos.',
    hacer: (juego, _yo, datos) => {
      const { sala, partida } = juego;
      const { desde, hasta } = (datos as { desde?: unknown; hasta?: unknown }) ?? {};
      if (typeof desde !== 'string' || typeof hasta !== 'string' || !sala.jugador(desde) || !sala.jugador(hasta)) {
        return { ok: false, error: 'Ese asiento ya no existe.' };
      }
      if (desde === hasta) return { ok: false, error: 'Elige otra ficha.' };
      partida.grimorio.intercambiarFichas(desde, hasta);
      return { ok: true };
    },
  },

  /**
   * Pone una ficha recordatorio junto a la de un asiento: uno de los recordatorios
   * de un personaje del guion (esté en juego o no). Cada una es única: si ya
   * estaba puesta (todas, si el personaje tiene varias iguales), se quita la de
   * antes (ver recordatorioQueSobra). datos: { jugadorId, personajeId, indice }.
   */
  'narrador:ponerRecordatorio': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.plaza().length > 0,
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'La plaza no tiene asientos.' : 'Solo un narrador pone recordatorios.'),
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const { jugadorId, personajeId, indice } = (datos as { jugadorId?: unknown; personajeId?: unknown; indice?: unknown }) ?? {};
      const jugador = partida.plaza().find((a) => a.id === jugadorId);
      if (!jugador || typeof jugadorId !== 'string') return { ok: false, error: 'Ese asiento ya no existe.' };
      const personaje = typeof personajeId === 'string' ? partida.guion.personaje(personajeId) : undefined;
      if (!personaje) return { ok: false, error: 'Ese personaje no está en el guion.' };
      const texto = typeof indice === 'number' && Number.isInteger(indice) ? personaje.recordatorios[indice] : undefined;
      if (texto === undefined) return { ok: false, error: 'Ese recordatorio no existe.' };
      const sobra = partida.grimorio.recordatorioQueSobra(jugadorId, personaje.id, indice as number);
      if (jugador.recordatorios.length >= MAX_RECORDATORIOS && sobra?.jugadorId !== jugadorId) {
        return { ok: false, error: `Una ficha no puede llevar más de ${MAX_RECORDATORIOS} recordatorios.` };
      }
      if (sobra) partida.grimorio.quitarRecordatorio(sobra.jugadorId, sobra.recordatorioId);
      partida.grimorio.ponerRecordatorio(jugadorId, { personaje: personaje.id, indice: indice as number, texto });
      return { ok: true };
    },
  },

  /**
   * Pone un recordatorio con texto propio (sin personaje): lo que escriba el
   * narrador, corto, porque va en redondo en una ficha pequeña. datos: { jugadorId, texto, icono? }.
   */
  'narrador:ponerRecordatorioTexto': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.plaza().length > 0,
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'La plaza no tiene asientos.' : 'Solo un narrador pone recordatorios.'),
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const { jugadorId, texto, icono } = (datos as { jugadorId?: unknown; texto?: unknown; icono?: unknown }) ?? {};
      const jugador = partida.plaza().find((a) => a.id === jugadorId);
      if (!jugador || typeof jugadorId !== 'string') return { ok: false, error: 'Ese asiento ya no existe.' };
      const limpio = typeof texto === 'string' ? texto.replace(/\s+/g, ' ').trim() : '';
      if (!limpio) return { ok: false, error: 'Escribe el texto del recordatorio.' };
      if ([...limpio].length > SALA_RECORDATORIO_TEXTO_MAX) {
        return { ok: false, error: `El recordatorio puede tener como mucho ${SALA_RECORDATORIO_TEXTO_MAX} caracteres.` };
      }
      if (jugador.recordatorios.length >= MAX_RECORDATORIOS) {
        return { ok: false, error: `Una ficha no puede llevar más de ${MAX_RECORDATORIOS} recordatorios.` };
      }
      const conIcono = leerIconoRecordatorio(juego, icono);
      if (conIcono === undefined) return { ok: false, error: 'Ese icono no está en el guion.' };
      partida.grimorio.ponerRecordatorio(jugadorId, { personaje: RECORDATORIO_TEXTO, indice: -1, texto: limpio, ...(conIcono ? { icono: conIcono } : {}) });
      return { ok: true };
    },
  },

  /**
   * Escribe la nota de un asiento (texto libre; sustituye la que hubiera).
   * datos: { jugadorId, texto }.
   */
  'narrador:escribirNota': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.plaza().length > 0,
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'La plaza no tiene asientos.' : 'Solo un narrador escribe notas.'),
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const { jugadorId, texto } = (datos as { jugadorId?: unknown; texto?: unknown }) ?? {};
      if (typeof jugadorId !== 'string') return { ok: false, error: 'Ese asiento ya no existe.' };
      // Se respetan los saltos de línea; solo se quitan los espacios de los extremos
      const limpio = typeof texto === 'string' ? texto.replace(/\r\n?/g, '\n').trim() : '';
      if (!limpio) return { ok: false, error: 'La nota está vacía.' };
      if (limpio.length > SALA_NOTA_LARGO_MAX) return { ok: false, error: `Una nota puede tener como mucho ${SALA_NOTA_LARGO_MAX} caracteres.` };
      return partida.grimorio.escribirNota(jugadorId, limpio) ? { ok: true } : { ok: false, error: 'Ese asiento ya no existe.' };
    },
  },

  /**
   * Envía un grimorio (el Espía, la Viuda) a quien se sienta en un asiento: una
   * copia del de la partida que el narrador puede haber cambiado. Se comprueba que
   * cada ficha sea de un asiento de la plaza y lleve personajes del guion.
   * datos: { jugadorId, fichas: FichaEnviadaDto[], faroles?: string[] }.
   */
  'narrador:enviarGrimorio': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.plaza().some((a) => a.participanteId),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'No hay nadie sentado.' : 'Solo un narrador envía el grimorio.'),
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const { jugadorId, fichas } = (datos as { jugadorId?: unknown; fichas?: unknown }) ?? {};
      const destino = partida.plaza().find((a) => a.id === jugadorId);
      if (!destino || typeof jugadorId !== 'string') return { ok: false, error: 'Ese asiento ya no existe.' };
      if (!destino.participanteId) return { ok: false, error: 'En ese asiento no hay nadie a quien enviárselo.' };
      if (!Array.isArray(fichas) || fichas.length > SALA_ASIENTOS.max) return { ok: false, error: 'El grimorio no es válido.' };
      const plaza = new Set(partida.plaza().map((a) => a.id));
      const limpias: FichaEnviadaDto[] = [];
      for (const f of fichas as Record<string, unknown>[]) {
        if (!f || typeof f.jugadorId !== 'string' || !plaza.has(f.jugadorId)) return { ok: false, error: 'El grimorio no es válido.' };
        const personaje = f.personaje === null ? null : typeof f.personaje === 'string' && partida.guion.personaje(f.personaje) ? f.personaje : undefined;
        if (personaje === undefined) return { ok: false, error: 'Hay un personaje que no está en el guion.' };
        const alineamiento = f.alineamiento === 'bueno' || f.alineamiento === 'malvado' ? f.alineamiento : null;
        const recordatorios = Array.isArray(f.recordatorios) ? (f.recordatorios as Record<string, unknown>[]) : [];
        if (recordatorios.length > MAX_RECORDATORIOS) return { ok: false, error: 'Hay una ficha con demasiados recordatorios.' };
        const limpios = [];
        for (const r of recordatorios) {
          const texto = typeof r?.texto === 'string' ? r.texto.replace(/\s+/g, ' ').trim() : '';
          if (r?.personaje === RECORDATORIO_TEXTO) {
            if (!texto || [...texto].length > SALA_RECORDATORIO_TEXTO_MAX) return { ok: false, error: 'Hay un recordatorio con un texto no válido.' };
            const icono = leerIconoRecordatorio(juego, r.icono);
            if (icono === undefined) return { ok: false, error: 'Hay un recordatorio con un icono que no está en el guion.' };
            limpios.push({ id: randomUUID(), personaje: RECORDATORIO_TEXTO, indice: -1, texto, ...(icono ? { icono } : {}) });
            continue;
          }
          const del = typeof r?.personaje === 'string' ? partida.guion.personaje(r.personaje) : undefined;
          const indice = typeof r?.indice === 'number' && Number.isInteger(r.indice) ? r.indice : -1;
          const original = del?.recordatorios[indice];
          if (!del || original === undefined) return { ok: false, error: 'Hay un recordatorio que no está en el guion.' };
          limpios.push({ id: randomUUID(), personaje: del.id, indice, texto: original });
        }
        limpias.push({ jugadorId: f.jugadorId, personaje, alineamiento, muerto: f.muerto === true, recordatorios: limpios });
      }
      // Los faroles del demonio (los que el narrador haya dejado en la copia)
      const faroles = (datos as { faroles?: unknown }).faroles ?? [];
      if (!Array.isArray(faroles) || faroles.length > NUM_FAROLES) return { ok: false, error: 'Los faroles no son válidos.' };
      if (faroles.some((id) => typeof id !== 'string' || !partida.guion.personaje(id))) return { ok: false, error: 'Hay un farol que no está en el guion.' };
      partida.entregas.enviarGrimorio(jugadorId, limpias, faroles as string[]);
      return { ok: true };
    },
  },

  /** Borra la nota de un asiento. datos: { jugadorId }. */
  'narrador:borrarNota': {
    puede: esNarrador,
    noPuede: 'Solo un narrador borra notas.',
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const { jugadorId } = (datos as { jugadorId?: unknown }) ?? {};
      if (typeof jugadorId !== 'string') return { ok: false, error: 'Petición desconocida.' };
      partida.grimorio.escribirNota(jugadorId, null);
      return { ok: true };
    },
  },

  /** Quita una ficha recordatorio. datos: { jugadorId, recordatorioId }. */
  'narrador:quitarRecordatorio': {
    puede: esNarrador,
    noPuede: 'Solo un narrador quita recordatorios.',
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const { jugadorId, recordatorioId } = (datos as { jugadorId?: unknown; recordatorioId?: unknown }) ?? {};
      if (typeof jugadorId !== 'string' || typeof recordatorioId !== 'string') return { ok: false, error: 'Petición desconocida.' };
      partida.grimorio.quitarRecordatorio(jugadorId, recordatorioId);
      return { ok: true };
    },
  },

  /**
   * Mete en la bolsa un personaje del guion (aldeano, forastero, esbirro o
   * demonio), o lo saca si ya estaba. No se limita cuántos: lo decide el narrador.
   * datos: { personajeId }.
   */
  'narrador:bolsa': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && !!partida.guion.actual(),
    noPuede: (sala, yo) => (yo.rol !== 'narrador' ? 'Solo un narrador puede preparar la bolsa.' : 'Antes hay que elegir un guion.'),
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const personajeId = (datos as { personajeId?: unknown } | null)?.personajeId;
      const personaje = typeof personajeId === 'string' ? partida.guion.personaje(personajeId) : undefined;
      if (!personaje) return { ok: false, error: 'Ese personaje no está en el guion.' };
      if (!TIPOS_EN_BOLSA.includes(personaje.tipo)) {
        return { ok: false, error: 'En la bolsa solo van aldeanos, forasteros, esbirros, demonios y viajeros.' };
      }
      partida.reparto.bolsa.alternar(personaje.id);
      return { ok: true };
    },
  },

  /**
   * Cuántas fichas de un personaje hay en la bolsa (0 la saca). Más de una, solo
   * si puede repetirse (ver puedeRepetirse).
   * datos: { personajeId, cantidad }.
   */
  'narrador:bolsaCantidad': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && !!partida.guion.actual(),
    noPuede: (_sala, yo) => (yo.rol !== 'narrador' ? 'Solo un narrador puede preparar la bolsa.' : 'Antes hay que elegir un guion.'),
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const { personajeId, cantidad } = (datos as { personajeId?: unknown; cantidad?: unknown } | null) ?? {};
      const personaje = typeof personajeId === 'string' ? partida.guion.personaje(personajeId) : undefined;
      if (!personaje || !TIPOS_EN_BOLSA.includes(personaje.tipo)) return { ok: false, error: 'Ese personaje no va en la bolsa.' };
      if (typeof cantidad !== 'number' || !Number.isInteger(cantidad) || cantidad < 0 || cantidad > MAX_REPETIDOS) {
        return { ok: false, error: 'Cantidad desconocida.' };
      }
      if (cantidad > 1 && !puedeRepetirse(juego, personaje)) return { ok: false, error: ERROR_REPETIDOS };
      partida.reparto.bolsa.poner(personaje.id, cantidad);
      return { ok: true };
    },
  },

  /** Vacía la bolsa: saca todos los personajes (también los viajeros). */
  'narrador:vaciarBolsa': {
    puede: esNarrador,
    noPuede: 'Solo un narrador puede preparar la bolsa.',
    hacer: (juego) => {
      const { partida } = juego;
      partida.reparto.bolsa.vaciar();
      return { ok: true };
    },
  },

  /**
   * Llena la bolsa de una vez (el narrador la ha llenado al azar): sustituye sus
   * aldeanos, forasteros, esbirros y demonios por estos; los viajeros se quedan.
   * Repetidos, solo los que pueden (ver puedeRepetirse). datos: { personajes: string[] }.
   */
  'narrador:llenarBolsa': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && !!partida.guion.actual(),
    noPuede: (_sala, yo) => (yo.rol !== 'narrador' ? 'Solo un narrador puede preparar la bolsa.' : 'Antes hay que elegir un guion.'),
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const ids = (datos as { personajes?: unknown } | null)?.personajes;
      if (!Array.isArray(ids) || ids.length > 100 || ids.some((id) => typeof id !== 'string')) {
        return { ok: false, error: 'Personajes desconocidos.' };
      }
      const vistos = new Set<string>();
      for (const id of ids as string[]) {
        const personaje = partida.guion.personaje(id);
        if (!personaje || personaje.tipo === 'traveller' || !TIPOS_EN_BOLSA.includes(personaje.tipo)) {
          return { ok: false, error: 'En la bolsa al azar solo van aldeanos, forasteros, esbirros y demonios del guion.' };
        }
        if (vistos.has(id) && !puedeRepetirse(juego, personaje)) return { ok: false, error: ERROR_REPETIDOS };
        vistos.add(id);
      }
      partida.reparto.bolsa.reemplazar(ids as string[]);
      return { ok: true };
    },
  },

  /** Con el Gardener: entrega a los jugadores los personajes ya repartidos. */
  'narrador:entregarFichas': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.entregas.fichasRetenidas(),
    noPuede: 'No hay personajes por entregar.',
    hacer: (juego) => {
      // Lo que hay ahora en las fichas (el narrador puede haberlas cambiado tras repartir)
      const { partida } = juego;
      partida.entregas.entregarFichas();
      return { ok: true };
    },
  },

  /**
   * Las reglas del Bootlegger (con él en juego): una por elemento; null o vacío
   * vuelve a las del guion. datos: { reglas: string[] | null }.
   */
  'narrador:bootlegger': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.npcs.activo(NPC_BOOTLEGGER),
    noPuede: 'Solo un narrador, con el Bootlegger en juego, escribe sus reglas.',
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const reglas = (datos as { reglas?: unknown } | null)?.reglas;
      if (reglas !== null && !Array.isArray(reglas)) return { ok: false, error: 'Reglas desconocidas.' };
      const limpias = (reglas ?? [])
        .filter((r): r is string => typeof r === 'string')
        .map((r) => r.replace(/\s+/g, ' ').trim().slice(0, 600))
        .filter(Boolean)
        .slice(0, 20);
      partida.npcs.escribirBootlegger(reglas === null ? null : limpias);
      return { ok: true };
    },
  },

  /**
   * El personaje bueno que nombra el Storm Catcher (con él en juego), o null.
   * datos: { personajeId: string | null }.
   */
  'narrador:stormcatcher': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.npcs.activo(NPC_STORMCATCHER),
    noPuede: 'Solo un narrador, con el Storm Catcher en juego, nombra su personaje.',
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const personajeId = (datos as { personajeId?: unknown } | null)?.personajeId;
      if (personajeId === null) {
        partida.npcs.nombrarStormcatcher(null);
        return { ok: true };
      }
      const personaje = typeof personajeId === 'string' ? partida.guion.personaje(personajeId) : undefined;
      if (!personaje || (personaje.tipo !== 'townsfolk' && personaje.tipo !== 'outsider')) {
        return { ok: false, error: 'El Storm Catcher nombra un personaje bueno (aldeano o forastero).' };
      }
      partida.npcs.nombrarStormcatcher(personaje.id);
      return { ok: true };
    },
  },

  /**
   * Pide silencio a todos (o lo levanta): los jugadores no pueden emitir su
   * micrófono. Solo con el Bibliotecario del Infierno en juego. datos: { activo }.
   */
  'narrador:silencio': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.npcs.npcs().includes(NPC_SILENCIO),
    noPuede: (_sala, yo) =>
      yo.rol !== 'narrador' ? 'Solo un narrador pide silencio.' : 'Solo se pide silencio con el Bibliotecario del Infierno en juego.',
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const activo = (datos as { activo?: unknown } | null)?.activo;
      if (typeof activo !== 'boolean') return { ok: false, error: 'Petición desconocida.' };
      partida.npcs.pedirSilencio(activo);
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
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const firma = (datos as { firma?: unknown } | null)?.firma;
      if (firma !== null && (typeof firma !== 'string' || firma.length > 100)) return { ok: false, error: 'Reparto desconocido.' };
      partida.reparto.aceptarSetup(firma);
      return { ok: true };
    },
  },

  /**
   * Pone en juego un NPC (un legendario o un lórico, del guion o del catálogo), o
   * lo quita si ya estaba. Lo ven todos. datos: { personajeId }.
   */
  'narrador:npc': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && !!partida.guion.actual(),
    noPuede: (_sala, yo) => (yo.rol !== 'narrador' ? 'Solo un narrador pone NPCs en juego.' : 'Antes hay que elegir un guion.'),
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const personajeId = (datos as { personajeId?: unknown } | null)?.personajeId;
      const personaje = typeof personajeId === 'string' ? partida.guion.personaje(personajeId) : undefined;
      if (!personaje) return { ok: false, error: 'Ese personaje no existe.' };
      if (!TIPOS_NPC.includes(personaje.tipo as TipoPersonaje)) {
        return { ok: false, error: 'Como NPC solo van legendarios y lóricos.' };
      }
      partida.alternarNpc(personaje.id);
      return { ok: true };
    },
  },

  /**
   * Pone un personaje del guion en una casilla de los faroles que el narrador
   * prepara para el demonio, o la vacía. datos: { posicion: 0..2, personajeId: string | null }.
   */
  'narrador:farol': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && !!partida.guion.actual(),
    noPuede: (_sala, yo) => (yo.rol !== 'narrador' ? 'Solo un narrador prepara los faroles.' : 'Antes hay que elegir un guion.'),
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const farol = leerFarol(juego, datos);
      if ('error' in farol) return { ok: false, error: farol.error };
      partida.faroles.ponerFarol(farol.posicion, farol.personajeId);
      return { ok: true };
    },
  },

  /**
   * Un jugador se pone (o se quita) un farol en una de sus casillas, tenga grimorio
   * o no. datos: { posicion: 0..2, personajeId: string | null }.
   */
  'jugador:farol': {
    puede: ({ partida }, yo) => yo.rol === 'jugador' && !!partida.jugadorDe(yo.id) && !!partida.guion.actual(),
    noPuede: 'Solo un jugador sentado se pone faroles.',
    hacer: (juego, yo, datos) => {
      const { partida } = juego;
      const jugador = partida.jugadorDe(yo.id);
      if (!jugador) return { ok: false, error: 'Ya no estás sentado.' };
      const farol = leerFarol(juego, datos);
      if ('error' in farol) return { ok: false, error: farol.error };
      partida.faroles.ponerFarolAsiento(jugador.id, farol.posicion, farol.personajeId);
      return { ok: true };
    },
  },

  /**
   * Un jugador dice cuál de sus faroles está usando (el personaje por el que se
   * hace pasar), para que lo sepa el narrador; o ninguno. datos: { personajeId: string | null }.
   */
  'jugador:usarFarol': {
    puede: ({ partida }, yo) => yo.rol === 'jugador' && !!partida.jugadorDe(yo.id) && !!partida.guion.actual(),
    noPuede: 'Solo un jugador sentado usa faroles.',
    hacer: (juego, yo, datos) => {
      const { partida } = juego;
      const jugador = partida.jugadorDe(yo.id);
      if (!jugador) return { ok: false, error: 'Ya no estás sentado.' };
      const personajeId = (datos as { personajeId?: unknown } | null)?.personajeId ?? null;
      if (personajeId !== null && typeof personajeId !== 'string') return { ok: false, error: 'Personaje desconocido.' };
      const error = partida.faroles.usarFarol(jugador.id, personajeId);
      return error ? { ok: false, error } : { ok: true };
    },
  },

  /**
   * El jugador despierto copia en sus faroles los personajes que el narrador le
   * ha enseñado con «Estos personajes no están en juego». datos: { personajes: id[] }
   * (los de esa tarjeta, que tiene que estar en su despertar).
   */
  'jugador:copiarFaroles': {
    puede: ({ partida }, yo) => yo.rol === 'jugador' && !!partida.despertares.asientoDespiertoDe(yo.id),
    noPuede: 'No tienes ningún despertar abierto.',
    hacer: (juego, yo, datos) => {
      const { partida } = juego;
      const jugadorId = partida.despertares.asientoDespiertoDe(yo.id);
      const personajes = (datos as { personajes?: unknown } | null)?.personajes;
      if (!jugadorId || !Array.isArray(personajes)) return { ok: false, error: 'No hay faroles que copiar.' };
      const mismos = (m: MensajeDespertar) =>
        m.autor === 'narrador' &&
        m.tarjeta === 'noEnJuego' &&
        m.personajes.length === personajes.length &&
        m.personajes.every((id, i) => id === personajes[i]);
      const hilo = partida.despertares.despertares().find((d) => d.jugador === jugadorId);
      if (!hilo?.mensajes.some(mismos)) return { ok: false, error: 'El narrador no te ha enseñado esos personajes.' };
      partida.faroles.copiarFaroles(jugadorId, (personajes as string[]).slice(0, NUM_FAROLES));
      return { ok: true };
    },
  },

  /**
   * Reparte al azar los personajes de la bolsa entre los asientos que no llevan
   * viajero. Solo en la preparación y si hay en la bolsa tantos como esos asientos.
   */
  'narrador:asignarPersonajes': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && !!partida.guion.actual() && partida.fases.actual().momento === 'preparacion',
    noPuede: ({ partida }, yo) =>
      yo.rol !== 'narrador'
        ? 'Solo un narrador puede repartir los personajes.'
        : !partida.guion.actual()
          ? 'Antes hay que elegir un guion.'
          : 'Los personajes solo se asignan en la preparación.',
    hacer: (juego) => {
      const { partida } = juego;
      const hacen = partida.reparto.fichasParaRepartir();
      const hay = partida.reparto.bolsa.bolsa().length;
      if (hacen === 0) return { ok: false, error: 'No hay asientos a los que repartir.' };
      if (hay !== hacen) return { ok: false, error: `En la bolsa tiene que haber ${hacen} personajes y hay ${hay}.` };
      partida.reparto.repartir();
      // Con el Gardener, los jugadores no los ven hasta que el narrador los entregue
      if (partida.npcs.activo(NPC_GARDENER)) partida.entregas.retenerFichas(true);
      else partida.entregas.entregarFichas();
      return { ok: true };
    },
  },

  /**
   * Revelar el grimorio (final de la partida): el narrador dice qué bando ha
   * ganado y todas las fichas se dan la vuelta. datos: { ganador: 'bueno' | 'malvado', causas?: string[] }
   * (ver CAUSAS_FIN_PARTIDA: lo que ha pasado con los personajes de la lista en juego).
   */
  'narrador:revelarGrimorio': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && !partida.revelacion.revelacion() && partida.plaza().length > 0,
    noPuede: ({ partida }, yo) =>
      yo.rol !== 'narrador'
        ? 'Solo un narrador puede revelar el grimorio.'
        : partida.revelacion.revelacion()
          ? 'Ya se está revelando el grimorio.'
          : 'La plaza no tiene asientos.',
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const { ganador, causas = [], esbirros = {} } =
        (datos as { ganador?: unknown; causas?: unknown; esbirros?: unknown } | null) ?? {};
      if (ganador !== 'bueno' && ganador !== 'malvado') return { ok: false, error: 'Bando desconocido.' };
      // Lo que ha pasado: solo de los personajes de la lista que están en juego (quien es de verdad cada uno)
      const enJuego = new Set(partida.plaza().map((a) => identidadDe(a)));
      if (!Array.isArray(causas) || causas.some((c) => typeof c !== 'string' || !CAUSAS_FIN_PARTIDA.includes(c) || !enJuego.has(c))) {
        return { ok: false, error: 'Hay un personaje que no está en juego.' };
      }
      // Las causas de esbirro (la Doncel cazada) dicen qué esbirro fue: un asiento que es esbirro de verdad
      if (typeof esbirros !== 'object' || esbirros === null) return { ok: false, error: 'Esbirros no válidos.' };
      const elegidos = esbirros as Record<string, unknown>;
      const esEsbirro = (id: unknown) => {
        const a = partida.plaza().find((x) => x.id === id);
        const quien = a ? identidadDe(a) : null;
        return !!quien && partida.guion.personaje(quien)?.tipo === 'minion';
      };
      for (const c of causas as string[]) {
        if (CAUSAS_DE_ESBIRRO.includes(c) && !esEsbirro(elegidos[c])) {
          return { ok: false, error: 'Elige qué esbirro descubrió a la Doncel.' };
        }
      }
      const esbirroDe = Object.fromEntries(
        (causas as string[]).filter((c) => CAUSAS_DE_ESBIRRO.includes(c)).map((c) => [c, elegidos[c] as string]),
      );
      partida.empezarRevelacion(ganador, [...new Set(causas as string[])], esbirroDe);
      return { ok: true };
    },
  },

  /** Revela la ficha de un asiento, para todos. datos: { jugadorId }. */
  'narrador:revelarFicha': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && !!partida.revelacion.revelacion() && !partida.revelacion.revelacion()!.terminada,
    noPuede: 'No se está revelando el grimorio.',
    hacer: (juego, _yo, datos) => {
      const { sala, partida } = juego;
      const jugadorId = (datos as { jugadorId?: unknown } | null)?.jugadorId;
      if (typeof jugadorId !== 'string' || !sala.jugador(jugadorId)) return { ok: false, error: 'Ese asiento ya no existe.' };
      partida.revelacion.revelarFicha(jugadorId);
      return { ok: true };
    },
  },

  /** Termina la revelación: revela de una vez las fichas que quedan. */
  'narrador:terminarRevelacion': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && !!partida.revelacion.revelacion() && !partida.revelacion.revelacion()!.terminada,
    noPuede: 'No se está revelando el grimorio.',
    hacer: (juego) => {
      const { partida } = juego;
      partida.revelacion.revelarTodas();
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
    hacer: async (juego, _yo, datos, deps) => {
      const { partida } = juego;
      const { predeterminado, imagen, biblioteca } = (datos as Record<string, unknown>) ?? {};
      if (predeterminado === true) {
        partida.configuracion.cambiar({ fondo: null });
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
      partida.configuracion.cambiar({ fondo: guardado.ruta });
      return { ok: true, valor: guardado.ruta };
    },
  },

  /** Cambia el alineamiento de la ficha de un asiento. datos: { jugadorId, alineamiento: 'bueno' | 'malvado' }. */
  'narrador:cambiarAlineamiento': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.plaza().length > 0,
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'La plaza no tiene asientos.' : 'Solo un narrador puede cambiar las fichas.'),
    hacer: (juego, _yo, datos) => {
      const { sala, partida } = juego;
      const { jugadorId, alineamiento } = (datos as { jugadorId?: unknown; alineamiento?: unknown }) ?? {};
      if (typeof jugadorId !== 'string' || !sala.jugador(jugadorId)) return { ok: false, error: 'Ese asiento ya no existe.' };
      if (alineamiento !== 'bueno' && alineamiento !== 'malvado') return { ok: false, error: 'Alineamiento desconocido.' };
      if (!partida.plaza().find((a) => a.id === jugadorId)?.personaje) {
        return { ok: false, error: 'Esa ficha no tiene personaje.' };
      }
      partida.grimorio.cambiarAlineamiento(jugadorId, alineamiento);
      return { ok: true };
    },
  },

  /**
   * Mata o revive la ficha de un asiento (haya alguien sentado o no). De noche, matar
   * deja la muerte pendiente (ver Grimorio.cambiarVida). datos: { jugadorId, muerto: boolean }.
   */
  'narrador:cambiarVida': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.plaza().length > 0,
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'La plaza no tiene asientos.' : 'Solo un narrador puede matar o revivir.'),
    hacer: (juego, _yo, datos) => {
      const { sala, partida } = juego;
      const { jugadorId, muerto } = (datos as { jugadorId?: unknown; muerto?: unknown }) ?? {};
      if (typeof jugadorId !== 'string' || !sala.jugador(jugadorId)) return { ok: false, error: 'Ese asiento ya no existe.' };
      if (typeof muerto !== 'boolean') return { ok: false, error: 'Estado desconocido.' };
      partida.grimorio.cambiarVida(jugadorId, muerto);
      return { ok: true };
    },
  },

  /**
   * Ejecuta al que lleva la calavera: muere, se le ponen los recordatorios de los
   * personajes que funcionan con las ejecuciones y anochece (salvo con el Carnicero
   * vivo). Ver Partida.ejecutar. datos: { jugadorId }.
   */
  'narrador:ejecutar': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.grimorio.hayMarca(),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'Nadie lleva la calavera.' : 'Solo un narrador puede ejecutar.'),
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const jugadorId = (datos as { jugadorId?: unknown } | null)?.jugadorId;
      const jugador = partida.plaza().find((a) => a.id === jugadorId);
      if (!jugador) return { ok: false, error: 'Ese asiento ya no existe.' };
      if (partida.grimorio.calavera()?.jugadorId !== jugador.id) return { ok: false, error: 'Solo se ejecuta a quien lleva la calavera.' };
      // Si quedan dos vivos, no anochece: el narrador elige (valor «final») entre la noche y revelar el grimorio
      const { final } = partida.ejecutar(jugador.id) ?? { final: false };
      return final ? { ok: true, valor: 'final' } : { ok: true };
    },
  },

  /**
   * Hace efectiva la muerte pendiente de un asiento (la de la noche): el narrador la
   * anuncia y ya la ven todos. datos: { jugadorId }.
   */
  'narrador:confirmarMuerte': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.plaza().some((a) => a.muertePendiente),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'No hay ninguna muerte por anunciar.' : 'Solo un narrador puede anunciar una muerte.'),
    hacer: (juego, _yo, datos) => {
      const { sala, partida } = juego;
      const jugadorId = (datos as { jugadorId?: unknown } | null)?.jugadorId;
      if (typeof jugadorId !== 'string' || !sala.jugador(jugadorId)) return { ok: false, error: 'Ese asiento ya no existe.' };
      if (!partida.grimorio.confirmarMuerte(jugadorId)) return { ok: false, error: 'Esa ficha no tiene una muerte por anunciar.' };
      return { ok: true };
    },
  },

  /**
   * Quita o devuelve a mano el voto de un muerto (el que le queda): se apaga o se
   * enciende su vela. datos: { jugadorId, gastado: boolean }.
   */
  'narrador:cambiarVoto': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.plaza().some((a) => a.muerto),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'No hay ningún muerto.' : 'Solo un narrador quita o devuelve votos.'),
    hacer: (juego, _yo, datos) => {
      const { sala, partida } = juego;
      const { jugadorId, gastado } = (datos as { jugadorId?: unknown; gastado?: unknown }) ?? {};
      if (typeof jugadorId !== 'string' || !sala.jugador(jugadorId)) return { ok: false, error: 'Ese asiento ya no existe.' };
      if (typeof gastado !== 'boolean') return { ok: false, error: 'Estado desconocido.' };
      if (!partida.grimorio.cambiarVoto(jugadorId, gastado)) return { ok: false, error: 'Solo los muertos tienen un voto que quitar o devolver.' };
      return { ok: true };
    },
  },

  /** El Barquero (con él en juego): todos los muertos recuperan su voto. */
  'narrador:barquero': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.npcs.activo(NPC_FERRYMAN),
    noPuede: 'Solo un narrador, con el Barquero en juego, devuelve los votos a los muertos.',
    hacer: (juego) => {
      const { partida } = juego;
      if (partida.grimorio.devolverVotos() === 0) return { ok: false, error: 'Ningún muerto ha gastado su voto.' };
      return { ok: true };
    },
  },

  /** Levanta a un jugador de su asiento: vuelve a visitante. datos: { participanteId }. */
  'narrador:levantarJugador': {
    // Solo sale si hay a quién: algún jugador sentado.
    puede: ({ sala }, yo) => yo.rol === 'narrador' && sala.participantes.participantes().some((p) => p.rol === 'jugador'),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'No hay nadie sentado.' : 'Solo un narrador puede levantar a un jugador.'),
    hacer: (juego, _yo, datos) => {
      const { sala } = juego;
      const id = (datos as { participanteId?: unknown } | null)?.participanteId;
      const elegido = typeof id === 'string' ? sala.participantes.buscar(id) : undefined;
      if (!elegido) return { ok: false, error: 'Esa persona ya no está en la sala.' };
      if (elegido.rol !== 'jugador') return { ok: false, error: `${elegido.nombre} no está en ningún asiento.` };
      sala.levantar(elegido.id);
      return { ok: true };
    },
  },

  /** Saca de la sala a un jugador o visitante (no a otro narrador). datos: { participanteId }. */
  'narrador:expulsarJugador': {
    // Solo sale si hay a quién: alguien que no narra.
    puede: ({ sala }, yo) => yo.rol === 'narrador' && sala.participantes.participantes().some((p) => p.rol !== 'narrador'),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'No hay nadie a quien expulsar.' : 'Solo un narrador puede expulsar a alguien.'),
    hacer: (juego, _yo, datos) => {
      const { sala } = juego;
      const id = (datos as { participanteId?: unknown } | null)?.participanteId;
      const elegido = typeof id === 'string' ? sala.participantes.buscar(id) : undefined;
      if (!elegido) return { ok: false, error: 'Esa persona ya no está en la sala.' };
      if (elegido.rol === 'narrador') return { ok: false, error: 'Para quitar a un narrador, usa «Expulsar narrador».' };
      const conexion = sala.participantes.expulsar(elegido.id);
      return { ok: true, expulsar: conexion ? [conexion] : [] };
    },
  },

  /**
   * Añade o quita un asiento al final del círculo, mezcla a quienes están
   * sentados o mueve a uno a otro asiento (intercambiándolos si está ocupado).
   * datos: { cambio: 'añadir' | 'quitar' | 'mezclar' } o
   * { cambio: 'mover', desde: jugadorId, hasta: jugadorId }.
   */
  'narrador:asientos': {
    puede: esNarrador,
    noPuede: 'Solo un narrador puede cambiar los asientos.',
    hacer: (juego, _yo, datos) => {
      const { sala, partida } = juego;
      const cambio = (datos as { cambio?: unknown } | null)?.cambio;
      const total = partida.plaza().length;
      if (cambio === 'añadir') {
        if (total >= SALA_ASIENTOS.max) return { ok: false, error: `La plaza ya tiene el máximo de ${SALA_ASIENTOS.max} asientos.` };
        sala.anadirAsiento();
        return { ok: true };
      }
      if (cambio === 'quitar') {
        if (total <= SALA_ASIENTOS.min) return { ok: false, error: 'La plaza ya no tiene asientos.' };
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
        if (sala.mezclar() === 0) return { ok: false, error: 'No hay nadie sentado para mezclar.' };
        return { ok: true };
      }
      return { ok: false, error: 'Cambio de asientos desconocido.' };
    },
  },

  /** datos: { participanteId } de un visitante o jugador. */
  'narrador:nombrarNarrador': {
    puede: esNarrador,
    noPuede: 'Solo un narrador puede nombrar a otro.',
    hacer: (juego, _yo, datos) => {
      const { sala } = juego;
      const id = (datos as { participanteId?: unknown } | null)?.participanteId;
      const elegido = typeof id === 'string' ? sala.participantes.buscar(id) : undefined;
      if (!elegido) return { ok: false, error: 'Esa persona ya no está en la sala.' };
      if (elegido.rol === 'narrador') return { ok: false, error: `${elegido.nombre} ya es narrador.` };
      sala.participantes.cambiarRol(elegido.id, 'narrador');
      return { ok: true };
    },
  },
};

/** Las acciones que este participante puede usar ahora mismo. */
export function accionesPermitidas(juego: SalaDeJuego, yo: Participante): string[] {
  return Object.entries(SALA_ACCIONES)
    .filter(([, accion]) => accion.puede(juego, yo))
    .map(([nombre]) => nombre);
}

/** Ejecuta una acción si existe y quien la pide tiene permiso. */
export async function ejecutarAccion(
  juego: SalaDeJuego,
  yo: Participante | undefined,
  nombre: string,
  datos: unknown,
  deps: DependenciasSala,
): Promise<SalaEfecto> {
  const accion = Object.prototype.hasOwnProperty.call(SALA_ACCIONES, nombre) ? SALA_ACCIONES[nombre] : undefined;
  if (!accion) return { ok: false, error: 'Acción desconocida.' };
  if (!yo) return { ok: false, error: 'No estás en la sala.' };
  if (!accion.puede(juego, yo)) {
    return { ok: false, error: typeof accion.noPuede === 'function' ? accion.noPuede(juego, yo) : accion.noPuede };
  }
  return accion.hacer(juego, yo, datos, deps);
}
