import { EligeYMarca } from '../partida/habilidades/HabilidadNocturna';
import type { DefinicionPersonaje } from './DefinicionPersonaje';

/** El Mayordomo: elige a su amo (su «Master»), que no puede ser él. */
const deNoche = new EligeYMarca('butler', 'Master', { puedeElegirse: false });

export const mayordomo: DefinicionPersonaje = { deNoche };
