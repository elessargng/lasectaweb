import type { Registro } from '../compartido/despertar';
import { tieneRecordatorio } from './ReglaPersonaje';
import {
  dudoso,
  EligeYSabe,
  ficha,
  pideRecordatorio,
  segunRegistros,
  tipoDe,
  type ContextoNoche,
} from '../partida/habilidades/HabilidadNocturna';
import type { Jugador } from '../partida/Jugador';

/** La Adivina: «Sí» si alguno de los dos es el demonio (o lleva su «Red Herring»). La Reclusa puede registrar como demonio. */
class Adivina extends EligeYSabe {
  constructor() {
    super('fortuneteller', 2);
  }

  protected requisitos(ctx: ContextoNoche) {
    return pideRecordatorio(ctx, this.personaje, 'Red Herring');
  }

  protected saber(ctx: ContextoNoche, _asiento: Jugador, elegidos: Jugador[]) {
    const posibles = (a: Jugador): Registro[] => (ctx.identidad(a) === 'recluse' && dudoso(ctx, a) ? ['noDemonio', 'demonio'] : []);
    const opciones = segunRegistros(ctx, elegidos, posibles, (registro) => {
      const demonio = (a: Jugador) => {
        const r = registro(a);
        return r ? r === 'demonio' : tipoDe(ctx, a) === 'demon';
      };
      const si = elegidos.some((a) => demonio(a) || tieneRecordatorio(a, this.personaje, /^red herring$/i));
      return ficha(si ? 'si' : 'no');
    });
    return { opciones };
  }
}
export const adivina = new Adivina();
