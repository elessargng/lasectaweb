import { vivoEnJuego, type ReglaPersonaje } from './ReglaPersonaje';
import {
  conRecordatorio,
  esteJugadorEs,
  pideRecordatorio,
  RecibeInformacion,
  type ContextoNoche,
} from '../partida/habilidades/HabilidadNocturna';
import type { DefinicionPersonaje } from './DefinicionPersonaje';

/**
 * Enterrador: esta noche sabe qué personaje fue ejecutado hoy. En juego y vivo (en
 * la ficha —el Borracho que se cree Enterrador también— o de verdad), pone su
 * recordatorio en la ficha del ejecutado.
 */
const regla: ReglaPersonaje = {
  personaje: 'undertaker',
  alEjecutar: (ctx, ejecutado) => (vivoEnJuego(ctx, 'undertaker', ejecutado) ? { texto: 'Die Today', unico: true } : null),
};

/** El Enterrador: quién era el ejecutado hoy (el que lleva su «Die Today»). */
class Enterrador extends RecibeInformacion {
  constructor() {
    super('undertaker');
  }

  protected requisitos(ctx: ContextoNoche) {
    return pideRecordatorio(ctx, this.personaje, 'Die Today');
  }

  protected informacion(ctx: ContextoNoche) {
    const ejecutado = conRecordatorio(ctx, this.personaje, 'Die Today')!;
    return esteJugadorEs(ctx, [ejecutado], ejecutado);
  }
}
const deNoche = new Enterrador();

export const enterrador: DefinicionPersonaje = { regla, deNoche };
