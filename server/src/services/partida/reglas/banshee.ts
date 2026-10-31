import { tieneRecordatorio, type ReglaPersonaje } from './ReglaPersonaje';
import type { Jugador } from '../Jugador';

/** La Banshee muerta con su recordatorio «Has Ability» en la ficha. */
const conHabilidad = (asiento: Jugador) => asiento.muerto && tieneRecordatorio(asiento, 'banshee', /has ability/i);

/**
 * Banshee: muerta con su habilidad, vota aunque haya gastado su voto, sin
 * gastarlo, y puede levantar las dos manos (dos votos).
 */
export const banshee: ReglaPersonaje = {
  personaje: 'banshee',
  puedeVotar: (_ctx, asiento) => (conHabilidad(asiento) ? true : undefined),
  votaSinGastar: (_ctx, asiento) => conHabilidad(asiento),
  votaDoble: (_ctx, asiento) => conHabilidad(asiento),
  multiplicaVoto: (_ctx, asiento, dosManos) => (dosManos && conHabilidad(asiento) ? 2 : 1),
};
