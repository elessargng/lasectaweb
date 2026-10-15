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

/** Si apuntarse es solo avisar de que se piensa ir: presenciales y eventos. */
export function isIntention(ritual: Ritual): boolean {
  return ritual.attendanceMode === 'intencion';
}

/**
 * Lo que se muestra en el resumen de una partida: en las online de La Secta, cuánta
 * gente hay apuntada; en las de Villacuervos, "11/12" de su lista principal; y
 * si no, las plazas. En las presenciales y los eventos siguen las plazas: quien
 * quiere asistir no las ocupa.
 */
export function compactPlaces(ritual: Ritual): string | null {
  if (ritual.signupsEnabled && !isIntention(ritual)) return String(ritual.attendees?.length ?? 0);
  const main = mainSignupList(ritual);
  if (main) return formatCount(main);
  return ritual.maxPlayers ? String(ritual.maxPlayers) : null;
}

/**
 * Resumen de quién va, para la tarjeta del lateral: "4 quieren asistir, contigo",
 * "5 apuntados de 12 plazas" o "11/12 inscritos en Villacuervos". La lista
 * completa solo está en el detalle.
 */
export function attendanceSummary(ritual: Ritual, userId?: string): string | null {
  if (ritual.signupsEnabled) {
    const count = ritual.attendees?.length ?? 0;
    const withYou = !!userId && !!ritual.attendees?.some((a) => a.userId === userId);
    const text = isIntention(ritual)
      ? `${count} ${count === 1 ? 'quiere' : 'quieren'} asistir`
      : `${count} ${count === 1 ? 'apuntado' : 'apuntados'}${ritual.maxPlayers ? ` de ${ritual.maxPlayers} plazas` : ''}`;
    return withYou ? `${text}, contigo` : text;
  }
  const main = mainSignupList(ritual);
  if (main) return `${formatCount(main)} inscritos en Villacuervos`;
  return null;
}
