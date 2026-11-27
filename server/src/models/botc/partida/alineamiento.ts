/**
 * El alineamiento y los faroles de un jugador.
 * Lo que viaja al cliente tiene su copia en el contrato (views/botc/dto, ver views/botc/contrato.ts).
 */

/** Cuántos faroles hay: los del narrador y los de cada jugador. */
export const NUM_FAROLES = 3;

export type Alineamiento = 'bueno' | 'malvado';
