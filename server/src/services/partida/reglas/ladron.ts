import { tieneRecordatorio, type ReglaPersonaje } from './ReglaPersonaje';

/** Ladrón: el voto de quien lleva su recordatorio resta. */
export const ladron: ReglaPersonaje = {
  personaje: 'thief',
  multiplicaVoto: (_ctx, asiento) => (tieneRecordatorio(asiento, 'thief') ? -1 : 1),
};
