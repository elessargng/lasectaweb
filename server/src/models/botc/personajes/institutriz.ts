import { vivoEnJuego, type ReglaPersonaje } from './ReglaPersonaje';
import type { DefinicionPersonaje } from './DefinicionPersonaje';

/**
 * Institutriz (Matron): viva en la plaza (su ficha o quien es de verdad), los
 * jugadores solo pueden conversar en privado con sus vecinos.
 */
const regla: ReglaPersonaje = {
  personaje: 'matron',
  soloVecinos: (ctx) => vivoEnJuego(ctx, 'matron'),
};

export const institutriz: DefinicionPersonaje = { regla };
