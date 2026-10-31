import { vivoEnJuego, type ReglaPersonaje } from './ReglaPersonaje';

/** Caníbal: tiene la habilidad del último ejecutado. En juego y vivo, pone su recordatorio en la ficha del ejecutado. */
export const canibal: ReglaPersonaje = {
  personaje: 'cannibal',
  alEjecutar: (ctx, ejecutado) => (vivoEnJuego(ctx, 'cannibal', ejecutado) ? { texto: 'Lunch', unico: true } : null),
};
