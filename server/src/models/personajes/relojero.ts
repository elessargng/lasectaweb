import { numero, RecibeInformacion, tipoDe, type ContextoNoche } from '../partida/habilidades/HabilidadNocturna';

/** El Relojero: cuántos pasos hay del demonio a su esbirro más cercano (los asientos libres cuentan). */
class Relojero extends RecibeInformacion {
  constructor() {
    super('clockmaker');
  }

  /** Como mucho, media plaza. */
  maximoNumero(ctx: ContextoNoche): number {
    return Math.floor(ctx.plaza().length / 2);
  }

  protected informacion(ctx: ContextoNoche) {
    const plaza = ctx.plaza();
    const n = plaza.length;
    const posiciones = (tipo: string) => plaza.flatMap((a, i) => (tipoDe(ctx, a) === tipo ? [i] : []));
    const distancias = posiciones('demon').flatMap((d) => posiciones('minion').map((e) => Math.min(Math.abs(d - e), n - Math.abs(d - e))));
    return { opciones: [{ envio: numero(distancias.length ? Math.min(...distancias) : 0), registros: [] }] };
  }
}
export const relojero = new Relojero();
