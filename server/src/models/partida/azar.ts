import { randomInt } from 'crypto';

/** Una copia de la lista barajada al azar (Fisher-Yates). */
export const barajar = <T>(lista: readonly T[]): T[] => {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
};

/** Una copia de la lista barajada (Fisher-Yates) con este azar (en los tests, con semilla). */
export function barajarCon<T>(lista: readonly T[], azar: () => number): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}
