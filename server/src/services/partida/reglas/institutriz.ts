import { vivoEnJuego, type ReglaPersonaje } from './ReglaPersonaje';

/**
 * Institutriz (Matron): viva en la mesa (su ficha o quien es de verdad), los
 * jugadores solo pueden conversar en privado con sus vecinos.
 */
export const institutriz: ReglaPersonaje = {
  personaje: 'matron',
  soloVecinos: (ctx) => vivoEnJuego(ctx, 'matron'),
};
