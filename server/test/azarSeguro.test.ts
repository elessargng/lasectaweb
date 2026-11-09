import { describe, expect, it } from 'vitest';
import { azarSeguro } from '../src/infra/azar';
import { barajar } from '../src/models/partida/azar';

/** El azar de verdad: los tests de la sala usan uno con semilla, así que este no lo prueba nadie más. */
describe('azarSeguro', () => {
  it('da números entre 0 (incluido) y 1 (sin incluir)', () => {
    for (let i = 0; i < 1000; i++) {
      const n = azarSeguro();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });

  it('sirve para barajar', () => {
    const lista = Array.from({ length: 20 }, (_, i) => i);
    expect([...barajar(lista, azarSeguro)].sort((a, b) => a - b)).toEqual(lista);
  });
});
