import { describe, expect, it } from 'vitest';
import { Fases } from '../../src/models/partida/Fases';

describe('Fases', () => {
  it('empieza en la preparación y va noche 1, día 1, noche 2', () => {
    const fases = new Fases();
    expect(fases.actual()).toEqual({ momento: 'preparacion', numero: 0, reinicios: 0 });
    fases.anochecer();
    expect(fases.actual()).toEqual({ momento: 'noche', numero: 1, reinicios: 0 });
    fases.amanecer();
    expect(fases.actual()).toEqual({ momento: 'dia', numero: 1, reinicios: 0 });
    fases.anochecer();
    expect(fases.actual()).toEqual({ momento: 'noche', numero: 2, reinicios: 0 });
  });

  it('otra partida vuelve a la preparación y cuenta un reinicio', () => {
    const fases = new Fases();
    fases.anochecer();
    fases.nuevaPartida();
    expect(fases.actual()).toEqual({ momento: 'preparacion', numero: 0, reinicios: 1 });
  });

  it('al restaurar vuelve a esa fase; si era de otra partida, los reinicios no bajan: suben', () => {
    const fases = new Fases();
    fases.anochecer();
    const noche1 = fases.instantanea();
    fases.amanecer();
    fases.restaurar(noche1);
    expect(fases.actual()).toEqual({ momento: 'noche', numero: 1, reinicios: 0 });
    fases.nuevaPartida();
    fases.restaurar(noche1);
    expect(fases.actual()).toEqual({ momento: 'noche', numero: 1, reinicios: 2 });
  });
});
