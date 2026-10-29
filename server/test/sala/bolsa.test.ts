import { describe, expect, it } from 'vitest';
import type { SalaDistribucion } from '../../src/contrato/sala';
import { repartoPara } from '../../src/services/partida/distribucion';
import {
  CATEGORIAS_ALDEANOS,
  CATEGORIAS_INFORMACION,
  categoriaDe,
  categoriasDeHuecos,
  CONCEPTOS_BIEN,
  CONCEPTOS_MAL,
  MAX_OPCIONES,
  sortearConceptos,
  type CategoriaAldeano,
} from '../../src/services/narradorVirtual/bolsa/conceptos';
import type { Decision } from '../../src/services/narradorVirtual/estrategias/EstrategiaNarrador';
import { TontoYTu } from '../../src/services/narradorVirtual/estrategias/TontoYTu';
import { elegirBolsa } from '../../src/services/narradorVirtual/preparacion';
import { guionTroubleBrewing, personaje } from './guionDePrueba';

/** Un azar con semilla (mulberry32): las mismas elecciones cada vez. */
function conSemilla(semilla: number): () => number {
  let s = semilla;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Trouble Brewing entero (el de prueba no trae al Barón). */
const PERSONAJES = [...guionTroubleBrewing().personajes, personaje('baron', 'minion')];
const tipo = (id: string) => PERSONAJES.find((p) => p.id === id)!.tipo;

const distribucion = (jugadores: number): SalaDistribucion => ({
  jugadores,
  jugadoresVivos: jugadores,
  viajeros: 0,
  viajerosVivos: 0,
  ...repartoPara(jugadores)!,
});

/** El modelo simulado: «Tonto y tú» con su propia semilla; apunta lo que le preguntan. */
const modelo = (semilla: number) => {
  const tonto = new TontoYTu(conSemilla(semilla + 1000));
  const preguntas: Decision<unknown>[] = [];
  const decidir = <T,>(d: Decision<T>): Promise<T> => {
    preguntas.push(d as Decision<unknown>);
    return tonto.elegir(d);
  };
  return { decidir, preguntas };
};

const bolsa = async (jugadores: number, semilla: number) => {
  const { decidir, preguntas } = modelo(semilla);
  const b = (await elegirBolsa(PERSONAJES, distribucion(jugadores), decidir, { azar: conSemilla(semilla) }))!;
  return { ...b, preguntas };
};

describe('la bolsa del narrador virtual, con conceptos', () => {
  it('el reparto de 5 a 15 jugadores es el de la tabla', () => {
    const tabla: Record<number, [number, number, number]> = {
      5: [3, 0, 1], 6: [3, 1, 1], 7: [5, 0, 1], 8: [5, 1, 1], 9: [5, 2, 1], 10: [7, 0, 2],
      11: [7, 1, 2], 12: [7, 2, 2], 13: [9, 0, 3], 14: [9, 1, 3], 15: [9, 2, 3],
    };
    for (const [n, [aldeanos, forasteros, esbirros]] of Object.entries(tabla)) {
      expect(repartoPara(Number(n))).toEqual({ aldeanos, forasteros, esbirros, demonios: 1 });
    }
  });

  it('los recuentos cuadran de 5 a 15 jugadores, con y sin Barón, y sin repetir a nadie', async () => {
    for (let jugadores = 5; jugadores <= 15; jugadores++) {
      const vistos = { conBaron: false, sinBaron: false };
      for (let semilla = 1; semilla <= 40; semilla++) {
        const b = await bolsa(jugadores, semilla);
        const reparto = repartoPara(jugadores)!;
        // El Borracho cuenta como forastero (su ficha de aldeano va en la bolsa)
        const todos = [...b.personajes, ...b.fuera.map((f) => f.personaje)];
        const cuantos = (t: string) => todos.filter((p) => tipo(p) === t).length;
        const conBaron = b.personajes.includes('baron');
        vistos[conBaron ? 'conBaron' : 'sinBaron'] = true;
        const delBaron = conBaron ? (jugadores >= 7 ? 2 : 1) : 0;
        expect(b.personajes).toHaveLength(jugadores);
        expect(new Set(b.personajes).size).toBe(jugadores);
        expect(cuantos('demon')).toBe(1);
        expect(b.personajes).toContain('imp');
        expect(cuantos('minion')).toBe(reparto.esbirros);
        expect(cuantos('outsider')).toBe(reparto.forasteros + delBaron);
        expect(cuantos('townsfolk')).toBe(reparto.aldeanos - delBaron + b.fuera.length);
      }
      expect(vistos).toEqual({ conBaron: true, sinBaron: true });
    }
  });

  it('el primer esbirro es el del concepto del mal', async () => {
    for (let semilla = 1; semilla <= 30; semilla++) {
      const b = await bolsa(12, semilla);
      const esbirros = b.preguntas.filter((p) => (p.sinGrimorio!.hueco as { tipo: string }).tipo === 'minion');
      expect(esbirros[0].opciones.map((o) => o.clave)).toEqual([CONCEPTOS_MAL[b.conceptos.mal].esbirro]);
      expect(esbirros[1].opciones.length).toBeGreaterThan(1);
    }
  });

  it('el Borracho cree ser un aldeano que no está en juego, mejor de información', async () => {
    let conBorracho = 0;
    for (let semilla = 1; semilla <= 80; semilla++) {
      const b = await bolsa(9, semilla);
      const drunk = b.fuera.find((f) => f.personaje === 'drunk');
      if (!drunk) continue;
      conBorracho++;
      expect(b.personajes).not.toContain('drunk');
      expect(tipo(drunk.creeSer!)).toBe('townsfolk');
      // Su ficha va en la bolsa una vez, y es el aldeano de más
      expect(b.personajes.filter((p) => p === drunk.creeSer)).toHaveLength(1);
      const aldeanos = b.personajes.filter((p) => tipo(p) === 'townsfolk');
      expect(aldeanos).toHaveLength(b.categorias.length + 1);
      expect(CATEGORIAS_INFORMACION).toContain(categoriaDe(drunk.creeSer!));
    }
    expect(conBorracho).toBeGreaterThan(0);
  });

  it('cada hueco de aldeano, de su categoría, con pocas opciones barajadas', async () => {
    for (let semilla = 1; semilla <= 30; semilla++) {
      const b = await bolsa(15, semilla);
      expect(b.categorias[0]).toBe(CONCEPTOS_BIEN[b.conceptos.bien].categoria);
      for (const p of b.preguntas) expect(p.opciones.length).toBeLessThanOrEqual(MAX_OPCIONES);
      // Cada aldeano elegido es de la categoría de su hueco
      const elegidos = b.personajes.filter((p) => tipo(p) === 'townsfolk' && !b.fuera.some((f) => f.creeSer === p));
      expect(elegidos.map(categoriaDe).sort()).toEqual([...b.categorias].sort());
    }
  });

  it('las categorías: la favorecida primero, luego las que faltan; con pocos huecos se quedan fuera otras', () => {
    const azar = conSemilla(3);
    expect(categoriasDeHuecos(3, 'accion', azar)[0]).toBe('accion');
    expect(new Set(categoriasDeHuecos(3, 'accion', azar)).size).toBe(3);
    const muchos = categoriasDeHuecos(9, 'infoRecurrente', azar);
    expect(new Set(muchos.slice(0, 4)).size).toBe(4);
    expect(muchos).toHaveLength(9);
  });

  it('con la misma semilla, la misma bolsa; con otras, varían los conceptos y las categorías', async () => {
    const a = await bolsa(10, 7);
    const b = await bolsa(10, 7);
    expect(b.personajes).toEqual(a.personajes);
    expect(b.conceptos).toEqual(a.conceptos);
    const otras = await Promise.all([1, 2, 3, 4, 5, 6, 8, 9].map((s) => bolsa(10, s)));
    expect(new Set(otras.map((o) => `${o.conceptos.bien}/${o.conceptos.mal}`)).size).toBeGreaterThan(1);
    expect(new Set(otras.map((o) => o.categorias.join())).size).toBeGreaterThan(1);
    expect(new Set(otras.map((o) => [...o.personajes].sort().join())).size).toBeGreaterThan(1);
  });

  it('en 100 bolsas salen todos los conceptos y todas las categorías', async () => {
    const bien = new Set<string>();
    const mal = new Set<string>();
    const categorias = new Set<CategoriaAldeano>();
    for (let semilla = 1; semilla <= 100; semilla++) {
      const b = await bolsa(7 + (semilla % 9), semilla);
      bien.add(b.conceptos.bien);
      mal.add(b.conceptos.mal);
      b.categorias.forEach((c) => categorias.add(c));
    }
    expect([...bien].sort()).toEqual(Object.keys(CONCEPTOS_BIEN).sort());
    expect([...mal].sort()).toEqual(Object.keys(CONCEPTOS_MAL).sort());
    expect([...categorias].sort()).toEqual(Object.keys(CATEGORIAS_ALDEANOS).sort());
  });

  it('resistir frente a la infiltración sale menos que las demás combinaciones', () => {
    const azar = conSemilla(11);
    const veces = new Map<string, number>();
    for (let i = 0; i < 16_000; i++) {
      const { bien, mal } = sortearConceptos(azar);
      veces.set(`${bien}/${mal}`, (veces.get(`${bien}/${mal}`) ?? 0) + 1);
    }
    // 16 combinaciones: unas 1 000 cada una con peso 1, unas 300 la de 0,3
    expect(veces.get('resistir/infiltracion')).toBeLessThan(500);
    expect(veces.get('resistir/caos')).toBeGreaterThan(800);
  });

  it('al modelo: los conceptos, el hueco, lo ya elegido y lo usado en las partidas recientes', async () => {
    const { decidir, preguntas } = modelo(1);
    await elegirBolsa(PERSONAJES, distribucion(8), decidir, { azar: conSemilla(1), recientes: [['imp', 'chef', 'empath'], ['imp', 'chef']] });
    const [primera] = preguntas;
    expect(primera.instrucciones).toMatch(/Concepto del bien: .+\. Concepto del mal: .+\./);
    expect(primera.instrucciones).toContain('Personajes usados en partidas recientes: chef (2 veces), empath;');
    expect(primera.instrucciones).not.toMatch(/imp/);
    const aldeano = preguntas.find((p) => (p.sinGrimorio!.hueco as { tipo: string }).tipo === 'townsfolk')!;
    expect(aldeano.pregunta).toMatch(/un aldeano de .+ \(1 de \d\)\. Ya en la bolsa: imp, /);
    // Sin recientes, no se habla de ellas
    const sin = modelo(1);
    await elegirBolsa(PERSONAJES, distribucion(8), sin.decidir, { azar: conSemilla(1) });
    expect(sin.preguntas[0].instrucciones).not.toContain('recientes');
  });
});
