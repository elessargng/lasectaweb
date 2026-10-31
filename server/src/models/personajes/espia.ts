import { RecibeInformacion, sinEfectos } from '../partida/habilidades/HabilidadNocturna';
import { oTambien, siONo } from './Percepcion';
import type { ReglaPersonaje } from './ReglaPersonaje';

/**
 * Espía (Spy): puede registrar como bueno y como aldeano o forastero, aunque esté
 * muerto. Qué personaje bueno, lo elige el narrador entre los del guion.
 */
export const espia: ReglaPersonaje = {
  personaje: 'spy',
  alterarPercepcion: (ctx, base) => ({
    ...base,
    esBueno: () => siONo(base.esBueno()),
    esEsbirro: () => siONo(base.esEsbirro()),
    esAldeano: () => siONo(base.esAldeano()),
    esForastero: () => siONo(base.esForastero()),
    personaje: () =>
      oTambien(
        base.personaje(),
        ctx.personajesDelGuion().flatMap((p) => (p.tipo === 'townsfolk' || p.tipo === 'outsider' ? [p.id] : [])),
      ),
  }),
};

/** De noche, ve el grimorio. */
class Espia extends RecibeInformacion {
  constructor() {
    super('spy');
    this.tramo = 'veTodo';
  }

  protected informacion() {
    return { opciones: [], efectos: { ...sinEfectos(), grimorio: true } };
  }
}
export const espiaDeNoche = new Espia();
