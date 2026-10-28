/**
 * El volumen de voz de cada participante (0 a 1, por su id), fuera de React:
 * cambia muchas veces por segundo y volver a pintar la mesa con cada medida
 * sería caro. Lo escribe la videollamada (lo mío, medido en mi micrófono; lo de
 * los demás, lo que dice el servidor) y lo lee el aro de quien habla (BordeHabla),
 * que lo pasa directamente a una variable CSS.
 */
type Oyente = (nivel: number) => void;

const niveles = new Map<string, number>();
const oyentes = new Map<string, Set<Oyente>>();

export function fijarNivelVoz(id: string, nivel: number) {
  const n = Math.min(1, Math.max(0, nivel));
  if (niveles.get(id) === n) return;
  niveles.set(id, n);
  oyentes.get(id)?.forEach((o) => o(n));
}

/** Avisa de cada cambio de nivel de alguien (y del actual, al suscribirse); devuelve cómo dejar de oír. */
export function oirNivelVoz(id: string, oyente: Oyente) {
  let suyos = oyentes.get(id);
  if (!suyos) oyentes.set(id, (suyos = new Set()));
  suyos.add(oyente);
  oyente(niveles.get(id) ?? 0);
  return () => {
    suyos.delete(oyente);
    if (!suyos.size) oyentes.delete(id);
  };
}
