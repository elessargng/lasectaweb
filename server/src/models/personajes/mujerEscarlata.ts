import { tieneRecordatorio } from './ReglaPersonaje';
import { RecibeInformacion, tarjeta, type ContextoNoche } from '../partida/habilidades/HabilidadNocturna';
import type { Jugador } from '../partida/Jugador';

/** La Mujer Escarlata: con su «Is The Demon», es el nuevo Imp. */
class MujerEscarlata extends RecibeInformacion {
  constructor() {
    super('scarletwoman');
  }

  protected requisitos(_ctx: ContextoNoche, jugador: Jugador) {
    return tieneRecordatorio(jugador, this.personaje, /^is the demon$/i) ? [] : [{ tipo: 'faltaRecordatorio' as const, personaje: this.personaje, texto: 'Is The Demon' }];
  }

  protected informacion() {
    return { opciones: [{ envio: tarjeta('tuEres', { personajes: ['imp'], alineamiento: 'malvado' }), registros: [] }] };
  }
}
export const mujerEscarlata = new MujerEscarlata();
