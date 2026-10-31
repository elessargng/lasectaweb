import { EligeYMarca } from '../partida/habilidades/HabilidadNocturna';

/** El Mayordomo: elige a su amo (su «Master»), que no puede ser él. */
export const mayordomo = new EligeYMarca('butler', 'Master', { puedeElegirse: false });
