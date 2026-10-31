import type { ReglaPersonaje } from './ReglaPersonaje';
import type { DefinicionPersonaje } from './DefinicionPersonaje';

const VIAJERO_BUTCHER = 'butcher';

/** Carnicero (viajero): vivo (de verdad), tras la primera ejecución se puede nominar otra vez (no anochece). */
const regla: ReglaPersonaje = {
  personaje: VIAJERO_BUTCHER,
  impideAnochecer: (ctx) => ctx.plaza().some((a) => !a.muerto && ctx.identidad(a) === VIAJERO_BUTCHER),
};

export const carnicero: DefinicionPersonaje = { regla };
