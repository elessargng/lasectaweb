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
