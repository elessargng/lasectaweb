import type { Ritual, RitualSignupList } from '../../utils/ritualsApi';

export function isFull(list: RitualSignupList): boolean {
  return list.maxPlayers !== undefined && list.playerCount >= list.maxPlayers;
}

/** "11/12", o solo "11" si la lista no tiene límite. */
export function formatCount(list: RitualSignupList): string {
  return list.maxPlayers !== undefined ? `${list.playerCount}/${list.maxPlayers}` : String(list.playerCount);
}

/**
 * La lista que resume una partida en poco espacio: la de jugadores. En
 * Villacuervos va siempre la última, detrás de las de narración; por plazas no
 * se distingue, porque la co-narración a veces tiene tantas como los jugadores.
 */
export function mainSignupList(ritual: Ritual): RitualSignupList | undefined {
  const lists = ritual.signupLists ?? [];
  return [...lists].sort((a, b) => a.order - b.order).at(-1);
}

/**
 * Lo que se muestra en el resumen de una partida: en las online de La Secta, cuánta
 * gente hay apuntada; en las de Villacuervos, "11/12" de su lista principal; y
 * si no, las plazas.
 */
export function compactPlaces(ritual: Ritual): string | null {
  if (ritual.signupsEnabled) return String(ritual.attendees?.length ?? 0);
  const main = mainSignupList(ritual);
  if (main) return formatCount(main);
  return ritual.maxPlayers ? String(ritual.maxPlayers) : null;
}
