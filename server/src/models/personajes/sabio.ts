import type { OpcionDespertar } from '../compartido/despertar';
import {
  droison,
  esteJugadorEs,
  falta,
  informar,
  RecibeInformacion,
  tarjeta,
  tipoDe,
  type ContextoNoche,
  type Resultado,
} from '../partida/habilidades/HabilidadNocturna';
import type { Jugador } from '../partida/Jugador';

/** Le ha matado el demonio esta noche: muere y lleva el recordatorio de un demonio (su «Dead»). */
const muereAManosDelDemonio = (ctx: ContextoNoche, jugador: Jugador) =>
  jugador.muertePendiente && jugador.recordatorios.some((r) => ctx.personaje(r.personaje)?.tipo === 'demon');

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

  preparar(ctx: ContextoNoche, jugador: Jugador): Resultado {
    if (jugador.muerto) return falta([{ tipo: 'muerto' }]);
    if (!muereAManosDelDemonio(ctx, jugador)) return falta([{ tipo: 'noMuere' }]);
    return informar(ctx, jugador, this.informacion(ctx, jugador), [], true);
  }

  protected informacion(ctx: ContextoNoche, jugador: Jugador) {
    const plaza = ctx.plaza();
    const otros = plaza.filter((a) => a.id !== jugador.id);
    const demonio = otros.find((a) => tipoDe(ctx, a) === 'demon');
    const pareja = (a: Jugador, b: Jugador, personaje: string): OpcionDespertar => ({
      // En el orden de la plaza: que no se sepa cuál es
      envio: tarjeta('esteJugadorEs', { jugadores: plaza.filter((x) => x.id === a.id || x.id === b.id).map((x) => x.id), personajes: [personaje] }),
      registros: [],
    });
    const ciertas = demonio ? otros.filter((a) => a !== demonio).map((a) => pareja(demonio, a, ctx.identidad(demonio)!)) : [];
    // Droison, también dos que no son el demonio (con el demonio que hay, o el Imp)
    const personaje = demonio ? ctx.identidad(demonio)! : 'imp';
    const sinDemonio = otros.filter((a) => a !== demonio);
    const falsas = droison(ctx, jugador)
      ? sinDemonio.flatMap((a, i) => sinDemonio.slice(i + 1).map((b) => pareja(a, b, personaje)))
      : [];
    return { opciones: [...ciertas, ...falsas] };
  }
}
export const sabio = new Sabio();
