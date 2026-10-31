/**
 * El jugador de la plaza tal como se envía, su alineamiento y sus faroles.
 * Parte del contrato de la sala de juego (ver sala.ts): solo tipos y valores puros.
 */
import type { Recordatorio } from './grimorio';

/**
 * Un asiento de la mesa (las sillas de la partida). Cada asiento tiene su ficha,
 * haya alguien sentado o no: la muerte y la calavera son de la ficha.
 */
export interface JugadorDto {
  id: string;
  /** id del participante sentado (un jugador), o null si está libre. */
  ocupante: string | null;
  /** Su ficha está muerta (lleva sudario). */
  muerto: boolean;
  /**
   * Muerta de noche, a falta de que el narrador lo anuncie (de día, al pulsar el
   * sudario): aún no cuenta como muerta. Solo la ven quienes ven el grimorio.
   */
  muertePendiente: boolean;
  /**
   * Muerta, ya ha gastado el único voto que le queda (se apaga su vela). Es
   * público: todos saben qué muertos pueden votar todavía. Al morir o revivir
   * vuelve a false.
   */
  votoGastado: boolean;
  /** Su ficha lleva la calavera (solo una de la mesa). */
  marcado: boolean;
  /** Con cuántos votos se le puso la calavera (desde una nominación ya votada), o null. */
  votosMarca: number | null;
  /**
   * El personaje de su ficha (id del catálogo o del guion), o null si no tiene.
   * Solo lo ven los narradores y quien se sienta en ese asiento (el suyo).
   */
  personaje: string | null;
  /**
   * Su alineamiento si el narrador lo ha cambiado; null: el de su tipo (aldeanos
   * y forasteros, buenos; esbirros y demonios, malvados; viajeros, sin decidir).
   */
  alineamiento: Alineamiento | null;
  /**
   * Las fichas recordatorio puestas junto a la suya, en el orden en que se
   * pusieron. Son del grimorio: las ven los narradores (y quien ve el grimorio),
   * no los jugadores, ni en su propia ficha.
   */
  recordatorios: Recordatorio[];
  /**
   * La nota del narrador sobre este asiento (texto libre), o null. Es del
   * grimorio, como los recordatorios: la ven los narradores y quien ve el grimorio.
   */
  nota: string | null;
  /**
   * Los faroles que el jugador de este asiento se ha puesto (o ha copiado de
   * los del narrador): siempre 3 casillas, cada una un id de personaje o null.
   * Los ven quien se sienta ahí y quien ve el personaje del asiento.
   */
  faroles: (string | null)[];
  /**
   * El farol que dice estar usando (uno de `faroles`), o null: el personaje por el
   * que se hace pasar. Lo ven los mismos que ven sus faroles (y el narrador).
   */
  farolEnUso: string | null;
}

/** Cuántos faroles hay: los del narrador y los de cada asiento. */
export const NUM_FAROLES = 3;

export type Alineamiento = 'bueno' | 'malvado';
