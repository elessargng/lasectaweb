import type { OpcionDespertar } from '../compartido/despertar';
import {
  droison,
  esteJugadorEs,
  falta,
  informar,
  RecibeInformacion,
  tarjeta,
  type ContextoNoche,
  type Resultado,
} from '../partida/habilidades/HabilidadNocturna';
import type { Jugador } from '../partida/Jugador';

/** Le ha matado el demonio esta noche: muere y lleva el recordatorio de un demonio (su «Dead»). */
const muereAManosDelDemonio = (ctx: ContextoNoche, jugador: Jugador) =>
  jugador.muertePendiente && jugador.recordatorios.some((r) => ctx.personaje(r.personaje)?.tipo === 'demon');

/**
 * El Sabio: si le mata el demonio, despierta y sabe que es uno de dos jugadores.
 * Cuál es el otro lo elige el narrador (lo revisa siempre), y también si le enseña
 * a quien puede registrar como demonio (ver Percepcion); droison, también puede
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
    const demonioDeVerdad = (a: Jugador) => ctx.percepcion(a).esDemonio()[0];
    // Quien puede registrar como demonio (el de verdad, primero), y como cuál
    const comoDemonio = (a: Jugador) => ctx.percepcion(a).personaje().find((p) => p && ctx.personaje(p)?.tipo === 'demon');
    const candidatos = [...otros.filter(demonioDeVerdad), ...otros.filter((a) => !demonioDeVerdad(a) && ctx.percepcion(a).esDemonio().includes(true))];
    const pareja = (a: Jugador, b: Jugador, personaje: string, registra = false): OpcionDespertar => ({
      // En el orden de la plaza: que no se sepa cuál es
      envio: tarjeta('esteJugadorEs', { jugadores: plaza.filter((x) => x.id === a.id || x.id === b.id).map((x) => x.id), personajes: [personaje] }),
      registros: registra ? [{ jugador: a.id, como: 'demonio' }] : [],
    });
    const ciertas = candidatos.flatMap((c) => {
      const personaje = comoDemonio(c);
      return personaje ? otros.filter((a) => a !== c).map((a) => pareja(c, a, personaje, !demonioDeVerdad(c))) : [];
    });
    // Droison, también dos que no son el demonio (con el demonio que hay, o el Imp)
    const demonio = otros.find(demonioDeVerdad);
    const personaje = demonio ? ctx.identidad(demonio)! : 'imp';
    const sinDemonio = otros.filter((a) => !demonioDeVerdad(a));
    const falsas = droison(ctx, jugador)
      ? sinDemonio.flatMap((a, i) => sinDemonio.slice(i + 1).map((b) => pareja(a, b, personaje)))
      : [];
    // Sin repetir la misma tarjeta (la primera, la de verdad)
    const opciones = new Map<string, OpcionDespertar>();
    for (const o of [...ciertas, ...falsas]) if (!opciones.has(JSON.stringify(o.envio))) opciones.set(JSON.stringify(o.envio), o);
    return { opciones: [...opciones.values()] };
  }
}
export const sabio = new Sabio();
