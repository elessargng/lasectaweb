/**
 * La calavera y el grimorio que el narrador envía al Espía o a la Viuda.
 * Lo que se envía al cliente (alias @views): solo tipos, sin Node ni servicios.
 */
import type { Alineamiento } from './jugador';

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
  /** Con texto propio, el icono del centro ('_secta', '_pluma', '_interrogante' o un personaje del guion). Sin él, el logo de La Secta. */
  icono?: string;
}

/**
 * Una ficha del grimorio que el narrador envía al Espía o a la Viuda: lo que se
 * ve de ella (el narrador puede cambiarlo antes de enviarlo).
 */
export interface FichaEnviadaDto {
  jugadorId: string;
  personaje: string | null;
  alineamiento: Alineamiento | null;
  muerto: boolean;
  recordatorios: Recordatorio[];
}

/**
 * Un grimorio enviado (el último) a un jugador: cuándo, sus fichas (en el orden de
 * la plaza) y los faroles del demonio (ids de personaje, hasta NUM_FAROLES).
 */
export interface GrimorioEnviadoDto {
  hora: number;
  fichas: FichaEnviadaDto[];
  faroles: string[];
}

/**
 * La calavera: el único jugador marcado para ser ejecutado y con cuántos votos se
 * le puso (desde una nominación ya votada), o null si se puso a mano.
 */
export interface CalaveraDto {
  jugadorId: string;
  votos: number | null;
}
