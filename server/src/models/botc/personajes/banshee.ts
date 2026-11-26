import { tieneRecordatorio, type ReglaPersonaje } from './ReglaPersonaje';
import type { Jugador } from '../partida/Jugador';
import type { DefinicionPersonaje } from './DefinicionPersonaje';

/** La Banshee muerta con su recordatorio «Has Ability» en la ficha. */
const conHabilidad = (jugador: Jugador) => jugador.muerto && tieneRecordatorio(jugador, 'banshee', /has ability/i);

/**
 * Banshee: muerta con su habilidad, vota aunque haya gastado su voto, sin
 * gastarlo, y puede levantar las dos manos (dos votos).
 */
const regla: ReglaPersonaje = {
  personaje: 'banshee',
  puedeVotar: (_ctx, jugador) => (conHabilidad(jugador) ? true : undefined),
  votaSinGastar: (_ctx, jugador) => conHabilidad(jugador),
  votaDoble: (_ctx, jugador) => conHabilidad(jugador),
  multiplicaVoto: (_ctx, jugador, dosManos) => (dosManos && conHabilidad(jugador) ? 2 : 1),
};

export const banshee: DefinicionPersonaje = { regla };
