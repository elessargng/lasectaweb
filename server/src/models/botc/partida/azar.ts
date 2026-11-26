/**
 * Un número al azar entre 0 (incluido) y 1 (sin incluir). Viene de fuera
 * (infra/azar; en los tests, con semilla): el dominio no sabe de dónde sale.
 */
export type Azar = () => number;

/** Un entero al azar entre 0 (incluido) y n. */
export const enteroAlAzar = (n: number, azar: Azar): number => Math.min(n - 1, Math.floor(azar() * n));

/** Una copia de la lista barajada (Fisher-Yates). */
export function barajar<T>(lista: readonly T[], azar: Azar): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = enteroAlAzar(i + 1, azar);
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}
