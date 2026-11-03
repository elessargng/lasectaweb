import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Arnes, Cliente } from './arnes';

/**
 * La noche por su socket (NocheController → NocheService → Partida): quién puede, lo
 * que contesta y lo que llega a cada uno.
 */

let arnes: Arnes;
let narradora: Cliente;
let ana: Cliente;

const idAsiento = (i: number) => narradora.estado.plaza[i].id;
const enviar = (c: Cliente, datos: unknown) => arnes.pedir(c, 'noche:enviar', datos);
const mensajes = (c: Cliente) => c.estado.despertares.flatMap((d) => d.mensajes);

beforeEach(async () => {
  arnes = await Arnes.crear();
  narradora = await arnes.entrar('Nora');
  ana = await arnes.entrar('Ana');
  await arnes.accion(narradora, 'sala:hacerseNarrador');
  await arnes.accion(narradora, 'narrador:cambiarGuion', { predeterminado: 'prueba' });
  await arnes.accion(ana, 'sala:sentarse', { jugadorId: idAsiento(0) });
});

afterEach(async () => {
  await arnes.cerrar();
});

describe('la noche', () => {
  it('solo de noche y solo un narrador despierta; el jugador, solo en su despertar', async () => {
    expect(await arnes.pedir(narradora, 'noche:despertar', { jugadorId: idAsiento(0) })).toEqual({
      ok: false,
      error: 'Solo se despierta a alguien de noche.',
    });
    await arnes.hacer(narradora, 'fase:noche');
    expect(await arnes.pedir(ana, 'noche:despertar', { jugadorId: idAsiento(0) })).toEqual({
      ok: false,
      error: 'Solo un narrador puede despertar a alguien.',
    });
    expect(await enviar(ana, { ficha: 'si' })).toEqual({ ok: false, error: 'No tienes ningún despertar abierto.' });
    expect(narradora.estado.acciones).toEqual(expect.arrayContaining(['noche:despertar', 'noche:despertarHabilidad', 'noche:recordatorio']));
    expect(narradora.estado.acciones).not.toContain('noche:enviar');
    expect(ana.estado.acciones.some((a) => a.startsWith('noche:'))).toBe(false);
  });

  it('el mensaje, con lo que lleva; lo que no se entiende ni llega al servicio', async () => {
    await arnes.hacer(narradora, 'fase:noche');
    await arnes.hacer(narradora, 'noche:despertar', { jugadorId: idAsiento(0) });
    expect(await enviar(narradora, { jugadorId: idAsiento(0), ficha: 'nada' })).toEqual({ ok: false, error: 'Mensaje desconocido.' });
    expect(await enviar(narradora, { jugadorId: idAsiento(0), ficha: 'jugador', jugadores: 'todos' })).toEqual({
      ok: false,
      error: 'Elige al menos un jugador.',
    });
    expect(await enviar(narradora, { jugadorId: idAsiento(0), tarjeta: 'noEnJuego', personajes: ['nadie'] })).toEqual({
      ok: false,
      error: 'Elige al menos un personaje del guion.',
    });
    expect(await enviar(narradora, { jugadorId: idAsiento(0), ficha: 'personalizado', texto: '   ' })).toEqual({ ok: false, error: 'Escribe el mensaje.' });
    expect(await enviar(narradora, { jugadorId: idAsiento(1), ficha: 'si' })).toEqual({ ok: false, error: 'Ese despertar ya no está abierto.' });

    expect(await enviar(narradora, { jugadorId: idAsiento(0), ficha: 'personalizado', texto: '  ¿Me   oyes? ' })).toEqual({ ok: true });
    expect(mensajes(ana).map((m) => m.texto)).toEqual(['¿Me oyes?']);
    expect(ana.estado.acciones).toContain('noche:enviar');
    // El jugador no manda tarjetas: solo fichas
    expect(await enviar(ana, { tarjeta: 'habilidad' })).toEqual({ ok: false, error: 'Mensaje desconocido.' });
    expect(await enviar(ana, { ficha: 'si' })).toEqual({ ok: true });
    expect(mensajes(narradora).map((m) => m.texto ?? m.ficha)).toEqual(['¿Me oyes?', 'si']);
  });

  it('a varios a la vez, de noche, despertando a los que aún no lo estaban', async () => {
    await arnes.hacer(narradora, 'fase:noche');
    await arnes.hacer(narradora, 'noche:despertar', { jugadorId: idAsiento(0) });
    expect(await enviar(narradora, { jugadorIds: [idAsiento(0), idAsiento(1), idAsiento(0)], tarjeta: 'habilidad' })).toEqual({ ok: true });
    expect(narradora.estado.despertares.map((d) => d.jugador).sort()).toEqual([idAsiento(0), idAsiento(1)].sort());
  });

  it('la estrella del orden de noche: un personaje del guion, los esbirros o los demonios', async () => {
    expect(await arnes.pedir(narradora, 'noche:recordatorio', { id: 'nadie', activo: false })).toEqual({
      ok: false,
      error: 'Ese personaje no está en el guion.',
    });
    expect(await arnes.pedir(narradora, 'noche:recordatorio', { id: 'imp', activo: 'no' })).toEqual({ ok: false, error: 'Estado desconocido.' });
    expect(await arnes.pedir(narradora, 'noche:recordatorio', { id: 'esbirros', activo: false })).toEqual({ ok: true });
    expect(await arnes.pedir(narradora, 'noche:nuevoImp', { jugadorId: idAsiento(0) })).toEqual({ ok: false, error: 'No hay que elegir un nuevo Imp.' });
  });
});
