/**
 * La sala entera tal como la recibe cada participante (SalaDto) y la respuesta a
 * sus acciones. Los Dto de cada tema están junto a este archivo (alias @views);
 * los valores del dominio que llevan, en models/compartido (alias @models).
 */
import type { DespertarDto, HabilidadNocheDto } from './despertar';
import type { CalaveraDto, GrimorioEnviadoDto } from './grimorio';
import type { JugadorDto } from './jugador';
import type { NarradorVirtualDto } from './narradorVirtual';
import type { ParticipanteDto } from './participante';
import type { ConfiguracionDto, NominacionDto, RelojDto, RevelacionDto, SenalamientoDto } from './partida';
import type { Distribucion, Fase, RegistroVotacion } from '../../models/compartido/partida';
import type { GuionNarrable } from '../../models/compartido/narradorVirtual';

/** Una conversación privada (voz y vídeo) entre dos o más jugadores o narradores. */
export interface ConversacionDto {
  id: string;
  /** ids de los que hablan en ella (jugadores y narradores). */
  miembros: string[];
  /**
   * ids de los visitantes que la escuchan (ni hablan ni se ven). A los jugadores
   * no se les manda: no saben que están.
   */
  oyentes: string[];
}

/** Una invitación a conversar, pendiente de que `para` la acepte o la rechace. */
export interface InvitacionDto {
  id: string;
  de: string;
  para: string;
  /**
   * Si es una petición para unirse a la conversación de `para`: su id. La ven
   * y la pueden aceptar todos sus miembros. Sin ella, `de` invita a `para`.
   */
  conversacion?: string;
}

/** Lo que el servidor manda a cada cliente cada vez que cambia la sala. */
export interface SalaDto {
  /** El narrador virtual, si lo hay. */
  narradorVirtual: NarradorVirtualDto | null;
  /**
   * Quien tiene la palabra en la plaza (el narrador virtual, al nominar): los demás
   * jugadores tienen el micrófono cerrado. null: hablan todos.
   */
  palabra: string | null;
  participantes: ParticipanteDto[];
  /**
   * Los jugadores de la plaza, en orden: el asiento N es plaza[N-1], el primero a
   * las 12 y siguiendo como las agujas del reloj.
   */
  plaza: JugadorDto[];
  /** Quién lleva la calavera, o null. Para todos (en una votación secreta, sin los votos). */
  calavera: CalaveraDto | null;
  /**
   * Las notas del narrador sobre los jugadores (por id de jugador; sin nota, no
   * está). Son del grimorio: solo para los narradores y quien ve el grimorio.
   */
  notas: Record<string, string>;
  configuracion: ConfiguracionDto;
  nominacion: NominacionDto | null;
  fase: Fase;
  /** El reparto de personajes de la partida, para todos. */
  distribucion: Distribucion;
  /** Los personajes metidos en la bolsa (ids); solo se manda a los narradores. */
  bolsa: string[];
  /**
   * Los faroles que el narrador ha preparado para el demonio (3 casillas, id de
   * personaje o null). Se mandan a los narradores y a los visitantes.
   */
  faroles: (string | null)[];
  /** Los NPCs de la partida (legendarios y lóricos, ids), en el orden en que se añadieron. Para todos. */
  npcs: string[];
  /** Lo que se sabe del reparto (ver RepartoDto); solo se manda a los narradores. */
  reparto: RepartoDto | null;
  /**
   * Con todos los personajes puestos, los que no van en la bolsa y probablemente
   * están en juego porque el reparto no cuadra (el Borracho, la Marioneta). Para
   * quien ve el grimorio.
   */
  probables: string[];
  /**
   * El narrador ha pedido silencio (con el Bibliotecario del Infierno en juego):
   * los jugadores no pueden emitir su micrófono, ni en la plaza ni en las
   * conversaciones. Para todos.
   */
  silencio: boolean;
  /**
   * El Voudon está vivo: solo votan él y los muertos (sin gastar su voto) y basta
   * con 1 voto. Para todos (es un viajero: público).
   */
  voudon: boolean;
  /** La Institutriz está viva: los jugadores solo conversan en privado con sus vecinos. Para todos. */
  institutriz: boolean;
  /** Las reglas del Bootlegger: las del guion o las que ha escrito el narrador. Para todos. */
  bootlegger: string[];
  /** El personaje bueno que el narrador ha nombrado con el Storm Catcher (id), o null. Para todos. */
  rolStormcatcher: string | null;
  /**
   * Con el Gardener: los personajes ya repartidos aún no se entregan (los jugadores
   * no ven ni el suyo) hasta que el narrador pulsa el Gardener. Para todos.
   */
  fichasRetenidas: boolean;
  /** Revelando el grimorio (final de la partida), o null. */
  revelacion: RevelacionDto | null;
  /**
   * Hora del servidor (ms) del último gong del narrador («¡regresad a la plaza!»),
   * o null. Al cambiar, suena y se ve el aviso. Para todos.
   */
  gong: number | null;
  /** El reloj del narrador (una cuenta atrás con un mensaje), o null. Para todos. */
  reloj: RelojDto | null;
  /**
   * El señalamiento en curso (o ya congelado), o null. De día, para todos; de
   * noche, para los narradores, quien ve el grimorio y los jugadores que señalan.
   */
  senalamiento: SenalamientoDto | null;
  /** Hay videollamada (cámaras y micrófonos) en esta sala. */
  video: boolean;
  /** Las conversaciones privadas en curso (todos ven quién habla con quién, no qué). */
  conversaciones: ConversacionDto[];
  /** Las invitaciones a conversar que ha hecho o recibido quien recibe el mensaje. */
  invitaciones: InvitacionDto[];
  /** Hora del servidor (ms) al mandar el estado: el cliente la usa para la cuenta atrás. */
  ahora: number;
  /** Registro de nominaciones y votaciones (en orden); solo se manda a los narradores. */
  votaciones: RegistroVotacion[];
  /**
   * Fichas recordatorio (estrella) del orden de noche que los narradores han
   * quitado (false) o puesto (true) a mano, por id de personaje o 'esbirros' /
   * 'demonios'; las demás son las automáticas. Solo se manda a los narradores.
   */
  recordatoriosNoche: Record<string, boolean>;
  /** Los despertares: todos, para los narradores; el de su asiento, para un jugador; ninguno, para los demás. */
  despertares: DespertarDto[];
  /** El despertar guiado de cada fila del orden de noche (ver HabilidadNocheDto). Solo para los narradores. */
  habilidadesNoche: HabilidadNocheDto[];
  /**
   * El Imp se ha elegido a sí mismo: el narrador tiene que decir quién es el nuevo
   * (el asiento del que muere), o null. Solo para los narradores.
   */
  nuevoImp: string | null;
  /**
   * El grimorio que el narrador ha enviado (el último) a quien recibe el mensaje,
   * si está sentado en el asiento al que se envió (el Espía, la Viuda); si no, null.
   */
  grimorioRecibido: GrimorioEnviadoDto | null;
  /** id del participante que recibe el mensaje. */
  yo: string;
  /** Lo que puede pedir ahora quien recibe el mensaje (los nombres de sus eventos: ver los servicios de services/sala). */
  acciones: string[];
}

/** La respuesta a una petición de la sala. `valor`: lo que devuelve a quien la pidió (p. ej. la ruta del avatar subido). */
/**
 * El reparto, ya calculado con los personajes que cambian la bolsa (el Barón, el
 * Kazali…): con la bolsa (el diálogo de la bolsa) y con lo que se cuenta en el
 * recuadro del reparto.
 */
export interface RepartoDto {
  /** Con lo que hay en la bolsa: lo que toca de cada tipo y lo que no cuadra. */
  bolsa: { ajustado: Distribucion; problemas: string[] };
  /** Lo que hay en juego (si ya hay personajes en la plaza) o, si no, la bolsa. */
  cuenta: {
    donde: 'bolsa' | 'juego';
    /** Cuántos hay de cada tipo (townsfolk, outsider, minion, demon, traveller). */
    cuentas: Record<string, number>;
    ajustado: Distribucion;
    /** Lo que no cuadra («Forasteros: 2; deberían ser 0 o 1»), con el reparto completo. */
    problemas: string[];
    /** La firma del reparto, para darlo por bueno a mano («7:5/0/1/1»). */
    firma: string;
    /** Hay que avisar: en la preparación, no cuadra y no se ha dado por bueno. */
    aviso: boolean;
  };
}

/** Los guiones que puede llevar el narrador virtual, con cuántos jugadores (ver GuionNarrable). */
export type ResultadoGuionesNarrables = { ok: true; valor: GuionNarrable[] } | { ok: false; error: string };

/** Lo que contesta la sala al llenar la bolsa al azar: lo que ha salido y no va (con el tipo que falta) y los tipos que escasean. */
export type ResultadoBolsaAlAzar =
  | { ok: true; fuera: { personaje: string; falta: string }[]; escasos: string[] }
  | { ok: false; error: string };

export type ResultadoAccion = { ok: true; valor?: string } | { ok: false; error: string };
