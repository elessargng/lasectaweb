import { lleva, vivoEnJuego, type ContextoReglas, type ReglaPersonaje } from './ReglaPersonaje';

export const VIAJERO_VOUDON = 'voudon';

/** El Voudon está vivo en la mesa (en la ficha o de verdad). */
export const voudonVivo = (ctx: ContextoReglas): boolean => vivoEnJuego(ctx, VIAJERO_VOUDON);

/**
 * Voudon (viajero): mientras está vivo, solo votan él y los muertos, los muertos
 * no necesitan ni gastan su voto y basta con 1 voto para la calavera.
 */
export const voudon: ReglaPersonaje = {
  personaje: VIAJERO_VOUDON,
  puedeVotar: (ctx, asiento) => (voudonVivo(ctx) ? asiento.muerto || lleva(ctx, asiento, VIAJERO_VOUDON) : undefined),
  votaSinGastar: (ctx) => voudonVivo(ctx),
  mayoria: (ctx) => (voudonVivo(ctx) ? 1 : undefined),
};
