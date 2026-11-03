import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Arnes, Cliente } from './arnes';

/**
 * Los faroles por su socket (FarolController → FarolService → Faroles y Partida):
 * quién puede, lo que contesta y lo que llega a cada uno.
 */

let arnes: Arnes;
let narradora: Cliente;
let ana: Cliente;
let bea: Cliente;

const idAsiento = (i: number) => narradora.estado.plaza[i].id;

beforeEach(async () => {
  arnes = await Arnes.crear();
  narradora = await arnes.entrar('Nora');
  ana = await arnes.entrar('Ana');
  bea = await arnes.entrar('Bea');
  await arnes.accion(narradora, 'sala:hacerseNarrador');
  await arnes.accion(ana, 'sala:sentarse', { jugadorId: idAsiento(0) });
});

afterEach(async () => {
  await arnes.cerrar();
});

describe('los faroles', () => {
  it('sin guion, nadie; el narrador prepara los del demonio y el jugador sentado, los suyos', async () => {
    expect(await arnes.pedir(narradora, 'faroles:preparar', { posicion: 0, personajeId: 'chef' })).toEqual({
      ok: false,
      error: 'Antes hay que elegir un guion.',
    });
    await arnes.accion(narradora, 'narrador:cambiarGuion', { predeterminado: 'prueba' });
    expect(await arnes.pedir(ana, 'faroles:preparar', { posicion: 0, personajeId: 'chef' })).toEqual({
      ok: false,
      error: 'Solo un narrador prepara los faroles.',
    });
    expect(await arnes.pedir(bea, 'faroles:poner', { posicion: 0, personajeId: 'chef' })).toEqual({
      ok: false,
      error: 'Solo un jugador sentado se pone faroles.',
    });
    expect(narradora.estado.acciones).toContain('faroles:preparar');
    expect(ana.estado.acciones).toEqual(expect.arrayContaining(['faroles:poner', 'faroles:usar']));
    expect(ana.estado.acciones).not.toContain('faroles:copiar');
    expect(bea.estado.acciones.some((a) => a.startsWith('faroles:'))).toBe(false);
  });

  it('la casilla y el personaje, del guion; lo que no se entiende ni llega al servicio', async () => {
    await arnes.accion(narradora, 'narrador:cambiarGuion', { predeterminado: 'prueba' });
    expect(await arnes.pedir(narradora, 'faroles:preparar', { posicion: '0', personajeId: 'chef' })).toEqual({
      ok: false,
      error: 'Esa casilla de farol no existe.',
    });
    expect(await arnes.pedir(narradora, 'faroles:preparar', { posicion: 3, personajeId: 'chef' })).toEqual({
      ok: false,
      error: 'Esa casilla de farol no existe.',
    });
    expect(await arnes.pedir(narradora, 'faroles:preparar', { posicion: 0, personajeId: 'nadie' })).toEqual({
      ok: false,
      error: 'Ese personaje no está en el guion.',
    });
    expect(await arnes.pedir(ana, 'faroles:usar', { personajeId: 4 })).toEqual({ ok: false, error: 'Personaje desconocido.' });
    expect(await arnes.pedir(ana, 'faroles:copiar', { personajes: 'chef' })).toEqual({ ok: false, error: 'No hay faroles que copiar.' });

    expect(await arnes.pedir(narradora, 'faroles:preparar', { posicion: 1, personajeId: 'chef' })).toEqual({ ok: true });
    expect(narradora.estado.faroles).toEqual([null, 'chef', null]);
  });

  it('copiar los que ha enseñado el narrador, y solo esos', async () => {
    await arnes.accion(narradora, 'narrador:cambiarGuion', { predeterminado: 'prueba' });
    await arnes.accion(narradora, 'narrador:irANoche');
    expect(await arnes.pedir(ana, 'faroles:copiar', { personajes: ['chef'] })).toEqual({ ok: false, error: 'No tienes ningún despertar abierto.' });
    await arnes.accion(narradora, 'narrador:despertar', { jugadorId: idAsiento(0) });
    await arnes.accion(narradora, 'despertar:enviar', { jugadorId: idAsiento(0), tarjeta: 'noEnJuego', personajes: ['chef', 'empath', 'librarian'] });
    expect(ana.estado.acciones).toContain('faroles:copiar');
    expect(await arnes.pedir(ana, 'faroles:copiar', { personajes: ['chef', 'empath'] })).toEqual({
      ok: false,
      error: 'El narrador no te ha enseñado esos personajes.',
    });
    expect(await arnes.pedir(ana, 'faroles:copiar', { personajes: ['chef', 'empath', 'librarian'] })).toEqual({ ok: true });
    expect(ana.miAsiento?.faroles).toEqual(['chef', 'empath', 'librarian']);
  });
});
