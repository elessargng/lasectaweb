/** El reloj del narrador: cuánto puede durar y cómo se dice el tiempo (como el servidor, SALA_RELOJ). */
export const RELOJ = { minSegundos: 5, maxSegundos: 60 * 60, mensajeMax: 120 };

/** Cuánto se sigue viendo al acabar, con su «¡Tiempo!» (ms; como el servidor). */
export const RELOJ_TRAS_FIN_MS = 15_000;

/** «4:05», «0:30», «12:00» (lo que queda, redondeado hacia arriba al segundo). */
export function formatoReloj(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** «5 minutos», «30 segundos», «1 minuto y 30 segundos». */
export function duracionReloj(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  const minutos = m === 1 ? '1 minuto' : `${m} minutos`;
  const segs = s === 1 ? '1 segundo' : `${s} segundos`;
  if (m === 0) return segs;
  return s === 0 ? minutos : `${minutos} y ${segs}`;
}

/** «Reloj de 5 minutos: Conversaciones privadas.» (lo que se dice al ponerlo). */
export function anuncioReloj(segundos: number, mensaje: string): string {
  return `Reloj de ${duracionReloj(segundos)}${mensaje ? `: ${mensaje}` : ''}.`;
}
