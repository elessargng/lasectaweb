import type { ReglaPersonaje } from './ReglaPersonaje';
import type { DefinicionPersonaje } from './DefinicionPersonaje';

export const ESBIRRO_ORGAN_GRINDER = 'organgrinder';

/**
 * Organ Grinder: vivo (de verdad: un Borracho que se cree Organ Grinder no
 * cuenta) y sin un recordatorio «Drunk» en su ficha (el suyo, al elegir estar
 * borracho, o el de otro), las votaciones son secretas (ver Nominacion.privada).
 */
const regla: ReglaPersonaje = {
  personaje: ESBIRRO_ORGAN_GRINDER,
  votacionSecreta: (ctx) => {
    const og = ctx.plaza().find((a) => !a.muerto && ctx.identidad(a) === ESBIRRO_ORGAN_GRINDER);
    return !!og && !og.recordatorios.some((r) => /^drunk$/i.test(r.texto.trim()));
  },
};

export const organGrinder: DefinicionPersonaje = { regla };
