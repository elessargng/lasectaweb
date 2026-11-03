import type { DefinicionPersonaje } from './DefinicionPersonaje';

/** Centinela (Sentinel, legendario): puede haber un forastero de más o de menos. */
export const centinela: DefinicionPersonaje = { bolsa: { personaje: 'sentinel', forasteros: [-1, 0, 1] } };
