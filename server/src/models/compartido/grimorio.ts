/**
 * Los recordatorios y las notas del grimorio.
 * Dominio que comparten el servidor y el cliente (alias @models): solo tipos y valores puros.
 */

/** El largo máximo de la nota del narrador sobre un jugador. */
export const SALA_NOTA_LARGO_MAX = 500;

/**
 * El «personaje» de un recordatorio con texto propio (escrito por el narrador, sin
 * personaje ni icono): su texto es el que se escribió, de hasta SALA_RECORDATORIO_TEXTO_MAX.
 */
export const RECORDATORIO_TEXTO = '_texto';

export const SALA_RECORDATORIO_TEXTO_MAX = 14;

/**
 * Una ficha recordatorio: de qué personaje es (su icono) y cuál de sus recordatorios.
 * Con texto propio, `personaje` es RECORDATORIO_TEXTO e `indice`, -1.
 */
export interface Recordatorio {
  id: string;
  personaje: string;
  /** Cuál de los recordatorios del personaje (su posición en la lista del guion). */
  indice: number;
  /** Su texto en el original (el cliente lo traduce si puede). */
  texto: string;
  /**
   * Con texto propio, el icono del centro: uno de ICONOS_RECORDATORIO_TEXTO o el
   * id de un personaje del guion. Sin él, el logo de La Secta.
   */
  icono?: string;
}

/** Los iconos que no son de un personaje para un recordatorio con texto propio. */
export const ICONOS_RECORDATORIO_TEXTO = ['_secta', '_pluma', '_interrogante'];
