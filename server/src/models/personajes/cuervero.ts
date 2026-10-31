import type { AvisoHabilidad } from '../compartido/despertar';
import { EligeYSabe, esteJugadorEs, type ContextoNoche } from '../partida/habilidades/HabilidadNocturna';
import type { Jugador } from '../partida/Jugador';

/** El Ravenkeeper: si muere esta noche, elige a un jugador y sabe quién es. */
class Cuervero extends EligeYSabe {
  constructor() {
    super('ravenkeeper', 1);
    this.despiertaAlMorir = true;
  }

  protected requisitos(_ctx: ContextoNoche, jugador: Jugador): AvisoHabilidad[] {
    return jugador.muertePendiente ? [] : [{ tipo: 'noMuere' }];
  }

  protected saber(ctx: ContextoNoche, _asiento: Jugador, [elegido]: Jugador[]) {
    return esteJugadorEs(ctx, [elegido], elegido);
  }
}
export const cuervero = new Cuervero();
