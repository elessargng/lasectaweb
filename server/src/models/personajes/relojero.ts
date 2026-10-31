import { numero, RecibeInformacion, segunRegistros, type ContextoNoche } from '../partida/habilidades/HabilidadNocturna';
import type { Registro } from '../compartido/despertar';
import type { Jugador } from '../partida/Jugador';

/**
 * Cómo puede registrar un jugador para el Relojero (ver Percepcion): el demonio,
 * un esbirro o ninguno, lo de verdad primero; nada, si es seguro.
 */
function comoRegistra(ctx: ContextoNoche, jugador: Jugador): Registro[] {
  const percepcion = ctx.percepcion(jugador);
  const [demonio, esbirro] = [percepcion.esDemonio(), percepcion.esEsbirro()];
  if (demonio.length === 1 && esbirro.length === 1) return [];
  const ninguno: Registro = demonio.length > 1 && esbirro.length > 1 ? 'niDemonioNiEsbirro' : demonio.length > 1 ? 'noDemonio' : 'noEsbirro';
  const como = demonio.flatMap((d) => esbirro.flatMap((e): Registro[] => (d && e ? [] : [d ? 'demonio' : e ? 'esbirro' : ninguno])));
  return [...new Set(como)];
}

/**
 * El Relojero: cuántos pasos hay del demonio a su esbirro más cercano (los asientos
 * libres cuentan). Quien puede registrar como demonio o esbirro, lo decide el narrador.
 */
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
    const opciones = segunRegistros(ctx, plaza, (a) => comoRegistra(ctx, a), (registro) => {
      const es = (a: Jugador, como: 'demonio' | 'esbirro') => {
        const r = registro(a);
        if (r) return r === como;
        const percepcion = ctx.percepcion(a);
        return (como === 'demonio' ? percepcion.esDemonio() : percepcion.esEsbirro())[0];
      };
      const posiciones = (como: 'demonio' | 'esbirro') => plaza.flatMap((a, i) => (es(a, como) ? [i] : []));
      const distancias = posiciones('demonio').flatMap((d) => posiciones('esbirro').map((e) => Math.min(Math.abs(d - e), n - Math.abs(d - e))));
      return numero(distancias.length ? Math.min(...distancias) : 0);
    });
    return { opciones };
  }
}
export const relojero = new Relojero();
