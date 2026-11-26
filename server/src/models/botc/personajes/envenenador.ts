import { EligeYMarca } from '../partida/habilidades/HabilidadNocturna';
import { tieneRecordatorio, type ReglaPersonaje } from './ReglaPersonaje';
import type { DefinicionPersonaje } from './DefinicionPersonaje';

/** Envenenador (Poisoner): quien lleva su «Poisoned» está envenenado. */
const regla: ReglaPersonaje = {
  personaje: 'poisoner',
  droison: (_ctx, jugador) => (tieneRecordatorio(jugador, 'poisoner', /^poisoned$/i) ? 'envenenado' : null),
};

/** De noche, envenena a uno (su «Poisoned»); puede elegirse a sí mismo. */
const deNoche = new EligeYMarca('poisoner', 'Poisoned', { puedeElegirse: true, tramo: 'alteraATodos' });

export const envenenador: DefinicionPersonaje = { regla, deNoche };
