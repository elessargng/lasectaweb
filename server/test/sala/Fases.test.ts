import { describe, expect, it } from 'vitest';
import { Fases } from '../../src/services/partida/Fases';
import { PASOS_DE_FASE_MAX } from '../../src/services/partida/eventos';

describe('Fases', () => {
  it('empieza en la preparación y va noche 1, día 1, noche 2', () => {
    const fases = new Fases();
    expect(fases.actual()).toEqual({ momento: 'preparacion', numero: 0, reinicios: 0 });
    fases.anochecer({});
    expect(fases.actual()).toEqual({ momento: 'noche', numero: 1, reinicios: 0 });
    fases.amanecer({});
    expect(fases.actual()).toEqual({ momento: 'dia', numero: 1, reinicios: 0 });
    fases.anochecer({});
    expect(fases.actual()).toEqual({ momento: 'noche', numero: 2, reinicios: 0 });
  });

  it('la anterior: del día N, la noche N; de la noche N, el día N-1; de la noche 1, la preparación', () => {
    const fases = new Fases();
    expect(fases.anterior()).toBeNull();
    fases.anochecer({});
    expect(fases.anterior()).toEqual({ momento: 'preparacion', numero: 0, reinicios: 0 });
    fases.amanecer({});
    expect(fases.anterior()).toEqual({ momento: 'noche', numero: 1, reinicios: 0 });
    fases.anochecer({});
    expect(fases.anterior()).toEqual({ momento: 'dia', numero: 1, reinicios: 0 });
  });

  it('al volver devuelve lo que se recordó en ese mismo cambio, y nada si no fue el último', () => {
    const fases = new Fases();
    fases.anochecer({});
    fases.amanecer({ senalamiento: null });
    fases.anochecer({ marcas: [{ asiento: 'a', votos: 3 }], maximoDelDia: 3 });
    expect(fases.volver()).toEqual({
      fase: { momento: 'dia', numero: 1, reinicios: 0 },
      recuerdo: { marcas: [{ asiento: 'a', votos: 3 }], maximoDelDia: 3 },
    });
    expect(fases.volver()?.recuerdo).toEqual({ senalamiento: null });
    expect(fases.volver()?.fase).toEqual({ momento: 'preparacion', numero: 0, reinicios: 0 });
    expect(fases.volver()).toBeNull();
  });

  it('olvida los cambios más antiguos: al volver hasta ellos, sin recuerdo', () => {
    const fases = new Fases();
    fases.anochecer({ maximoDelDia: 1 });
    for (let i = 0; i < PASOS_DE_FASE_MAX; i++) {
      fases.amanecer({});
      fases.anochecer({});
    }
    let ultima;
    while (fases.anterior()) ultima = fases.volver();
    expect(ultima).toEqual({ fase: { momento: 'preparacion', numero: 0, reinicios: 0 }, recuerdo: null });
  });

  it('otra partida: a la preparación, con un reinicio más y sin historial', () => {
    const fases = new Fases();
    fases.anochecer({});
    fases.nuevaPartida();
    expect(fases.actual()).toEqual({ momento: 'preparacion', numero: 0, reinicios: 1 });
    expect(fases.volver()).toBeNull();
  });
});
