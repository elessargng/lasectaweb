import { EligeYMarca } from '../partida/habilidades/HabilidadNocturna';

/** El Envenenador: cada noche envenena a uno (su «Poisoned»); puede elegirse a sí mismo. */
export const envenenador = new EligeYMarca('poisoner', 'Poisoned', { puedeElegirse: true, tramo: 'alteraATodos' });
