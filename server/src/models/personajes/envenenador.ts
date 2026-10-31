import { EligeYMarca } from '../partida/habilidades/HabilidadNocturna';
import { tieneRecordatorio, type ReglaPersonaje } from './ReglaPersonaje';

/** Envenenador (Poisoner): quien lleva su «Poisoned» está envenenado. */
export const envenenador: ReglaPersonaje = {
  personaje: 'poisoner',
  droison: (_ctx, jugador) => (tieneRecordatorio(jugador, 'poisoner', /^poisoned$/i) ? 'envenenado' : null),
};

/** De noche, envenena a uno (su «Poisoned»); puede elegirse a sí mismo. */
export const envenenadorDeNoche = new EligeYMarca('poisoner', 'Poisoned', { puedeElegirse: true, tramo: 'alteraATodos' });
