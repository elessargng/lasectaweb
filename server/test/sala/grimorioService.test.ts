import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Arnes, Cliente } from './arnes';

/**
 * El grimorio del narrador por su socket (GrimorioController → GrimorioService →
 * Grimorio y Partida): quién puede, lo que contesta y lo que llega a cada uno.
 */

let arnes: Arnes;
let narradora: Cliente;
let ana: Cliente;

const idAsiento = (i: number) => narradora.estado.plaza[i].id;
const pedir = (c: Cliente, evento: string, datos?: unknown) => arnes.pedir(c, `grimorio:${evento}`, datos);

beforeEach(async () => {
  arnes = await Arnes.crear();
  narradora = await arnes.entrar('Nora');
  ana = await arnes.entrar('Ana');
  await arnes.accion(narradora, 'sala:hacerseNarrador');
  await arnes.hacer(narradora, 'preparacion:guion', { predeterminado: 'prueba' });
  await arnes.accion(ana, 'sala:sentarse', { jugadorId: idAsiento(0) });
});

afterEach(async () => {
  await arnes.cerrar();
});

describe('el grimorio', () => {
  it('solo un narrador; anunciar muertes, votos y el Barquero, solo cuando toca', async () => {
    expect(await pedir(ana, 'personaje', { jugadorId: idAsiento(0), personajeId: 'chef' })).toEqual({
      ok: false,
      error: 'Solo un narrador puede cambiar las fichas.',
    });
    expect(await pedir(narradora, 'voto', { jugadorId: idAsiento(0), gastado: true })).toEqual({ ok: false, error: 'No hay ningún muerto.' });
    expect(await pedir(narradora, 'intercambiar', { desde: idAsiento(0), hasta: idAsiento(1) })).toEqual({
      ok: false,
      error: 'Las fichas solo se intercambian con el Gardener en juego.',
    });
    expect(narradora.estado.acciones).toEqual(expect.arrayContaining(['grimorio:personaje', 'grimorio:vida', 'grimorio:nota', 'grimorio:enviar']));
    expect(narradora.estado.acciones).not.toContain('grimorio:barquero');
    expect(ana.estado.acciones.some((a) => a.startsWith('grimorio:'))).toBe(false);
  });

  it('las fichas: personaje, alineamiento, vida y voto', async () => {
    expect(await pedir(narradora, 'alineamiento', { jugadorId: idAsiento(0), alineamiento: 'malvado' })).toEqual({
      ok: false,
      error: 'Esa ficha no tiene personaje.',
    });
    expect(await pedir(narradora, 'personaje', { jugadorId: idAsiento(0), personajeId: 'chef' })).toEqual({ ok: true });
    expect(await pedir(narradora, 'alineamiento', { jugadorId: idAsiento(0), alineamiento: 'gris' })).toEqual({
      ok: false,
      error: 'Alineamiento desconocido.',
    });
    expect(await pedir(narradora, 'alineamiento', { jugadorId: idAsiento(0), alineamiento: 'malvado' })).toEqual({ ok: true });
    expect(narradora.estado.plaza[0]).toMatchObject({ personaje: 'chef', alineamiento: 'malvado' });

    expect(await pedir(narradora, 'vida', { jugadorId: idAsiento(1), muerto: 'sí' })).toEqual({ ok: false, error: 'Estado desconocido.' });
    expect(await pedir(narradora, 'vida', { jugadorId: 'no-existe', muerto: true })).toEqual({ ok: false, error: 'Ese asiento ya no existe.' });
    expect(await pedir(narradora, 'vida', { jugadorId: idAsiento(1), muerto: true })).toEqual({ ok: true });
    expect(ana.estado.plaza[1].muerto).toBe(true);
    expect(await pedir(narradora, 'voto', { jugadorId: idAsiento(2), gastado: true })).toEqual({
      ok: false,
      error: 'Solo los muertos tienen un voto que quitar o devolver.',
    });
    expect(await pedir(narradora, 'voto', { jugadorId: idAsiento(1), gastado: true })).toEqual({ ok: true });
  });

  it('las notas, limpias y no muy largas', async () => {
    expect(await pedir(narradora, 'nota', { jugadorId: idAsiento(0), texto: '   ' })).toEqual({ ok: false, error: 'La nota está vacía.' });
    expect(await pedir(narradora, 'nota', { jugadorId: idAsiento(0), texto: 'x'.repeat(5000) })).toMatchObject({ ok: false });
    expect(await pedir(narradora, 'nota', { jugadorId: idAsiento(0), texto: '  Sospechosa\r\nde todo  ' })).toEqual({ ok: true });
    expect(narradora.estado.notas).toEqual({ [idAsiento(0)]: 'Sospechosa\nde todo' });
    expect(await pedir(narradora, 'borrarNota', { jugadorId: idAsiento(0) })).toEqual({ ok: true });
    expect(narradora.estado.notas).toEqual({});
  });

  it('enviar el grimorio: a alguien sentado, con fichas de la plaza y personajes del guion', async () => {
    const ficha = { jugadorId: idAsiento(0), personaje: 'chef', alineamiento: 'bueno', muerto: false, recordatorios: [] };
    expect(await pedir(narradora, 'enviar', { jugadorId: idAsiento(1), fichas: [ficha] })).toEqual({
      ok: false,
      error: 'En ese asiento no hay nadie a quien enviárselo.',
    });
    expect(await pedir(narradora, 'enviar', { jugadorId: idAsiento(0), fichas: 'todas' })).toEqual({ ok: false, error: 'El grimorio no es válido.' });
    expect(await pedir(narradora, 'enviar', { jugadorId: idAsiento(0), fichas: [{ ...ficha, personaje: 'nadie' }] })).toEqual({
      ok: false,
      error: 'Hay un personaje que no está en el guion.',
    });
    expect(await pedir(narradora, 'enviar', { jugadorId: idAsiento(0), fichas: [ficha], faroles: ['nadie'] })).toEqual({
      ok: false,
      error: 'Hay un farol que no está en el guion.',
    });
    expect(await pedir(narradora, 'enviar', { jugadorId: idAsiento(0), fichas: [ficha], faroles: ['empath'] })).toEqual({ ok: true });
    expect(ana.estado.grimorioRecibido).toMatchObject({ fichas: [{ jugadorId: idAsiento(0), personaje: 'chef' }], faroles: ['empath'] });
  });
});
