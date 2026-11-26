import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Arnes, Cliente } from './arnes';

/**
 * La preparación de la partida por su socket (PreparacionController →
 * PreparacionService → Partida, Configuracion y Npcs): quién puede, lo que contesta
 * y lo que llega a cada uno.
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

const pedir = (c: Cliente, evento: string, datos?: unknown) => arnes.pedir(c, `preparacion:${evento}`, datos);

describe('la preparación', () => {
  it('solo un narrador; los NPC, con guion; lo de cada NPC, con él en juego', async () => {
    expect(await pedir(ana, 'configurar', { grimorioJugadores: true })).toEqual({
      ok: false,
      error: 'Solo un narrador puede cambiar los ajustes de la partida.',
    });
    expect(await pedir(narradora, 'npc', { personajeId: 'gardener' })).toEqual({ ok: false, error: 'Antes hay que elegir un guion.' });
    expect(await pedir(narradora, 'bootlegger', { reglas: [] })).toEqual({
      ok: false,
      error: 'Solo un narrador, con el Bootlegger en juego, escribe sus reglas.',
    });
    expect(narradora.estado.acciones).toEqual(expect.arrayContaining(['preparacion:configurar', 'preparacion:guion', 'preparacion:fondo']));
    expect(narradora.estado.acciones).not.toContain('preparacion:npc');
    expect(ana.estado.acciones.some((a) => a.startsWith('preparacion:'))).toBe(false);
  });

  it('los ajustes: lo que no se entiende ni llega al servicio; la velocidad y los mensajes, el dominio', async () => {
    expect(await pedir(narradora, 'configurar', {})).toEqual({ ok: false, error: 'Ajuste desconocido.' });
    expect(await pedir(narradora, 'configurar', { grimorioJugadores: 'sí' })).toEqual({ ok: false, error: 'Ajuste desconocido.' });
    expect(await pedir(narradora, 'configurar', { mensajes: 'algunos' })).toEqual({ ok: false, error: 'Ajuste desconocido.' });
    expect(await pedir(narradora, 'configurar', { segundosPorFicha: 0.3 })).toEqual({
      ok: false,
      error: 'La velocidad de las agujas tiene que ser de 0,25 a 2 segundos, de 0,25 en 0,25.',
    });
    expect(await pedir(narradora, 'configurar', { segundosPorFicha: 0.5, mensajes: 'todos', grimorioJugadores: true })).toEqual({ ok: true });
    expect(ana.estado.configuracion).toMatchObject({ segundosPorFicha: 0.5, mensajes: 'todos', grimorioJugadores: true });
  });

  it('el guion por defecto: con él, ya se ponen NPC', async () => {
    expect(await pedir(narradora, 'guion', { predeterminado: 'prueba' })).toEqual({ ok: true });
    expect(narradora.estado.acciones).toContain('preparacion:npc');
  });

  it('el fondo: el de por defecto, o una imagen que valga', async () => {
    expect(await pedir(narradora, 'fondo', {})).toEqual({ ok: false, error: 'Fondo desconocido.' });
    expect(await pedir(narradora, 'fondo', { imagen: 'no es una imagen' })).toMatchObject({ ok: false });
    expect(await pedir(narradora, 'fondo', { predeterminado: true })).toEqual({ ok: true });
    expect(ana.estado.configuracion.fondo).toBeNull();
  });

  it('los NPC: solo legendarios y lóricos; el Storm Catcher nombra a uno bueno; las reglas del Bootlegger, limpias', async () => {
    await arnes.hacer(narradora, 'preparacion:guion', { predeterminado: 'prueba' });
    expect(await pedir(narradora, 'npc', { personajeId: 'chef' })).toEqual({ ok: false, error: 'Como NPC solo van legendarios y lóricos.' });
    expect(await pedir(narradora, 'npc', { personajeId: 'nadie' })).toEqual({ ok: false, error: 'Ese personaje no existe.' });
    expect(await pedir(narradora, 'npc', { personajeId: 'hellslibrarian' })).toEqual({ ok: true });
    expect(narradora.estado.acciones).toContain('preparacion:silencio');
    expect(await pedir(narradora, 'silencio', { activo: 'sí' })).toEqual({ ok: false, error: 'Petición desconocida.' });
    expect(await pedir(narradora, 'silencio', { activo: true })).toEqual({ ok: true });
    expect(await pedir(narradora, 'privados', { abiertos: false })).toEqual({ ok: true });
  });

  it('asignar los personajes, solo en la preparación y con la bolsa llena', async () => {
    await arnes.hacer(narradora, 'preparacion:guion', { predeterminado: 'prueba' });
    expect(await pedir(narradora, 'asignarPersonajes')).toMatchObject({ ok: false });
    expect(await pedir(narradora, 'entregarFichas')).toEqual({ ok: false, error: 'No hay personajes por entregar.' });
    await arnes.hacer(narradora, 'fase:noche');
    expect(await pedir(narradora, 'asignarPersonajes')).toEqual({ ok: false, error: 'Los personajes solo se asignan en la preparación.' });
  });
});
