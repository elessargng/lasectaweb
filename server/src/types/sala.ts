/** Papel de cada participante en la sala de juego. Todo el que entra es visitante. */
export type SalaRol = 'narrador' | 'jugador' | 'visitante';

/** Forma de la mano que levanta un jugador (como en piedra, papel o tijera). */
export type SalaFormaMano = 'palma' | 'puno' | 'tijera';
export const SALA_FORMAS_MANO: SalaFormaMano[] = ['palma', 'puno', 'tijera'];

export interface SalaParticipante {
  /** Identificador dentro de la sala (no es el id de usuario de la web). */
  id: string;
  nombre: string;
  /** Entró con su cuenta de la web (si no, es invitado). */
  conCuenta: boolean;
  /** Ruta del avatar de su cuenta; null para los invitados. */
  avatar: string | null;
  rol: SalaRol;
  /** false mientras se espera a que vuelva tras perder la conexión. */
  conectado: boolean;
  /** Jugador con la mano levantada. Al dejar de ser jugador, vuelve a false. */
  manoLevantada: boolean;
  /** La forma de su mano al levantarla; se conserva aunque la baje. */
  formaMano: SalaFormaMano;
}

/**
 * Un asiento de la mesa (las sillas de la partida). Cada asiento tiene su ficha,
 * haya alguien sentado o no: la muerte y la calavera son de la ficha.
 */
export interface SalaAsiento {
  id: string;
  /** id del participante sentado (un jugador), o null si está libre. */
  ocupante: string | null;
  /** Su ficha está muerta (lleva sudario). */
  muerto: boolean;
  /** Su ficha lleva la calavera (solo una de la mesa). */
  marcado: boolean;
  /** Con cuántos votos se le puso la calavera (desde una nominación ya votada), o null. */
  votosMarca: number | null;
}

/** Ajustes de la partida que fija el narrador y valen para todos. */
export interface SalaConfiguracion {
  /** Cada jugador puede cambiar las fichas en su propio grimorio (si no, solo las ve). */
  grimorioJugadores: boolean;
  /** Duración de la cuenta atrás de las nominaciones, en segundos. */
  segundosCuentaAtras: number;
  /** Lo que tarda la aguja en pasar de una ficha a la siguiente al votar, en segundos. */
  segundosPorFicha: number;
}

/**
 * La votación de una nominación: la aguja del nominado recorre las fichas en el
 * sentido de las agujas del reloj, del asiento siguiente al nominado hasta él.
 */
export interface SalaVotacion {
  /** Los asientos en el orden en que vota cada uno (el último, el nominado). */
  orden: string[];
  /** Cuántas fichas ha recorrido ya la aguja. */
  paso: number;
  /** Por asiento ya recorrido: los votos acumulados si votó, o null si no. */
  resultados: Record<string, number | null>;
  votos: number;
  terminada: boolean;
}

/** Una nominación en curso: de qué asiento a qué asiento (ids de asiento). */
export interface SalaNominacion {
  desde: string;
  hasta: string;
  /** Cuándo acaba la cuenta atrás (ms, reloj del servidor), o null si no ha empezado. */
  cuentaAtrasFin: number | null;
  /** La votación, desde que acaba la cuenta atrás. */
  votacion: SalaVotacion | null;
}

/** Una votación ya terminada, para el registro del narrador. */
export interface SalaRegistroVotacion {
  /** Cuándo terminó (ms). */
  hora: number;
  /** «asiento 1 (Ana)» o «asiento 1, libre». */
  nomina: string;
  nominado: string;
  /** Nombres de quienes votaron, en el orden en que votaron. */
  votantes: string[];
  votos: number;
}

/** Lo que el servidor manda a cada cliente cada vez que cambia la sala. */
export interface SalaEstado {
  participantes: SalaParticipante[];
  /** Los asientos de la mesa, en orden: el primero a las 12 y siguiendo como las agujas del reloj. */
  asientos: SalaAsiento[];
  configuracion: SalaConfiguracion;
  nominacion: SalaNominacion | null;
  /** Hora del servidor (ms) al mandar el estado: el cliente la usa para la cuenta atrás. */
  ahora: number;
  /** Registro de votaciones (la más reciente primero); solo se manda a los narradores. */
  votaciones: SalaRegistroVotacion[];
  /** id del participante que recibe el mensaje. */
  yo: string;
  /** Acciones que puede usar ahora quien recibe el mensaje (ver `salaAcciones`). */
  acciones: string[];
}
