import type { EtapaNarradorVirtual, SalaParticipante } from '../../../contrato/sala';
import type { SalaService } from '../../SalaService';

/**
 * Lo que puede hacer cada jugador en el día del narrador virtual (lo consultan las
 * acciones, para los permisos, y las etapas, para hacerlo): solo lee la sala.
 */

/** Las etapas del día (de los privados a las nominaciones). */
export const ETAPAS_DIA: readonly EtapaNarradorVirtual[] = ['privados', 'puestaEnComun', 'nominaciones'];

/** Las nominaciones de hoy (no las expulsiones de viajeros). */
const deHoy = (sala: SalaService) => sala.votaciones().filter((v) => v.dia === sala.fase().numero && !v.expulsion);

/** Si el de ese asiento ya ha nominado hoy. */
export const nominoHoy = (sala: SalaService, asientoId: string): boolean => deHoy(sala).some((v) => v.nominaAsiento === asientoId);

/** Si el de ese asiento ya ha sido nominado hoy. */
export const nominadoHoy = (sala: SalaService, asientoId: string): boolean => deHoy(sala).some((v) => v.nominadoAsiento === asientoId);

/** El día del narrador virtual (en alguna etapa del día), o null. */
export function diaVirtual(sala: SalaService) {
  const narrador = sala.narradorVirtual();
  return narrador && ETAPAS_DIA.includes(narrador.etapa) ? narrador : null;
}

/** Por qué no puede nominar ahora (o null, si puede): vivo, sentado, sin haber nominado hoy y sin otra nominación. */
export function noPuedeNominar(sala: SalaService, yo: SalaParticipante): string | null {
  if (sala.narradorVirtual()?.etapa !== 'nominaciones') return 'Ahora no es el momento de nominar.';
  const asiento = sala.asientoDe(yo.id);
  if (yo.rol !== 'jugador' || !asiento) return 'Solo nominan los jugadores sentados.';
  if (asiento.muerto) return 'Los muertos no nominan.';
  if (sala.nominacion()) return 'Ya hay una nominación en marcha.';
  if (nominoHoy(sala, asiento.id)) return 'Ya has nominado hoy.';
  return null;
}

/** Los jugadores de la partida: los que se sientan (los asientos libres no esperan a nadie). */
export const jugadoresSentados = (sala: SalaService): string[] =>
  sala.asientos().flatMap((a) => (a.ocupante ? [a.ocupante] : []));
