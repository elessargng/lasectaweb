import { EligeYSabe, numero, type ContextoNoche } from '../partida/habilidades/HabilidadNocturna';
import type { Jugador } from '../partida/Jugador';
import type { DefinicionPersonaje } from './DefinicionPersonaje';

/**
 * La Camarera: elige a dos jugadores vivos (no a sí misma) y sabe cuántos han
 * despertado esta noche por su habilidad. Va la última (ver TRAMOS_NOCHE), cuando
 * los demás ya han despertado.
 */
class Camarera extends EligeYSabe {
  constructor() {
    super('chambermaid', 2, false);
    this.tramo = 'veTodo';
  }

  /** Sus dos elegidos. */
  maximoNumero(): number {
    return 2;
  }

  protected saber(ctx: ContextoNoche, _asiento: Jugador, elegidos: Jugador[]) {
    const despertados = new Set(ctx.despertados?.() ?? []);
    return { opciones: [{ envio: numero(elegidos.filter((a) => despertados.has(a.id)).length), registros: [] }] };
  }
}
const deNoche = new Camarera();

export const camarera: DefinicionPersonaje = { deNoche };
