import { droison, type ReglaPersonaje } from './ReglaPersonaje';
import type { DefinicionPersonaje } from './DefinicionPersonaje';

/** Santo (Saint): si lo ejecutan sano, gana el mal. */
const regla: ReglaPersonaje = {
  personaje: 'saint',
  ganador: (ctx, { ejecutado }) => (ejecutado && ctx.identidad(ejecutado) === 'saint' && !droison(ctx, ejecutado) ? 'malvado' : undefined),
};

export const santo: DefinicionPersonaje = { regla };
