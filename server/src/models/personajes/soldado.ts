import { A_NADIE } from './Objetivo';
import { droison, type ReglaPersonaje } from './ReglaPersonaje';

/** Soldado (Soldier): sano, a salvo de cualquier demonio. */
export const soldado: ReglaPersonaje = {
  personaje: 'soldier',
  alterarObjetivo: (ctx, jugador, base) =>
    ctx.identidad(jugador) === 'soldier' && !droison(ctx, jugador)
      ? { recibe: (accion) => (accion.origen === 'demonio' ? A_NADIE : base.recibe(accion)) }
      : base,
};
