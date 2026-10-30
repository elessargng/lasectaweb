import type { EtapaNarradorVirtual } from '../../../contrato/sala';
import type { Participante } from '../../sala/Participantes';
import type { SalaDeJuego } from '../../SalaDeJuego';

/**
 * Lo que puede hacer cada jugador en el día del narrador virtual (lo consultan las
 * acciones, para los permisos, y las etapas, para hacerlo): solo lee la sala.
 */

/** Las etapas del día (de los privados a las nominaciones). */
export const ETAPAS_DIA: readonly EtapaNarradorVirtual[] = ['privados', 'puestaEnComun', 'nominaciones'];

/** Las nominaciones de hoy (no las expulsiones de viajeros). */
const deHoy = ({ partida }: SalaDeJuego) => partida.nominaciones.votaciones().filter((v) => v.dia === partida.fases.actual().numero && !v.expulsion);

/** Si el de ese asiento ya ha nominado hoy. */
export const nominoHoy = (juego: SalaDeJuego, asientoId: string): boolean => deHoy(juego).some((v) => v.nominaAsiento === asientoId);

/** Si el de ese asiento ya ha sido nominado hoy. */
export const nominadoHoy = (juego: SalaDeJuego, asientoId: string): boolean => deHoy(juego).some((v) => v.nominadoAsiento === asientoId);

/** El día del narrador virtual (en alguna etapa del día), o null. */
export function diaVirtual(juego: SalaDeJuego) {
  const narrador = juego.narrador.actual();
  return narrador && ETAPAS_DIA.includes(narrador.etapa) ? narrador : null;
}

/** Por qué no puede nominar ahora (o null, si puede): vivo, sentado, sin haber nominado hoy y sin otra nominación. */
export function noPuedeNominar(juego: SalaDeJuego, yo: Participante): string | null {
  const { partida, narrador } = juego;
  if (narrador.actual()?.etapa !== 'nominaciones') return 'Ahora no es el momento de nominar.';
  const asiento = partida.asientoDe(yo.id);
  if (yo.rol !== 'jugador' || !asiento) return 'Solo nominan los jugadores sentados.';
  if (asiento.muerto) return 'Los muertos no nominan.';
  if (partida.nominaciones.nominacion()) return 'Ya hay una nominación en marcha.';
  if (nominoHoy(juego, asiento.id)) return 'Ya has nominado hoy.';
  return null;
}

/** Los jugadores de la partida: los que se sientan (los asientos libres no esperan a nadie). */
export const jugadoresSentados = ({ partida }: SalaDeJuego): string[] =>
  partida.mesa().flatMap((a) => (a.ocupante ? [a.ocupante] : []));

/** Los jugadores muertos: como no nominan, están listos para la noche desde el principio del día. */
export const muertosSentados = ({ partida }: SalaDeJuego): string[] =>
  partida.mesa().flatMap((a) => (a.ocupante && a.muerto ? [a.ocupante] : []));
