/**
 * El reparto de la partida que vale en los dos lados (lo importa también el
 * cliente, alias @contrato): cuántos forasteros cambian los personajes que alteran
 * la preparación y el reparto que toca con ellos. Solo valores puros.
 */
import type { SalaDistribucion } from './sala';

/**
 * Cuántos forasteros de más (o de menos) puede haber por cada personaje que
 * altera la preparación; los aldeanos compensan (el total de los dos no cambia).
 * 'cualquiera': cualquier número de forasteros. Los legendarios cuentan si están
 * en juego como NPC (el Centinela).
 */
export const FORASTEROS: Record<string, (jugadores: number) => number[] | 'cualquiera'> = {
  sentinel: () => [-1, 0, 1],
  vigormortis: () => [-1],
  fanggu: () => [1],
  baron: (jugadores) => [jugadores >= 7 ? 2 : 1],
  balloonist: () => [0, 1],
  hermit: () => [0, -1],
  godfather: () => [1, -1],
  xaan: () => 'cualquiera',
  kazali: () => 'cualquiera',
  lordoftyphon: () => 'cualquiera',
};

/**
 * El reparto que toca con los personajes que cambian los forasteros sin dejar
 * elegir (el Barón, el Vigormortis, el Fang Gu…: una sola opción): sus forasteros
 * de más o de menos ya puestos, y los aldeanos compensando. Los que dejan elegir
 * (el Ermitaño, el Padrino, el Centinela…) no lo cambian. Sin reparto (menos de 5), el mismo.
 */
export function repartoAjustado(distribucion: SalaDistribucion, presentes: string[]): SalaDistribucion {
  const { jugadores, aldeanos, forasteros } = distribucion;
  if (aldeanos === null || forasteros === null) return distribucion;
  let desvio = 0;
  for (const id of new Set(presentes)) {
    const regla = FORASTEROS[id]?.(jugadores);
    if (Array.isArray(regla) && regla.length === 1) desvio += regla[0];
  }
  // Sin pasarse: ni forasteros por debajo de 0 ni aldeanos por debajo de 0
  const ajuste = Math.max(-forasteros, Math.min(aldeanos, desvio));
  return { ...distribucion, aldeanos: aldeanos - ajuste, forasteros: forasteros + ajuste };
}
