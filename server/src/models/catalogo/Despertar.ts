/** Cuándo se despierta un personaje en una noche: su posición y lo que hace el narrador. */
export interface Despertar {
  /** Posición en el orden de esa noche (menor, antes); null si no se despierta. */
  orden: number | null;
  recordatorio: string | null;
}
