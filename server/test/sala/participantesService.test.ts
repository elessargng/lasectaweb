import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Arnes, Cliente } from './arnes';

/**
 * Quién está en la sala y dónde, por su socket (ParticipantesController →
 * ParticipantesService → Participantes, Sala y Partida): quién puede, lo que contesta
 * y lo que llega a cada uno.
 */

let arnes: Arnes;
let narradora: Cliente;
let ana: Cliente;
let bea: Cliente;

const idAsiento = (i: number) => narradora.estado.plaza[i].id;
const participante = (c: Cliente, de: Cliente) => c.estado.participantes.find((p) => p.id === de.id);

beforeEach(async () => {
  arnes = await Arnes.crear();
  narradora = await arnes.entrar('Nora');
  ana = await arnes.entrar('Ana');
  bea = await arnes.entrar('Bea');
  await arnes.accion(narradora, 'sala:hacerseNarrador');
});

afterEach(async () => {
  await arnes.cerrar();
});

describe('participantes', () => {
  it('el nombre: limpio, y que no lo lleve otro', async () => {
    expect(await arnes.pedir(ana, 'sala:cambiarNombre', { nombre: '  ' })).toEqual({ ok: false, error: 'Escribe un nombre.' });
    expect(await arnes.pedir(ana, 'sala:cambiarNombre', { nombre: 'bea' })).toEqual({ ok: false, error: 'Ya hay alguien llamado bea en la sala.' });
    expect(await arnes.pedir(ana, 'sala:cambiarNombre', { nombre: '  Ana   la  Lista ' })).toEqual({ ok: true });
    expect(participante(bea, ana)?.nombre).toBe('Ana la Lista');
  });

  it('la mano: el estilo y la forma, que existan; levantarla, solo jugadores y narradores', async () => {
    expect(await arnes.pedir(ana, 'sala:estiloMano', { estilo: 'nada' })).toEqual({ ok: false, error: 'Estilo de mano desconocido.' });
    expect(await arnes.pedir(ana, 'sala:levantarMano', { levantada: true })).toEqual({
      ok: false,
      error: 'Solo los jugadores sentados y los narradores pueden levantar la mano.',
    });
    await arnes.hacer(ana, 'sala:sentarse', { jugadorId: idAsiento(0) });
    expect(await arnes.pedir(ana, 'sala:elegirMano', { forma: 'garra' })).toEqual({ ok: false, error: 'Forma de mano desconocida.' });
    expect(await arnes.pedir(ana, 'sala:elegirMano', { forma: 'paz' })).toEqual({ ok: true });
    expect(await arnes.pedir(ana, 'sala:levantarMano', { levantada: 'sí' })).toEqual({ ok: false, error: 'Estado desconocido.' });
    expect(await arnes.pedir(ana, 'sala:levantarMano', { levantada: true })).toEqual({ ok: true });
    expect(participante(bea, ana)).toMatchObject({ manoLevantada: true, formaMano: 'paz' });
  });

  it('sentarse y levantarse; el narrador levanta y expulsa a otros', async () => {
    expect(await arnes.pedir(ana, 'sala:sentarse', { jugadorId: 3 })).toEqual({ ok: false, error: 'Asiento desconocido.' });
    await arnes.hacer(ana, 'sala:sentarse', { jugadorId: idAsiento(0) });
    expect(await arnes.pedir(ana, 'sala:sentarse', { jugadorId: idAsiento(1) })).toEqual({ ok: false, error: 'Ya estás sentado.' });
    expect(await arnes.pedir(ana, 'sala:levantarJugador', { participanteId: bea.id })).toEqual({
      ok: false,
      error: 'Solo un narrador puede levantar a un jugador.',
    });
    expect(await arnes.pedir(narradora, 'sala:levantarJugador', { participanteId: bea.id })).toEqual({ ok: false, error: 'Bea no está en ningún asiento.' });
    expect(await arnes.pedir(narradora, 'sala:levantarJugador', { participanteId: ana.id })).toEqual({ ok: true });
    expect(participante(ana, ana)?.rol).toBe('visitante');

    expect(await arnes.pedir(narradora, 'sala:expulsar', { participanteId: narradora.id })).toEqual({
      ok: false,
      error: 'Para quitar a un narrador, usa «Expulsar narrador».',
    });
    // A Bea ya no le llega nada (se le cierra la conexión): solo se espera a Ana
    const expulsada = await new Promise((resolver) => narradora.socket.emit('sala:expulsar', { participanteId: bea.id }, resolver));
    expect(expulsada).toEqual({ ok: true });
    await ana.esperarQue((estado) => !estado.participantes.some((p) => p.id === bea.id));
  });

  it('los narradores: nombrar a otro, quitarle el papel y dejarlo', async () => {
    expect(narradora.estado.acciones).not.toContain('sala:quitarNarrador');
    expect(await arnes.pedir(narradora, 'sala:nombrarNarrador', { participanteId: 'nadie' })).toEqual({ ok: false, error: 'Esa persona ya no está en la sala.' });
    expect(await arnes.pedir(narradora, 'sala:nombrarNarrador', { participanteId: ana.id })).toEqual({ ok: true });
    expect(await arnes.pedir(narradora, 'sala:nombrarNarrador', { participanteId: ana.id })).toEqual({ ok: false, error: 'Ana ya es narrador.' });
    expect(await arnes.pedir(narradora, 'sala:quitarNarrador', { participanteId: narradora.id })).toEqual({
      ok: false,
      error: 'Para dejar de narrar, usa «Dejar de ser narrador».',
    });
    expect(await arnes.pedir(narradora, 'sala:quitarNarrador', { participanteId: ana.id })).toEqual({ ok: true });
    expect(await arnes.pedir(narradora, 'sala:dejarDeNarrar')).toEqual({ ok: true });
    expect(participante(bea, narradora)?.rol).toBe('visitante');
  });

  it('ver el grimorio: lo pide un visitante y el narrador responde', async () => {
    expect(await arnes.pedir(narradora, 'sala:accesoGrimorio', { participanteId: ana.id, conceder: true })).toEqual({
      ok: false,
      error: 'Esa persona ya no lo está pidiendo.',
    });
    expect(await arnes.pedir(ana, 'sala:solicitarGrimorio')).toEqual({ ok: true });
    expect(await arnes.pedir(ana, 'sala:solicitarGrimorio')).toEqual({ ok: false, error: 'Ya lo has pedido.' });
    expect(await arnes.pedir(narradora, 'sala:accesoGrimorio', { participanteId: ana.id, conceder: 'sí' })).toEqual({
      ok: false,
      error: 'Respuesta desconocida.',
    });
    expect(await arnes.pedir(narradora, 'sala:accesoGrimorio', { participanteId: ana.id, conceder: true })).toEqual({ ok: true });
    expect(await arnes.pedir(ana, 'sala:sentarse', { jugadorId: idAsiento(0) })).toEqual({
      ok: false,
      error: 'Quien ha visto el grimorio del narrador no puede sentarse en la plaza.',
    });
  });

  it('los asientos: añadir, quitar, mover y mezclar', async () => {
    const asientos = () => narradora.estado.plaza.length;
    const antes = asientos();
    expect(await arnes.pedir(narradora, 'sala:asientos', { cambio: 'girar' })).toEqual({ ok: false, error: 'Cambio de asientos desconocido.' });
    expect(await arnes.pedir(narradora, 'sala:asientos', { cambio: 'mezclar' })).toEqual({ ok: false, error: 'No hay nadie sentado para mezclar.' });
    expect(await arnes.pedir(narradora, 'sala:asientos', { cambio: 'añadir' })).toEqual({ ok: true });
    expect(asientos()).toBe(antes + 1);
    expect(await arnes.pedir(narradora, 'sala:asientos', { cambio: 'quitar' })).toEqual({ ok: true });
    expect(asientos()).toBe(antes);
    await arnes.hacer(ana, 'sala:sentarse', { jugadorId: idAsiento(0) });
    expect(await arnes.pedir(narradora, 'sala:asientos', { cambio: 'mover', desde: idAsiento(0), hasta: idAsiento(2) })).toEqual({ ok: true });
    expect(narradora.estado.plaza[2].participanteId).toBe(ana.id);
  });
});
