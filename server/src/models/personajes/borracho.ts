import type { ReglaPersonaje } from './ReglaPersonaje';
import type { DefinicionPersonaje } from './DefinicionPersonaje';

/**
 * Borracho (Drunk): no va en la bolsa; cree ser un aldeano (lleva su ficha) y su
 * «Is The Drunk» dice quién es de verdad. Está borracho siempre.
 */
const regla: ReglaPersonaje = {
  personaje: 'drunk',
  creeSerOtro: { tipo: 'townsfolk', recordatorio: 'Is The Drunk' },
  droison: (ctx, jugador) => (ctx.identidad(jugador) === 'drunk' ? 'borracho' : null),
};

export const borracho: DefinicionPersonaje = { regla };
