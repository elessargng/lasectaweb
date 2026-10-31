import type { ReglaPersonaje } from './ReglaPersonaje';

/**
 * Borracho (Drunk): no va en la bolsa; cree ser un aldeano (lleva su ficha) y su
 * «Is The Drunk» dice quién es de verdad. Está borracho siempre.
 */
export const borracho: ReglaPersonaje = {
  personaje: 'drunk',
  creeSerOtro: { tipo: 'townsfolk', recordatorio: 'Is The Drunk' },
  droison: (ctx, jugador) => (ctx.identidad(jugador) === 'drunk' ? 'borracho' : null),
};
