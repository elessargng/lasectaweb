import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Arnes, Cliente } from './arnes';
import { guionDePrueba, personaje } from './guionDePrueba';

/**
 * La revelación del grimorio por su socket (RevelacionController → RevelacionService
 * → Partida y Revelacion): quién puede, lo que contesta y lo que llega a cada uno.
 */

let arnes: Arnes;
let narradora: Cliente;
let ana: Cliente;

const idAsiento = (i: number) => narradora.estado.plaza[i].id;
const darPersonaje = (i: number, personajeId: string) =>
  arnes.accion(narradora, 'narrador:cambiarPersonaje', { jugadorId: idAsiento(i), personajeId });
const empezar = (c: Cliente, datos: unknown) => arnes.pedir(c, 'revelacion:empezar', datos);

/** El de prueba, con la Doncel y el Matademonios (tienen causa de final). */
const conCausas = () => {
  const guion = guionDePrueba();
  return { ...guion, personajes: [...guion.personajes, personaje('slayer', 'townsfolk'), personaje('damsel', 'outsider')] };
};

beforeEach(async () => {
  arnes = await Arnes.crear({ guiones: { guionPredeterminado: async () => conCausas(), importar: async () => conCausas() } });
  narradora = await arnes.entrar('Nora');
  ana = await arnes.entrar('Ana');
  await arnes.accion(narradora, 'sala:hacerseNarrador');
  await arnes.hacer(narradora, 'preparacion:guion', { predeterminado: 'prueba' });
});

afterEach(async () => {
  await arnes.cerrar();
});

describe('la revelación del grimorio', () => {
  it('solo la empieza un narrador, una vez; las fichas, solo mientras se revela', async () => {
    expect(await empezar(ana, { ganador: 'bueno' })).toEqual({ ok: false, error: 'Solo un narrador puede revelar el grimorio.' });
    expect(await arnes.pedir(narradora, 'revelacion:terminar')).toEqual({ ok: false, error: 'No se está revelando el grimorio.' });
    expect(narradora.estado.acciones).toContain('revelacion:empezar');
    expect(narradora.estado.acciones).not.toContain('revelacion:revelarFicha');
    expect(ana.estado.acciones.some((a) => a.startsWith('revelacion:'))).toBe(false);

    expect(await empezar(narradora, { ganador: 'malvado' })).toEqual({ ok: true });
    expect(ana.estado.revelacion).toMatchObject({ ganador: 'malvado', reveladas: [], terminada: false });
    expect(await empezar(narradora, { ganador: 'bueno' })).toEqual({ ok: false, error: 'Ya se está revelando el grimorio.' });
    expect(narradora.estado.acciones).toEqual(expect.arrayContaining(['revelacion:revelarFicha', 'revelacion:terminar']));
  });

  it('lo que no se entiende ni llega al servicio', async () => {
    expect(await empezar(narradora, { ganador: 'nadie' })).toEqual({ ok: false, error: 'Bando desconocido.' });
    expect(await empezar(narradora, { ganador: 'bueno', causas: 'slayer' })).toEqual({ ok: false, error: 'Hay un personaje que no está en juego.' });
    expect(await empezar(narradora, { ganador: 'bueno', esbirros: { damsel: 3 } })).toEqual({ ok: false, error: 'Esbirros no válidos.' });
    await empezar(narradora, { ganador: 'bueno' });
    expect(await arnes.pedir(narradora, 'revelacion:revelarFicha', { jugadorId: 7 })).toEqual({ ok: false, error: 'Ese asiento ya no existe.' });
  });

  it('las causas, de personajes en juego; la de la Doncel, con el esbirro que la cazó', async () => {
    await darPersonaje(0, 'slayer');
    await darPersonaje(1, 'damsel');
    await darPersonaje(2, 'poisoner');
    expect(await empezar(narradora, { ganador: 'bueno', causas: ['mayor'] })).toEqual({ ok: false, error: 'Hay un personaje que no está en juego.' });
    expect(await empezar(narradora, { ganador: 'malvado', causas: ['damsel'], esbirros: { damsel: idAsiento(0) } })).toEqual({
      ok: false,
      error: 'Elige qué esbirro descubrió a la Doncel.',
    });
    expect(await empezar(narradora, { ganador: 'malvado', causas: ['slayer', 'damsel'], esbirros: { damsel: idAsiento(2) } })).toEqual({ ok: true });
    // Lo que ha pasado no se cuenta hasta que todo está revelado
    expect(ana.estado.revelacion!.causas).toEqual([]);
    expect(await arnes.pedir(narradora, 'revelacion:terminar')).toEqual({ ok: true });
    expect(ana.estado.revelacion).toMatchObject({ terminada: true, causas: ['slayer', 'damsel'] });
    expect(narradora.estado.acciones).not.toContain('revelacion:terminar');
  });

  it('revelar una ficha la ve todo el mundo', async () => {
    await darPersonaje(0, 'slayer');
    await empezar(narradora, { ganador: 'bueno' });
    expect(await arnes.pedir(narradora, 'revelacion:revelarFicha', { jugadorId: idAsiento(0) })).toEqual({ ok: true });
    expect(ana.estado.revelacion!.reveladas).toEqual([idAsiento(0)]);
    expect(ana.estado.plaza[0].personaje).toBe('slayer');
  });
});
