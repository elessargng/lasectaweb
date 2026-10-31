import { A_NADIE } from './Objetivo';
import { droison, type ReglaPersonaje } from './ReglaPersonaje';
import type { DefinicionPersonaje } from './DefinicionPersonaje';

/** Marinero (Sailor): sano, no puede morir (de nada). */
const regla: ReglaPersonaje = {
  personaje: 'sailor',
  alterarObjetivo: (ctx, jugador, base) =>
    ctx.identidad(jugador) === 'sailor' && !droison(ctx, jugador) ? { recibe: (accion) => (accion.efecto === 'matar' ? A_NADIE : base.recibe(accion)) } : base,
};

export const marinero: DefinicionPersonaje = { regla };
