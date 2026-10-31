import { droison, type ReglaPersonaje } from './ReglaPersonaje';

/** Santo (Saint): si lo ejecutan sano, gana el mal. */
export const santo: ReglaPersonaje = {
  personaje: 'saint',
  ganador: (ctx, { ejecutado }) => (ejecutado && ctx.identidad(ejecutado) === 'saint' && !droison(ctx, ejecutado) ? 'malvado' : undefined),
};
