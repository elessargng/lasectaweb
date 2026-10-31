import { vivoEnJuego, type ReglaPersonaje } from './ReglaPersonaje';
import type { DefinicionPersonaje } from './DefinicionPersonaje';

/** Caníbal: tiene la habilidad del último ejecutado. En juego y vivo, pone su recordatorio en la ficha del ejecutado. */
const regla: ReglaPersonaje = {
  personaje: 'cannibal',
  alEjecutar: (ctx, ejecutado) => (vivoEnJuego(ctx, 'cannibal', ejecutado) ? { texto: 'Lunch', unico: true } : null),
};

export const canibal: DefinicionPersonaje = { regla };
