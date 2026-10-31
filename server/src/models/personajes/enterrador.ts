import { vivoEnJuego, type ReglaPersonaje } from './ReglaPersonaje';

/**
 * Enterrador: esta noche sabe qué personaje fue ejecutado hoy. En juego y vivo (en
 * la ficha —el Borracho que se cree Enterrador también— o de verdad), pone su
 * recordatorio en la ficha del ejecutado.
 */
export const enterrador: ReglaPersonaje = {
  personaje: 'undertaker',
  alEjecutar: (ctx, ejecutado) => (vivoEnJuego(ctx, 'undertaker', ejecutado) ? { texto: 'Die Today', unico: true } : null),
};
