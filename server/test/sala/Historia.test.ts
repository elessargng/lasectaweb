import { describe, expect, it } from 'vitest';
import { Historia } from '../../src/models/partida/Historia';

describe('Historia', () => {
  it('hace el paso y devuelve lo que devuelva; mientras, está en curso', () => {
    const historia = new Historia();
    expect(historia.enCurso()).toBe(false);
    const dentro = historia.hacer('p1', 'dia:nominar', () => historia.enCurso());
    expect(dentro).toBe(true);
    expect(historia.enCurso()).toBe(false);
  });

  it('un paso dentro de otro es parte de él; si falla, se cierra igual', () => {
    const historia = new Historia();
    historia.hacer('p1', 'fase:irANoche', () => {
      historia.hacer('sistema', 'dia:votacion', () => undefined);
      expect(historia.enCurso()).toBe(true);
    });
    expect(() => historia.hacer('p1', 'grimorio:vida', () => {
      throw new Error('falla');
    })).toThrow('falla');
    expect(historia.enCurso()).toBe(false);
  });
});
