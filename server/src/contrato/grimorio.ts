/**
 * Lo que el narrador apunta en el grimorio (recordatorios, notas) y el grimorio que envía al Espía o a la Viuda.
 * Parte del contrato de la sala de juego (ver sala.ts): solo tipos y valores puros.
 */
import type { Alineamiento } from './jugador';

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
 * Un grimorio enviado (el último) a un asiento: cuándo, sus fichas (en el orden de
 * la mesa) y los faroles del demonio (ids de personaje, hasta NUM_FAROLES).
 */
export interface GrimorioEnviadoDto {
  hora: number;
  fichas: FichaEnviadaDto[];
  faroles: string[];
}

/** El largo máximo de la nota de un asiento. */
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
