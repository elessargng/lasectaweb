import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Arnes, Cliente } from './arnes';

/**
 * El gong y el reloj de la sala por su socket (RelojController → RelojService →
 * RelojSala): quién puede, lo que contesta y lo que llega a cada uno.
 */

let arnes: Arnes;
let narradora: Cliente;
let ana: Cliente;

beforeEach(async () => {
  arnes = await Arnes.crear();
  narradora = await arnes.entrar('Nora');
  ana = await arnes.entrar('Ana');
  await arnes.accion(narradora, 'sala:hacerseNarrador');
});

afterEach(async () => {
  await arnes.cerrar();
});

const poner = (c: Cliente, datos: unknown) => arnes.pedir(c, 'reloj:poner', datos);

describe('el gong y el reloj', () => {
  it('solo un narrador; terminar y quitar, solo con un reloj puesto', async () => {
    expect(await arnes.pedir(ana, 'reloj:sonarGong')).toEqual({ ok: false, error: 'Solo un narrador puede sonar el gong.' });
    expect(await poner(ana, { segundos: 60 })).toEqual({ ok: false, error: 'Solo un narrador puede poner el reloj.' });
    expect(await arnes.pedir(narradora, 'reloj:terminar')).toEqual({ ok: false, error: 'No hay ningún reloj en marcha.' });
    expect(await arnes.pedir(narradora, 'reloj:quitar')).toEqual({ ok: false, error: 'No hay ningún reloj en marcha.' });
    expect(narradora.estado.acciones).toEqual(expect.arrayContaining(['reloj:sonarGong', 'reloj:poner']));
    expect(narradora.estado.acciones).not.toContain('reloj:terminar');
    expect(ana.estado.acciones.some((a) => a.startsWith('reloj:'))).toBe(false);
  });

  it('el gong suena para todos, y no otra vez mientras aún suena', async () => {
    expect(await arnes.pedir(narradora, 'reloj:sonarGong')).toEqual({ ok: true });
    expect(ana.estado.gong).toEqual(expect.any(Number));
    expect(await arnes.pedir(narradora, 'reloj:sonarGong')).toEqual({ ok: false, error: 'El gong aún está sonando.' });
  });

  it('poner el reloj: lo ven todos, con su mensaje; lo que no se entiende ni llega al servicio', async () => {
    expect(await poner(narradora, { segundos: '60' })).toEqual({ ok: false, error: 'Indica cuánto dura el reloj.' });
    expect(await poner(narradora, { segundos: 60, mensaje: 7 })).toEqual({ ok: false, error: 'Mensaje no válido.' });
    expect(await poner(narradora, { segundos: 2 })).toEqual({ ok: false, error: 'El reloj tiene que durar al menos 5 segundos.' });
    expect(await poner(narradora, { segundos: 61 * 60 })).toEqual({ ok: false, error: 'El reloj puede durar como mucho 60 minutos.' });
    expect(await poner(narradora, { segundos: 60, mensaje: '  Privados  ' })).toEqual({ ok: true });
    expect(ana.estado.reloj).toMatchObject({ mensaje: 'Privados' });
    expect(narradora.estado.acciones).toEqual(expect.arrayContaining(['reloj:terminar', 'reloj:quitar']));
  });

  it('terminarlo lo deja en «¡Tiempo!»; quitarlo, sin reloj', async () => {
    await poner(narradora, { segundos: 60 });
    expect(await arnes.pedir(narradora, 'reloj:terminar')).toEqual({ ok: true });
    expect(narradora.estado.reloj!.fin).toBeLessThanOrEqual(Date.now());
    expect(narradora.estado.acciones).not.toContain('reloj:terminar');
    expect(await arnes.pedir(narradora, 'reloj:quitar')).toEqual({ ok: true });
    expect(ana.estado.reloj).toBeNull();
  });
});
