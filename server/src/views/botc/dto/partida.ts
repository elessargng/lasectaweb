/**
 * La partida tal como se envía: ajustes, nominación, votación, reloj, señalamiento y revelación.
 * Lo que se envía al cliente (alias @views): solo tipos, sin Node ni servicios.
 */
import type { MensajesPrivados } from './chat';
import type { Alineamiento } from './jugador';

/** Los límites de un señalamiento: segundos de la cuenta atrás (10 por defecto) y largo del mensaje. */
export const SALA_SENALAMIENTO = { minSegundos: 3, maxSegundos: 120, defectoSegundos: 10, mensajeMax: 120 };

/** Cuántos personajes de cada tipo tiene la partida (sin contar los asientos con viajero). */
export interface Distribucion {
  /** Asientos que no llevan viajero. */
  jugadores: number;
  /** De ellos, los que no están muertos (con sudario). */
  jugadoresVivos: number;
  viajeros: number;
  viajerosVivos: number;
  /** null si hay menos de 5 jugadores (no hay reparto). */
  aldeanos: number | null;
  forasteros: number | null;
  esbirros: number | null;
  demonios: number | null;
}

/** Una nominación del día y, si se votó, su votación, para el registro del narrador. */
export interface RegistroVotacion {
  /** Cuándo se nominó (ms). */
  hora: number;
  /** El día de la partida en que se nominó. */
  dia: number;
  /** «Ana» o, si el asiento está libre, «asiento 1». */
  nomina: string;
  nominado: string;
  /** Los asientos que nominan y que son nominados (no los hay en las partidas guardadas antes). */
  nominaAsiento?: string;
  nominadoAsiento?: string;
  /** Era la expulsión de un viajero, no una nominación. */
  expulsion?: boolean;
  /** Nombres de quienes votaron, en el orden en que votaron; null si no se llegó a votar. */
  votantes: string[] | null;
  votos: number | null;
}

/** En qué momento está la partida: la preparación y, después, noche 1, día 1, noche 2… */
export interface Fase {
  momento: 'preparacion' | 'noche' | 'dia';
  /** Número de la noche o del día (0 en la preparación). */
  numero: number;
  /** Veces que se ha limpiado el grimorio. */
  reinicios: number;
}

export type TurnoNominacion = 'acusacion' | 'defensa' | 'votacion';

/**
 * El reloj del narrador: una cuenta atrás que ven todos, con su mensaje
 * («Conversaciones privadas»). Al acabar suena el gong. Cada cliente la calcula
 * con el reloj del servidor, así que el servidor no tiene que avisar al terminar.
 */
export interface RelojDto {
  /** Cuándo empezó y cuándo acaba (ms, reloj del servidor). */
  inicio: number;
  fin: number;
  /** El mensaje (puede ir vacío). */
  mensaje: string;
}

/**
 * Un señalamiento: el narrador pide que unos jugadores señalen a otros (con un
 * mensaje). Mientras dura la cuenta atrás cada uno elige (y puede cambiar);
 * al acabar se congela. De día lo ven todos; de noche, solo los que señalan
 * (despiertos) y quien ve el grimorio. Lo quita el narrador.
 */
export interface SenalamientoDto {
  id: string;
  /** 'normal', o el de Lil' Monsta: los esbirros eligen quién lo cuida, sin cuenta atrás. */
  tipo: 'normal' | 'lilmonsta';
  /** Lo que se pide, en grande (puede ir vacío). */
  mensaje: string;
  /** Los asientos que señalan y los que se pueden señalar (ids; si no se eligió ninguno, todos). */
  senaladores: string[];
  objetivos: string[];
  /** De día: lo ven todos (y suena la cuenta atrás). */
  publico: boolean;
  /** Cuándo empezó y cuándo acaba la cuenta atrás (ms, reloj del servidor); fin null: sin cuenta atrás. */
  inicio: number;
  fin: number | null;
  /** Ya no se puede señalar: acabó la cuenta atrás o (Lil' Monsta) todos coinciden. */
  congelado: boolean;
  /** A quién señala cada asiento (asiento que señala → asiento señalado). */
  senales: Record<string, string>;
}

export interface RevelacionDto {
  ganador: Alineamiento;
  /** Lo que ha pasado (ids de CAUSAS_FIN_PARTIDA, de personajes en juego), por orden. */
  causas: string[];
  /** Asientos cuya ficha ya se ha revelado, en orden. */
  reveladas: string[];
  /** Están todas reveladas. */
  terminada: boolean;
}

/** Ajustes de la partida que fija el narrador y valen para todos. */
export interface ConfiguracionDto {
  /** Cada jugador puede cambiar las fichas en su propio grimorio (si no, solo las ve). */
  grimorioJugadores: boolean;
  /** Lo que tarda la aguja en pasar de una ficha a la siguiente al votar, en segundos. */
  segundosPorFicha: number;
  /** Mensajes privados entre jugadores: ninguno, solo con los vecinos o con todos. */
  mensajes: MensajesPrivados;
  /**
   * El fondo de la sala: una imagen en /uploads/sala/fondos (subida o de la
   * Biblioteca), la dirección https del fondo que trae el guion, o null: el de por defecto.
   */
  fondo: string | null;
  /**
   * Las cámaras de quien conversa en privado no se ven en la plaza (de entrada,
   * sí se ocultan). Si no, en la plaza se ve su cámara, sin su voz (de día: de
   * noche no hay cámaras en la plaza).
   */
  ocultarCamarasConversacion: boolean;
}

/**
 * La votación de una nominación: la aguja del nominado recorre las fichas en el
 * sentido de las agujas del reloj, del asiento siguiente al nominado hasta él.
 */
export interface VotacionDto {
  /** Los asientos en el orden en que vota cada uno (el último, el nominado). */
  orden: string[];
  /** Cuántas fichas ha recorrido ya la aguja. */
  paso: number;
  /** Por asiento ya recorrido: los votos acumulados si votó, o null si no. */
  resultados: Record<string, number | null>;
  votos: number;
  terminada: boolean;
  /**
   * Lo que valió el voto de cada asiento que votó, si no fue 1: las dos manos de la
   * Banshee (×2), el Burócrata (×3), el Ladrón (en negativo), y combinados.
   */
  valores?: Record<string, number>;
}

/** Una nominación en curso: de qué asiento a qué asiento (ids de asiento). */
export interface NominacionDto {
  desde: string;
  hasta: string;
  /** Cuándo acaba la cuenta atrás (ms, reloj del servidor), o null si no ha empezado. */
  cuentaAtrasFin: number | null;
  /** La votación, desde que acaba la cuenta atrás. */
  votacion: VotacionDto | null;
  /**
   * El nominado es un viajero: no es una nominación, es una expulsión. Hace falta
   * la mitad de los votos de la plaza (de todos los asientos, vivos o muertos, sin
   * mirar otras votaciones), vota cualquiera sin gastar su voto de muerto, cada mano
   * vale 1 y, si sale, el viajero muere al momento (sin calavera). Nunca es secreta
   * (el Organ Grinder solo esconde las nominaciones).
   */
  expulsion: boolean;
  /** Votos que hacen falta para el nominado: los que ha elegido el narrador o, si no, los de por defecto. */
  votosNecesarios: number;
  /**
   * Los de por defecto: la mitad de las fichas vivas (redondeando hacia arriba)
   * y, si ya ha habido hoy una votación que llegó a los necesarios, al menos uno
   * más que la que más votos tuvo (aunque empatara y nadie lleve la calavera).
   */
  votosNecesariosPorDefecto: number;
  /**
   * Votación secreta (el Organ Grinder vivo y sin su «Drunk»): a quien no ve el
   * grimorio no se le mandan los votos que hacen falta, ni el recuento, ni quién
   * vota (salvo lo suyo), ni las manos de los demás (ver VistaPartida).
   */
  privada: boolean;
}
