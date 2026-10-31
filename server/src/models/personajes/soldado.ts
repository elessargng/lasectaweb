import { aSalvo } from './AnteElDemonio';
import { droison, type ReglaPersonaje } from './ReglaPersonaje';

/** Soldado (Soldier): sano, está a salvo del demonio. */
export const soldado: ReglaPersonaje = {
  personaje: 'soldier',
  alterarAnteElDemonio: (ctx, jugador, base) => (ctx.identidad(jugador) === 'soldier' && !droison(ctx, jugador) ? aSalvo() : base),
};
