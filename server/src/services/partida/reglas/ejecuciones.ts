import { vivoEnJuego, type ReglaPersonaje } from './ReglaPersonaje';

/**
 * Los personajes que funcionan con las ejecuciones. Los de los recordatorios, en
 * juego y vivos (en la ficha —el Borracho que se cree Enterrador también— o de
 * verdad), ponen el suyo en la ficha del ejecutado.
 */

/** Caníbal: tiene la habilidad del último ejecutado. */
export const canibal: ReglaPersonaje = {
  personaje: 'cannibal',
  alEjecutar: (ctx, ejecutado) => (vivoEnJuego(ctx, 'cannibal', ejecutado) ? { texto: 'Lunch', unico: true } : null),
};

/** Enterrador: esta noche sabe qué personaje fue ejecutado hoy. */
export const enterrador: ReglaPersonaje = {
  personaje: 'undertaker',
  alEjecutar: (ctx, ejecutado) => (vivoEnJuego(ctx, 'undertaker', ejecutado) ? { texto: 'Die Today', unico: true } : null),
};

/** Leviatán: si se ejecuta a más de un bueno, gana el mal (cada bueno ejecutado lleva su recordatorio). */
export const leviatan: ReglaPersonaje = {
  personaje: 'leviathan',
  alEjecutar: (ctx, ejecutado) =>
    ctx.alineamiento(ejecutado) === 'bueno' && vivoEnJuego(ctx, 'leviathan', ejecutado)
      ? { texto: 'Good Player Executed', unico: false }
      : null,
};

export const VIAJERO_BUTCHER = 'butcher';

/** Carnicero (viajero): vivo (de verdad), tras la primera ejecución se puede nominar otra vez (no anochece). */
export const carnicero: ReglaPersonaje = {
  personaje: VIAJERO_BUTCHER,
  impideAnochecer: (ctx) => ctx.mesa().some((a) => !a.muerto && ctx.identidad(a) === VIAJERO_BUTCHER),
};
