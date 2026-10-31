import type { SalaDto, ParticipanteDto } from './useSala';

/** Cómo se nombra un asiento para el lector: «asiento 3 (Bea)» o «asiento 3, libre». */
export const describirAsiento = (numero: number, ocupante: ParticipanteDto | null) =>
  ocupante ? `asiento ${numero} (${ocupante.nombre})` : `asiento ${numero}, libre`;

/**
 * Si dos participantes son vecinos en la mesa: el asiento ocupado más cercano a
 * cada lado (los libres se saltan). Como en el servidor (la Institutriz).
 */
export function sonVecinos(estado: SalaDto, unoId: string, otroId: string): boolean {
  const ocupados = estado.plaza.filter((a) => a.participanteId);
  const i = ocupados.findIndex((a) => a.participanteId === unoId);
  const n = ocupados.length;
  if (i < 0 || n < 2) return false;
  return [ocupados[(i + 1) % n].participanteId, ocupados[(i - 1 + n) % n].participanteId].includes(otroId);
}

/** El número (desde 1) y quien se sienta en un asiento del estado. */
export function datosAsiento(estado: SalaDto, jugadorId: string) {
  const i = estado.plaza.findIndex((a) => a.id === jugadorId);
  const ocupanteId = estado.plaza[i]?.participanteId;
  const ocupante = ocupanteId ? (estado.participantes.find((p) => p.id === ocupanteId) ?? null) : null;
  return { numero: i + 1, ocupante };
}
