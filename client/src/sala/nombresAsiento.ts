import type { SalaEstado, SalaParticipante } from './useSala';

/** Cómo se nombra un asiento para el lector: «asiento 3 (Bea)» o «asiento 3, libre». */
export const describirAsiento = (numero: number, ocupante: SalaParticipante | null) =>
  ocupante ? `asiento ${numero} (${ocupante.nombre})` : `asiento ${numero}, libre`;

/** El número (desde 1) y quien se sienta en un asiento del estado. */
export function datosAsiento(estado: SalaEstado, asientoId: string) {
  const i = estado.asientos.findIndex((a) => a.id === asientoId);
  const ocupanteId = estado.asientos[i]?.ocupante;
  const ocupante = ocupanteId ? (estado.participantes.find((p) => p.id === ocupanteId) ?? null) : null;
  return { numero: i + 1, ocupante };
}
