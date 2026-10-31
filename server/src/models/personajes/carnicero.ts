import type { ReglaPersonaje } from './ReglaPersonaje';

const VIAJERO_BUTCHER = 'butcher';

/** Carnicero (viajero): vivo (de verdad), tras la primera ejecución se puede nominar otra vez (no anochece). */
export const carnicero: ReglaPersonaje = {
  personaje: VIAJERO_BUTCHER,
  impideAnochecer: (ctx) => ctx.plaza().some((a) => !a.muerto && ctx.identidad(a) === VIAJERO_BUTCHER),
};
