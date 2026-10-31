import { A_NADIE } from './Objetivo';
import { droison, type ReglaPersonaje } from './ReglaPersonaje';

/** Marinero (Sailor): sano, no puede morir (de nada). */
export const marinero: ReglaPersonaje = {
  personaje: 'sailor',
  alterarObjetivo: (ctx, jugador, base) =>
    ctx.identidad(jugador) === 'sailor' && !droison(ctx, jugador) ? { recibe: (accion) => (accion.efecto === 'matar' ? A_NADIE : base.recibe(accion)) } : base,
};
