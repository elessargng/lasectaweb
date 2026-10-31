import { A_NADIE } from './Objetivo';
import { droison, type ReglaPersonaje } from './ReglaPersonaje';
import type { DefinicionPersonaje } from './DefinicionPersonaje';

/** Soldado (Soldier): sano, a salvo de cualquier demonio. */
const regla: ReglaPersonaje = {
  personaje: 'soldier',
  alterarObjetivo: (ctx, jugador, base) =>
    ctx.identidad(jugador) === 'soldier' && !droison(ctx, jugador)
      ? { recibe: (accion) => (accion.origen === 'demonio' ? A_NADIE : base.recibe(accion)) }
      : base,
};

export const soldado: DefinicionPersonaje = { regla };
