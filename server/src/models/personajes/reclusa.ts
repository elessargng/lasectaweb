import { oTambien, siONo } from './Percepcion';
import type { ReglaPersonaje } from './ReglaPersonaje';

/**
 * Reclusa (Recluse): puede registrar como malvada y como esbirro o demonio, aunque
 * esté muerta. Qué personaje malvado, lo elige el narrador entre los del guion.
 */
export const reclusa: ReglaPersonaje = {
  personaje: 'recluse',
  alterarPercepcion: (ctx, base) => ({
    ...base,
    esBueno: () => siONo(base.esBueno()),
    esDemonio: () => siONo(base.esDemonio()),
    esEsbirro: () => siONo(base.esEsbirro()),
    esForastero: () => siONo(base.esForastero()),
    personaje: () =>
      oTambien(
        base.personaje(),
        ctx.personajesDelGuion().flatMap((p) => (p.tipo === 'minion' || p.tipo === 'demon' ? [p.id] : [])),
      ),
  }),
};
