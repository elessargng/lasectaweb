import { tieneRecordatorio } from './ReglaPersonaje';
import { EligeYSabe, ficha, pideRecordatorio, registros, segunRegistros, type ContextoNoche } from '../partida/habilidades/HabilidadNocturna';
import type { Jugador } from '../partida/Jugador';

/** La Adivina: «Sí» si alguno de los dos es el demonio (o lleva su «Red Herring»). Quien puede registrar como demonio, lo decide el narrador. */
class Adivina extends EligeYSabe {
  constructor() {
    super('fortuneteller', 2);
  }

  protected requisitos(ctx: ContextoNoche) {
    return pideRecordatorio(ctx, this.personaje, 'Red Herring');
  }

  protected saber(ctx: ContextoNoche, _asiento: Jugador, elegidos: Jugador[]) {
    const posibles = (a: Jugador) => registros(ctx.percepcion(a).esDemonio(), 'demonio', 'noDemonio');
    const opciones = segunRegistros(ctx, elegidos, posibles, (registro) => {
      const demonio = (a: Jugador) => {
        const r = registro(a);
        return r ? r === 'demonio' : ctx.percepcion(a).esDemonio()[0];
      };
      const si = elegidos.some((a) => demonio(a) || tieneRecordatorio(a, this.personaje, /^red herring$/i));
      return ficha(si ? 'si' : 'no');
    });
    return { opciones };
  }
}
export const adivina = new Adivina();
