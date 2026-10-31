import { droison, tieneRecordatorio } from '../../partida/reglas/ReglaPersonaje';
import type { SalaDeJuego } from '../../../services/SalaDeJuego';
import type { ContextoEtapa } from '../etapas/Etapa';
import { contextoNoche, tipoReal } from '../plazaDeJuego';
import { ponerRecordatorio } from '../noche/requisitos';
import { identidadDe } from '../../partida/Grimorio';
import type { Jugador } from '../../partida/Jugador';

/** Con cuántos vivos (contando al demonio que muere) la Mujer Escarlata pasa a ser el demonio. */
const VIVOS_PARA_HEREDAR = 5;

export type Ganador = 'bueno' | 'malvado';

/** Es un demonio: lo es de verdad o es la Mujer Escarlata que ya lo ha heredado («Is The Demon»). */
export const esDemonio = (juego: SalaDeJuego, jugador: Jugador): boolean =>
  tipoReal(juego, jugador) === 'demon' || tieneRecordatorio(jugador, 'scarletwoman', /^is the demon$/i);

/**
 * La Mujer Escarlata que ha heredado el demonio («Is The Demon») pasa a ser el Imp:
 * su ficha cambia (lo que fue se apunta para contarlo al revelar). Por la noche,
 * después de que su despertar le diga «Tú eres el Imp» y antes de que despierte el
 * demonio; o al revelar, si la partida acaba antes.
 */
export async function escarlataAImp(ctx: ContextoEtapa): Promise<void> {
  const { partida } = ctx.juego;
  for (const a of partida.plaza()) {
    if (identidadDe(a) !== 'scarletwoman' || !tieneRecordatorio(a, 'scarletwoman', /^is the demon$/i)) continue;
    ctx.recuerdos.cronica.antes.set(a.id, 'scarletwoman');
    await ctx.plaza.accion('narrador:cambiarPersonaje', { jugadorId: a.id, personajeId: 'imp' });
    // Su «Is The Demon» la hace seguir siendo la Mujer Escarlata (es un recordatorio de identidad): fuera
    for (const r of a.recordatorios.filter((r) => r.personaje === 'scarletwoman' && /^is the demon$/i.test(r.texto))) {
      await ctx.plaza.accion('narrador:quitarRecordatorio', { jugadorId: a.id, recordatorioId: r.id });
    }
  }
}

/** Los vivos que cuentan para el final: sin muerte y sin viajeros. */
const vivos = (juego: SalaDeJuego) => juego.partida.plaza().filter((a) => !a.muerto && !a.muertePendiente && tipoReal(juego, a) !== 'traveller');

/** Con cuántos vivos gana el Alcalde si el día acaba sin ejecución. */
const VIVOS_ALCALDE = 3;

/**
 * Si la partida ha terminado tras una muerte (o al acabar el día), y quién gana:
 * - ejecutado el Santo (sano), el malvado;
 * - sin demonio vivo, el bueno (salvo que la Mujer Escarlata, viva y sana, lo herede:
 *   había 5 vivos o más, contando al demonio; se le pone «Is The Demon» y sigue: esa
 *   noche pasa a ser el Imp, ver escarlataAImp);
 * - con solo dos vivos, el malvado;
 * - acabado el día sin ejecución, con tres vivos y el Alcalde vivo (y sano), el bueno.
 * Si no, null.
 */
export async function comprobarFinal(
  ctx: ContextoEtapa,
  { ejecutado, sinEjecucion = false }: { ejecutado?: string; sinEjecucion?: boolean } = {},
): Promise<Ganador | null> {
  const { juego } = ctx;
  const { partida } = juego;
  const noche = contextoNoche(juego);
  const ejecutadoHoy = ejecutado ? partida.plaza().find((a) => a.id === ejecutado) : undefined;
  if (ejecutadoHoy && identidadDe(ejecutadoHoy) === 'saint' && !droison(noche, ejecutadoHoy)) return 'malvado';
  const quedan = vivos(juego);
  if (
    sinEjecucion &&
    quedan.length === VIVOS_ALCALDE &&
    quedan.some((a) => esDemonio(juego, a)) &&
    quedan.some((a) => identidadDe(a) === 'mayor' && !droison(noche, a))
  ) {
    return 'bueno';
  }
  if (!quedan.some((a) => esDemonio(juego, a))) {
    const escarlata = quedan.find((a) => identidadDe(a) === 'scarletwoman' && !droison(noche, a));
    if (escarlata && quedan.length + 1 >= VIVOS_PARA_HEREDAR) {
      await ponerRecordatorio(ctx, escarlata.id, 'scarletwoman', 'Is The Demon');
      return quedan.length <= 2 ? 'malvado' : null;
    }
    return 'bueno';
  }
  return quedan.length <= 2 ? 'malvado' : null;
}
