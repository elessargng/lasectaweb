/**
 * El alineamiento y los faroles de un jugador.
 * Dominio que comparten el servidor y el cliente (alias @models): solo tipos y valores puros.
 */

/** Cuántos faroles hay: los del narrador y los de cada jugador. */
export const NUM_FAROLES = 3;

export type Alineamiento = 'bueno' | 'malvado';
