import type { DefinicionPersonaje } from './DefinicionPersonaje';

/** Lord of Typhon: en la bolsa no va ningún esbirro (los elige él, a sus lados) y puede haber cualquier número de forasteros. */
export const lordOfTyphon: DefinicionPersonaje = { bolsa: { personaje: 'lordoftyphon', forasteros: 'libre', esbirros: 'ninguno' } };
