import type { SalaEstado, SalaParticipante } from './useSala';

/** Cómo se nombra un asiento para el lector: «asiento 3 (Bea)» o «asiento 3, libre». */
export const describirAsiento = (numero: number, ocupante: SalaParticipante | null) =>
  ocupante ? `asiento ${numero} (${ocupante.nombre})` : `asiento ${numero}, libre`;

/**
 * Si dos participantes son vecinos en la mesa: el asiento ocupado más cercano a
 * cada lado (los libres se saltan). Como en el servidor (la Institutriz).
 */
export function sonVecinos(estado: SalaEstado, unoId: string, otroId: string): boolean {
  const ocupados = estado.asientos.filter((a) => a.ocupante);
  const i = ocupados.findIndex((a) => a.ocupante === unoId);
  const n = ocupados.length;
  if (i < 0 || n < 2) return false;
  return [ocupados[(i + 1) % n].ocupante, ocupados[(i - 1 + n) % n].ocupante].includes(otroId);
}

/** El número (desde 1) y quien se sienta en un asiento del estado. */
export function datosAsiento(estado: SalaEstado, asientoId: string) {
  const i = estado.asientos.findIndex((a) => a.id === asientoId);
  const ocupanteId = estado.asientos[i]?.ocupante;
  const ocupante = ocupanteId ? (estado.participantes.find((p) => p.id === ocupanteId) ?? null) : null;
  return { numero: i + 1, ocupante };
}
