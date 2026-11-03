import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ResultadoBolsaAlAzar } from '../../src/views/dto/sala';
import { Arnes, Cliente } from './arnes';
import { conSemilla } from './guionDePrueba';

/**
 * La bolsa de la sala por su socket (BolsaController → BolsaService → Bolsa): quién
 * puede, lo que contesta y lo que llega a cada uno.
 */

let arnes: Arnes;
let narradora: Cliente;
let ana: Cliente;

beforeEach(async () => {
  arnes = await Arnes.crear({ azar: conSemilla(1) });
  narradora = await arnes.entrar('Nora');
  ana = await arnes.entrar('Ana');
  await arnes.accion(narradora, 'sala:hacerseNarrador');
});

afterEach(async () => {
  await arnes.cerrar();
});

const meter = (c: Cliente, personajeId: unknown) => arnes.pedir(c, 'bolsa:meter', { personajeId });

describe('la bolsa', () => {
  it('sin guion no se prepara, y solo la prepara un narrador', async () => {
    expect(await meter(narradora, 'chef')).toEqual({ ok: false, error: 'Antes hay que elegir un guion.' });
    await arnes.accion(narradora, 'narrador:cambiarGuion', { predeterminado: 'prueba' });
    expect(await meter(ana, 'chef')).toEqual({ ok: false, error: 'Solo un narrador puede preparar la bolsa.' });
    expect(await arnes.pedir(ana, 'bolsa:vaciar')).toEqual({ ok: false, error: 'Solo un narrador puede preparar la bolsa.' });
    expect(narradora.estado.acciones).toEqual(expect.arrayContaining(['bolsa:meter', 'bolsa:llenarAlAzar', 'bolsa:aceptarReparto']));
    expect(ana.estado.acciones.some((a) => a.startsWith('bolsa:'))).toBe(false);
  });

  it('meter, sacar, cantidad y vaciar; lo que no se entiende ni llega al servicio', async () => {
    await arnes.accion(narradora, 'narrador:cambiarGuion', { predeterminado: 'prueba' });
    expect(await meter(narradora, 'chef')).toEqual({ ok: true });
    expect(narradora.estado.bolsa).toEqual(['chef']);
    expect(ana.estado.bolsa).toEqual([]);
    expect(await arnes.pedir(narradora, 'bolsa:cantidad', { personajeId: 'chef', cantidad: 2 })).toEqual({
      ok: false,
      error: 'Solo con el Pope puede haber aldeanos o forasteros repetidos.',
    });
    expect(await meter(narradora, 42)).toEqual({ ok: false, error: 'Ese personaje no va en la bolsa.' });
    expect(await arnes.pedir(narradora, 'bolsa:cantidad', { personajeId: 'chef' })).toEqual({ ok: false, error: 'Cantidad desconocida.' });
    expect(await arnes.pedir(narradora, 'bolsa:vaciar')).toEqual({ ok: true });
    expect(narradora.estado.bolsa).toEqual([]);
  });

  it('llenar al azar: el Borracho no va y se dice qué falta', async () => {
    await arnes.accion(narradora, 'narrador:cambiarGuion', { predeterminado: 'prueba' });
    // 8 jugadores: 1 forastero, y en el guion de prueba el único es el Borracho
    await arnes.accion(narradora, 'narrador:asientos', { cambio: 'añadir' });
    const r = await arnes.pedir<ResultadoBolsaAlAzar>(narradora, 'bolsa:llenarAlAzar');
    expect(r).toMatchObject({ ok: true, fuera: [{ personaje: 'drunk', falta: 'outsider' }], escasos: [] });
    expect(narradora.estado.bolsa).toHaveLength(8);
    expect(narradora.estado.bolsa).not.toContain('drunk');
  });

  it('el reparto llega calculado al narrador; si no cuadra avisa, hasta darlo por bueno', async () => {
    await arnes.accion(narradora, 'narrador:cambiarGuion', { predeterminado: 'prueba' });
    for (const id of ['washerwoman', 'librarian', 'investigator', 'chef', 'poisoner', 'spy', 'imp']) await meter(narradora, id);
    const reparto = narradora.estado.reparto!;
    expect(reparto.cuenta).toMatchObject({ donde: 'bolsa', firma: '7:4/0/2/1', aviso: true });
    expect(reparto.cuenta.problemas).toEqual(['Esbirros: 2; deberían ser 1', 'Aldeanos: 4; deberían ser 5']);
    expect(reparto.bolsa.problemas).toEqual(reparto.cuenta.problemas);
    expect(ana.estado.reparto).toBeNull();
    expect(ana.estado.probables).toEqual([]);

    expect(await arnes.pedir(narradora, 'bolsa:aceptarReparto', { firma: '7:4/0/2/1' })).toEqual({ ok: true });
    expect(narradora.estado.reparto!.cuenta.aviso).toBe(false);
    expect(await arnes.pedir(narradora, 'bolsa:aceptarReparto', { firma: 7 })).toEqual({ ok: false, error: 'Reparto desconocido.' });
  });
});
