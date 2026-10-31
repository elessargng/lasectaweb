import {
  alineamientosPosibles,
  numero,
  RecibeInformacion,
  segunRegistros,
  type ContextoNoche,
} from '../partida/habilidades/HabilidadNocturna';
import type { Jugador } from '../partida/Jugador';

/** El Chef: cuántas parejas de malvados se sientan juntos. */
class Chef extends RecibeInformacion {
  constructor() {
    super('chef');
  }

  /** Como mucho, una pareja por cada dos asientos. */
  maximoNumero(ctx: ContextoNoche): number {
    return Math.floor(ctx.plaza().length / 2);
  }

  protected informacion(ctx: ContextoNoche) {
    const plaza = ctx.plaza();
    const opciones = segunRegistros(ctx, plaza, (a) => alineamientosPosibles(ctx, a), (registro) => {
      const malvado = (a: Jugador) => (registro(a) ?? ctx.alineamiento(a)) === 'malvado';
      const parejas = plaza.length < 2 ? 0 : plaza.filter((a, i) => malvado(a) && malvado(plaza[(i + 1) % plaza.length])).length;
      // Con dos, la pareja se cuenta una vez
      return numero(plaza.length === 2 ? Math.min(parejas, 1) : parejas);
    });
    return { opciones };
  }
}
export const chef = new Chef();
