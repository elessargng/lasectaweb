import { tieneRecordatorio, type ReglaPersonaje } from './ReglaPersonaje';

/** Burócrata: el voto de quien lleva su recordatorio vale por tres. */
export const burocrata: ReglaPersonaje = {
  personaje: 'bureaucrat',
  multiplicaVoto: (_ctx, asiento) => (tieneRecordatorio(asiento, 'bureaucrat') ? 3 : 1),
};
