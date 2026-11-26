import { useSyncExternalStore } from 'react';

const MENOS_MOVIMIENTO = '(prefers-reduced-motion: reduce)';

/** Si el sistema pide menos movimiento (y se entera si cambia). */
export function useMenosMovimiento(): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const consulta = window.matchMedia(MENOS_MOVIMIENTO);
      consulta.addEventListener('change', avisar);
      return () => consulta.removeEventListener('change', avisar);
    },
    () => window.matchMedia(MENOS_MOVIMIENTO).matches,
  );
}
