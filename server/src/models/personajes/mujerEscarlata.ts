import { droison, tieneRecordatorio, type ReglaPersonaje } from './ReglaPersonaje';
import { RecibeInformacion, tarjeta, type ContextoNoche } from '../partida/habilidades/HabilidadNocturna';
import type { Jugador } from '../partida/Jugador';

/** Con cuántos vivos (contando al demonio que muere) la Mujer Escarlata pasa a ser el demonio. */
const VIVOS_PARA_HEREDAR = 5;

const heredado = (jugador: Jugador) => tieneRecordatorio(jugador, 'scarletwoman', /^is the demon$/i);

/**
 * Mujer Escarlata (Scarlet Woman): viva y sana, si muere el demonio con cinco vivos
 * o más (contando al que muere), lo hereda: se le pone «Is The Demon» y cuenta como
 * el demonio. Esa noche (o al revelar, si acaba antes) pasa a ser el Imp.
 */
export const mujerEscarlata: ReglaPersonaje = {
  personaje: 'scarletwoman',
  esDemonio: (_ctx, jugador) => heredado(jugador),
  heredarDemonio: (ctx, vivos) => {
    const escarlata = vivos.find((a) => ctx.identidad(a) === 'scarletwoman' && !droison(ctx, a));
    return escarlata && vivos.length + 1 >= VIVOS_PARA_HEREDAR ? { jugador: escarlata, personaje: 'scarletwoman', texto: 'Is The Demon' } : null;
  },
  pasaASerDemonio: (ctx, jugador) =>
    ctx.identidad(jugador) === 'scarletwoman' && heredado(jugador)
      ? // Su «Is The Demon» la haría seguir siendo la Mujer Escarlata (es un recordatorio de identidad): fuera
        { personaje: 'imp', quitar: (r) => r.personaje === 'scarletwoman' && /^is the demon$/i.test(r.texto) }
      : null,
};

/** De noche, con su «Is The Demon», se le dice que es el nuevo Imp. */
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
export const mujerEscarlataDeNoche = new MujerEscarlata();
