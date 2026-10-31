/**
 * Cuántos personajes de cada tipo hay en una partida según el número de
 * jugadores (sin contar los viajeros). Es la tabla de Blood on the Clocktower:
 *
 * - 5 y 6 jugadores (partidas «teensy»): 3 aldeanos, 1 esbirro y 1 demonio, y con
 *   6 un forastero más.
 * - De 7 a 15: se empieza con 5 aldeanos, 1 esbirro y 1 demonio; cada jugador más
 *   es un forastero, hasta 2; el tercero suma un esbirro y los forasteros pasan a
 *   ser aldeanos (10: 7 aldeanos, 0 forasteros, 2 esbirros, 1 demonio)… hasta 15:
 *   9 aldeanos, 2 forasteros, 3 esbirros y 1 demonio.
 * - Más de 15 no cambia el reparto: los que sobran tienen que ser viajeros.
 */

export interface RepartoTipos {
  aldeanos: number;
  forasteros: number;
  esbirros: number;
  demonios: number;
}

export const MAXIMO_JUGADORES = 15;

/** El reparto para tantos jugadores (sin viajeros); null si son menos de 5. */
export function repartoPara(jugadores: number): RepartoTipos | null {
  if (jugadores < 5) return null;
  if (jugadores === 5) return { aldeanos: 3, forasteros: 0, esbirros: 1, demonios: 1 };
  if (jugadores === 6) return { aldeanos: 3, forasteros: 1, esbirros: 1, demonios: 1 };
  const n = Math.min(jugadores, MAXIMO_JUGADORES);
  const extra = n - 7;
  const esbirros = 1 + Math.floor(extra / 3);
  const forasteros = extra % 3;
  return { aldeanos: n - 1 - esbirros - forasteros, forasteros, esbirros, demonios: 1 };
}
