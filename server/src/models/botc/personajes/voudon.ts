import { lleva, vivoEnJuego, type ContextoReglas, type ReglaPersonaje } from './ReglaPersonaje';
import type { DefinicionPersonaje } from './DefinicionPersonaje';

export const VIAJERO_VOUDON = 'voudon';

/** El Voudon está vivo en la plaza (en la ficha o de verdad). */
export const voudonVivo = (ctx: ContextoReglas): boolean => vivoEnJuego(ctx, VIAJERO_VOUDON);

/**
 * Voudon (viajero): mientras está vivo, solo votan él y los muertos, los muertos
 * no necesitan ni gastan su voto y basta con 1 voto para la calavera.
 */
const regla: ReglaPersonaje = {
  personaje: VIAJERO_VOUDON,
  puedeVotar: (ctx, jugador) => (voudonVivo(ctx) ? jugador.muerto || lleva(ctx, jugador, VIAJERO_VOUDON) : undefined),
  votaSinGastar: (ctx) => voudonVivo(ctx),
  mayoria: (ctx) => (voudonVivo(ctx) ? 1 : undefined),
};

export const voudon: DefinicionPersonaje = { regla };
