import type { SalaDeJuego } from '../../SalaDeJuego';
import type { ContextoEtapa } from '../etapas/Etapa';
import { tipoReal } from '../plazaDeJuego';
import { ponerRecordatorio } from '../noche/requisitos';
import type { Jugador } from '../../partida/Jugador';

export type Ganador = 'bueno' | 'malvado';

/** Es un demonio: lo es de verdad o cuenta como tal (ver ReglaPersonaje.esDemonio: la Mujer Escarlata que lo ha heredado). */
export const esDemonio = ({ partida }: SalaDeJuego, jugador: Jugador): boolean => partida.reglas.esDemonio(jugador);

/**
 * Quien ha heredado el demonio pasa a serlo (ver ReglaPersonaje.pasaASerDemonio):
 * su ficha cambia (lo que fue se apunta para contarlo al revelar) y se le quitan
 * los recordatorios que dice. Por la noche, después de que su despertar le diga
 * «Tú eres el Imp» y antes de que despierte el demonio; o al revelar, si la
 * partida acaba antes.
 */
export async function heredadosADemonio(ctx: ContextoEtapa): Promise<void> {
  const { partida } = ctx.juego;
  for (const a of partida.plaza()) {
    const pasa = partida.reglas.pasaASerDemonio(a);
    if (!pasa || !a.personaje) continue;
    ctx.recuerdos.cronica.antes.set(a.id, a.personaje);
    await ctx.plaza.cambiarPersonaje(a.id, pasa.personaje);
    for (const r of a.recordatorios.filter(pasa.quitar)) {
      await ctx.plaza.quitarRecordatorio(a.id, r.id);
    }
  }
}

/** Los vivos que cuentan para el final: sin muerte y sin viajeros. */
const vivos = (juego: SalaDeJuego) => juego.partida.plaza().filter((a) => !a.muerto && !a.muertePendiente && tipoReal(juego, a) !== 'traveller');

/**
 * Si la partida ha terminado tras una muerte (o al acabar el día), y quién gana:
 * - lo que diga un personaje (ver ReglaPersonaje.ganador: el Santo ejecutado, el Alcalde);
 * - sin demonio vivo, el bueno (salvo que alguien lo herede, ver
 *   ReglaPersonaje.heredarDemonio: se le pone su recordatorio y sigue);
 * - con solo dos vivos, el malvado.
 * Si no, null.
 */
export async function comprobarFinal(
  ctx: ContextoEtapa,
  { ejecutado, sinEjecucion = false }: { ejecutado?: string; sinEjecucion?: boolean } = {},
): Promise<Ganador | null> {
  const { juego } = ctx;
  const { partida } = juego;
  const quedan = vivos(juego);
  const hayDemonio = quedan.some((a) => esDemonio(juego, a));
  const ejecutadoHoy = ejecutado ? partida.plaza().find((a) => a.id === ejecutado) : undefined;
  const final = partida.reglas.finalPorPersonaje({ vivos: quedan, ejecutado: ejecutadoHoy, sinEjecucion, hayDemonio });
  if (final) {
    // Lo ha acabado un personaje (el Santo, el Alcalde): su logro
    ctx.recuerdos.cronica.causas.add(final.personaje);
    return final.ganador;
  }
  if (!hayDemonio) {
    const herencia = partida.reglas.heredarDemonio(quedan);
    if (!herencia) return 'bueno';
    await ponerRecordatorio(ctx, herencia.jugador.id, herencia.personaje, herencia.texto);
  }
  return quedan.length <= 2 ? 'malvado' : null;
}
