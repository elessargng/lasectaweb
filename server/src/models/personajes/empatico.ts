import {
  alineamientosPosibles,
  numero,
  RecibeInformacion,
  segunRegistros,
  vecinosVivos,
  type ContextoNoche,
} from '../partida/habilidades/HabilidadNocturna';
import type { Jugador } from '../partida/Jugador';

/** El Empático: cuántos de sus dos vecinos vivos son malvados. */
class Empatico extends RecibeInformacion {
  constructor() {
    super('empath');
  }

  /** Sus dos vecinos. */
  maximoNumero(): number {
    return 2;
  }

  protected informacion(ctx: ContextoNoche, jugador: Jugador) {
    const vecinos = vecinosVivos(ctx, jugador);
    const opciones = segunRegistros(ctx, vecinos, (a) => alineamientosPosibles(ctx, a), (registro) =>
      numero(vecinos.filter((a) => (registro(a) ?? ctx.alineamiento(a)) === 'malvado').length),
    );
    return { opciones };
  }
}
export const empatico = new Empatico();
