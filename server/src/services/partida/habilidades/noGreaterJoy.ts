import type { SalaAsiento, SalaOpcionDespertar } from '../../../contrato/sala';
import {
  droison,
  EligeYSabe,
  falta,
  informar,
  numero,
  RecibeInformacion,
  tarjeta,
  tipoDe,
  type ContextoNoche,
  type HabilidadNocturna,
  type Resultado,
} from './HabilidadNocturna';
import { demonios, esbirros } from './malvados';
import { empatico, imp, investigador, mujerEscarlata } from './troubleBrewing';

/**
 * Las habilidades de noche de No Greater Joy (para 5 o 6 jugadores): las de
 * Trouble Brewing que trae y las del Relojero, la Camarera y el Sabio. El Artista y
 * el Patoso actúan de día (ver narradorVirtual/dia); el Borracho y el Barón, al preparar.
 */

/** El Relojero: cuántos pasos hay del demonio a su esbirro más cercano (los asientos libres cuentan). */
class Relojero extends RecibeInformacion {
  constructor() {
    super('clockmaker');
  }

  /** Como mucho, media mesa. */
  maximoNumero(ctx: ContextoNoche): number {
    return Math.floor(ctx.mesa().length / 2);
  }

  protected informacion(ctx: ContextoNoche) {
    const mesa = ctx.mesa();
    const n = mesa.length;
    const posiciones = (tipo: string) => mesa.flatMap((a, i) => (tipoDe(ctx, a) === tipo ? [i] : []));
    const distancias = posiciones('demon').flatMap((d) => posiciones('minion').map((e) => Math.min(Math.abs(d - e), n - Math.abs(d - e))));
    return { opciones: [{ envio: numero(distancias.length ? Math.min(...distancias) : 0), registros: [] }] };
  }
}
export const relojero = new Relojero();

/**
 * La Camarera: elige a dos jugadores vivos (no a sí misma) y sabe cuántos han
 * despertado esta noche por su habilidad. Va la última (ver TRAMOS_NOCHE), cuando
 * los demás ya han despertado.
 */
class Camarera extends EligeYSabe {
  constructor() {
    super('chambermaid', 2, false);
    this.tramo = 'veTodo';
  }

  /** Sus dos elegidos. */
  maximoNumero(): number {
    return 2;
  }

  protected saber(ctx: ContextoNoche, _asiento: SalaAsiento, elegidos: SalaAsiento[]) {
    const despertados = new Set(ctx.despertados?.() ?? []);
    return { opciones: [{ envio: numero(elegidos.filter((a) => despertados.has(a.id)).length), registros: [] }] };
  }
}
export const camarera = new Camarera();

/** Le ha matado el demonio esta noche: muere y lleva el recordatorio de un demonio (su «Dead»). */
const muereAManosDelDemonio = (ctx: ContextoNoche, asiento: SalaAsiento) =>
  asiento.muertePendiente && asiento.recordatorios.some((r) => ctx.personaje(r.personaje)?.tipo === 'demon');

/**
 * El Sabio: si le mata el demonio, despierta y sabe que es uno de dos jugadores.
 * Cuál es el otro lo elige el narrador (lo revisa siempre); droison, también puede
 * enseñarle dos que no lo son.
 */
class Sabio extends RecibeInformacion {
  constructor() {
    super('sage');
    this.despiertaAlMorir = true;
    this.tipoEnsenado = 'demon';
  }

  preparar(ctx: ContextoNoche, asiento: SalaAsiento): Resultado {
    if (asiento.muerto) return falta([{ tipo: 'muerto' }]);
    if (!muereAManosDelDemonio(ctx, asiento)) return falta([{ tipo: 'noMuere' }]);
    return informar(ctx, asiento, this.informacion(ctx, asiento), [], true);
  }

  protected informacion(ctx: ContextoNoche, asiento: SalaAsiento) {
    const mesa = ctx.mesa();
    const otros = mesa.filter((a) => a.id !== asiento.id);
    const demonio = otros.find((a) => tipoDe(ctx, a) === 'demon');
    const pareja = (a: SalaAsiento, b: SalaAsiento, personaje: string): SalaOpcionDespertar => ({
      // En el orden de la mesa: que no se sepa cuál es
      envio: tarjeta('esteJugadorEs', { jugadores: mesa.filter((x) => x === a || x === b).map((x) => x.id), personajes: [personaje] }),
      registros: [],
    });
    const ciertas = demonio ? otros.filter((a) => a !== demonio).map((a) => pareja(demonio, a, ctx.identidad(demonio)!)) : [];
    // Droison, también dos que no son el demonio (con el demonio que hay, o el Imp)
    const personaje = demonio ? ctx.identidad(demonio)! : 'imp';
    const sinDemonio = otros.filter((a) => a !== demonio);
    const falsas = droison(ctx, asiento)
      ? sinDemonio.flatMap((a, i) => sinDemonio.slice(i + 1).map((b) => pareja(a, b, personaje)))
      : [];
    return { opciones: [...ciertas, ...falsas] };
  }
}
export const sabio = new Sabio();

export const HABILIDADES_NO_GREATER_JOY: readonly HabilidadNocturna[] = [
  esbirros,
  demonios,
  imp,
  mujerEscarlata,
  investigador,
  empatico,
  relojero,
  camarera,
  sabio,
];
