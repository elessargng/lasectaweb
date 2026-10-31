import { EligeYMarca } from '../partida/habilidades/HabilidadNocturna';

/** El Monje: protege a otro del demonio esta noche (su «Safe»). */
export const monje = new EligeYMarca('monk', 'Safe', { puedeElegirse: false, tramo: 'alteraAlDemonio' });
