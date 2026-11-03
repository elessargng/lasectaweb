import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Arnes, Cliente } from './arnes';

/**
 * Los señalamientos por su socket (SenalamientoController → SenalamientoService →
 * Partida y Senalamientos): quién puede, lo que contesta y lo que llega a cada uno.
 */

let arnes: Arnes;
let narradora: Cliente;
let ana: Cliente;
let bea: Cliente;

const idAsiento = (i: number) => narradora.estado.plaza[i].id;
const empezar = (c: Cliente, datos: unknown) => arnes.pedir(c, 'senalamiento:empezar', datos);
const senalar = (c: Cliente, jugadorId: unknown) => arnes.pedir(c, 'senalamiento:senalar', { jugadorId });

beforeEach(async () => {
  arnes = await Arnes.crear();
  narradora = await arnes.entrar('Nora');
  ana = await arnes.entrar('Ana');
  bea = await arnes.entrar('Bea');
  await arnes.accion(narradora, 'sala:hacerseNarrador');
  await arnes.accion(ana, 'sala:sentarse', { jugadorId: idAsiento(0) });
  await arnes.accion(bea, 'sala:sentarse', { jugadorId: idAsiento(1) });
});

afterEach(async () => {
  await arnes.cerrar();
});

describe('los señalamientos', () => {
  it('solo los empieza y los quita un narrador; Lil\' Monsta, solo cuando toca', async () => {
    expect(await empezar(ana, { segundos: null })).toEqual({ ok: false, error: 'Solo un narrador puede pedir que se señale.' });
    expect(await arnes.pedir(narradora, 'senalamiento:terminar')).toEqual({ ok: false, error: 'No hay ningún señalamiento.' });
    expect(await arnes.pedir(narradora, 'senalamiento:lilmonsta')).toEqual({
      ok: false,
      error: "Lil' Monsta se empieza de noche, sin demonio en la plaza y con un esbirro de más.",
    });
    expect(narradora.estado.acciones).toContain('senalamiento:empezar');
    expect(narradora.estado.acciones).not.toContain('senalamiento:lilmonsta');
    expect(ana.estado.acciones.some((a) => a.startsWith('senalamiento:'))).toBe(false);
  });

  it('lo que no se entiende ni llega al servicio; la cuenta atrás y los asientos, el dominio', async () => {
    expect(await empezar(narradora, {})).toEqual({ ok: false, error: 'Indica cuántos segundos dura la cuenta atrás.' });
    expect(await empezar(narradora, { segundos: null, mensaje: 3 })).toEqual({ ok: false, error: 'Mensaje no válido.' });
    expect(await empezar(narradora, { segundos: null, objetivos: 'todos' })).toEqual({ ok: false, error: 'Alguno de esos asientos ya no existe.' });
    expect(await empezar(narradora, { segundos: 1.5 })).toEqual({ ok: false, error: 'Indica cuántos segundos dura la cuenta atrás.' });
    expect(await empezar(narradora, { segundos: 1 })).toEqual({ ok: false, error: 'La cuenta atrás tiene que durar entre 3 y 120 segundos.' });
    expect(await empezar(narradora, { segundos: null, senaladores: ['no-existe'] })).toEqual({
      ok: false,
      error: 'Alguno de esos asientos ya no existe.',
    });
  });

  it('señala quien le toca, a quien se puede; el narrador lo quita', async () => {
    expect(await empezar(narradora, { mensaje: '  ¿Quién   gana? ', segundos: 60, senaladores: [idAsiento(0)], objetivos: [idAsiento(1), idAsiento(2)] })).toEqual({
      ok: true,
    });
    expect(bea.estado.senalamiento).toMatchObject({ mensaje: '¿Quién gana?', senaladores: [idAsiento(0)] });
    expect(ana.estado.acciones).toContain('senalamiento:senalar');
    expect(bea.estado.acciones).not.toContain('senalamiento:senalar');
    expect(await senalar(bea, idAsiento(1))).toEqual({ ok: false, error: 'No te toca señalar.' });
    expect(await senalar(ana, idAsiento(3))).toEqual({ ok: false, error: 'Ese asiento no se puede señalar.' });
    expect(await senalar(ana, 4)).toEqual({ ok: false, error: 'Ese asiento ya no existe.' });
    expect(await senalar(ana, idAsiento(1))).toEqual({ ok: true });
    expect(bea.estado.senalamiento!.senales).toEqual({ [idAsiento(0)]: idAsiento(1) });
    expect(await senalar(ana, null)).toEqual({ ok: true });
    expect(bea.estado.senalamiento!.senales).toEqual({});

    expect(await arnes.pedir(narradora, 'senalamiento:terminar')).toEqual({ ok: true });
    expect(bea.estado.senalamiento).toBeNull();
  });
});
