import { describe, expect, it } from 'vitest';
import type { PoderBolsa } from '../../src/models/partida/Bolsa';
import type { Distribucion } from '../../src/models/compartido/partida';
import { repartoPara } from '../../src/models/partida/distribucion';
import { bolsaDePrueba, conSemilla, personaje } from './guionDePrueba';

const distribucion = (jugadores: number): Distribucion => ({
  jugadores,
  jugadoresVivos: jugadores,
  viajeros: 0,
  viajerosVivos: 0,
  ...repartoPara(jugadores)!,
});

const bolsa = bolsaDePrueba();
const cuenta = (aldeanos: number, forasteros: number, esbirros: number) => ({
  townsfolk: aldeanos,
  outsider: forasteros,
  minion: esbirros,
  demon: 1,
});

describe('las reglas de la bolsa', () => {
  it('el Barón: +2 forasteros, y +1 en una partida teensy', () => {
    expect(bolsa.ajustar(distribucion(8), ['baron'])).toMatchObject({ aldeanos: 3, forasteros: 3, esbirros: 1 });
    expect(bolsa.ajustar(distribucion(6), ['baron'])).toMatchObject({ aldeanos: 2, forasteros: 2, esbirros: 1 });
    expect(bolsa.ajustar(distribucion(5), ['baron'])).toMatchObject({ aldeanos: 2, forasteros: 1 });
  });

  it('un poder nuevo solo con datos: sus forasteros posibles, sin programar nada', () => {
    const poderes: Record<string, PoderBolsa> = { inventado: { forasteros: [-3, -1, 0, 3] } };
    const conInventado = bolsaDePrueba((id) => poderes[id]);
    // 9 jugadores: 5 aldeanos y 2 forasteros; posibles: 1, 2 y 5 (−3 se queda por debajo de 0)
    expect(conInventado.problemas(cuenta(2, 5, 1), distribucion(9), ['inventado'])).toEqual([]);
    expect(conInventado.problemas(cuenta(6, 1, 1), distribucion(9), ['inventado'])).toEqual([]);
    expect(conInventado.problemas(cuenta(4, 3, 1), distribucion(9), ['inventado'])).toEqual([
      'Forasteros: 3; deberían ser 1, 2 o 5',
    ]);
    // Varias opciones: no se aplica sola
    expect(conInventado.ajustar(distribucion(9), ['inventado'])).toMatchObject({ aldeanos: 5, forasteros: 2 });
  });

  it('el Xaan: cualquier número de forasteros, con los aldeanos compensando', () => {
    expect(bolsa.problemas(cuenta(0, 7, 1), distribucion(9), ['xaan'])).toEqual([]);
    expect(bolsa.problemas(cuenta(0, 6, 1), distribucion(9), ['xaan'])).toEqual([
      'Aldeanos y forasteros: 6; deberían ser 7 entre los dos',
    ]);
  });

  it('el Kazali y el Lord of Typhon: sin esbirros en la bolsa, sus huecos para el bien', () => {
    for (const demonio of ['kazali', 'lordoftyphon']) {
      expect(bolsa.ajustar(distribucion(10), [demonio])).toMatchObject({ aldeanos: 9, forasteros: 0, esbirros: 0 });
      expect(bolsa.problemas(cuenta(5, 4, 0), distribucion(10), [demonio])).toEqual([]);
      expect(bolsa.problemas(cuenta(7, 1, 1), distribucion(10), [demonio])).toEqual([
        'Esbirros: 1; deberían ser 0',
        'Aldeanos y forasteros: 8; deberían ser 9 entre los dos',
      ]);
      expect(bolsa.descuadres(cuenta(5, 4, 0), distribucion(10), [demonio])).toEqual({ forasteros: false, esbirros: false });
    }
  });

  it('llenar al azar con el Kazali: ningún esbirro, y los huecos van a aldeanos', () => {
    const guion = [
      personaje('kazali', 'demon'),
      ...['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10'].map((id) => personaje(id, 'townsfolk')),
      personaje('f1', 'outsider'),
      personaje('e1', 'minion'),
      personaje('e2', 'minion'),
    ];
    const sorteo = bolsa.sortear(guion, distribucion(10), [], conSemilla(1))!;
    expect(sorteo.personajes).toHaveLength(10);
    expect(sorteo.personajes).toContain('kazali');
    expect(sorteo.personajes.filter((id) => id.startsWith('e'))).toEqual([]);
    expect(sorteo.personajes.filter((id) => id.startsWith('a'))).toHaveLength(9);
  });

  it('el Borracho y la Marioneta no van: en su lugar, un aldeano, y falta uno de su tipo', () => {
    const guion = [
      personaje('imp', 'demon'),
      personaje('marionette', 'minion'),
      personaje('drunk', 'outsider'),
      personaje('saint', 'outsider'),
      ...['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'].map((id) => personaje(id, 'townsfolk')),
    ];
    // 9 jugadores: 5 aldeanos, 2 forasteros, 1 esbirro (la Marioneta) y el demonio
    const sorteo = bolsa.sortear(guion, distribucion(9), [], conSemilla(3))!;
    expect(sorteo.fuera.map(({ personaje: p, falta }) => [p.id, falta]).sort()).toEqual([
      ['drunk', 'outsider'],
      ['marionette', 'minion'],
    ]);
    expect(sorteo.personajes).toHaveLength(9);
    expect(sorteo.personajes).not.toContain('drunk');
    expect(sorteo.personajes).not.toContain('marionette');
    expect(sorteo.personajes.filter((id) => id.startsWith('a'))).toHaveLength(7);
  });
});
