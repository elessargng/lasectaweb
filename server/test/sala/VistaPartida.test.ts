import { describe, expect, it } from 'vitest';
import { SalaService } from '../../src/services/SalaService';
import { VistaPartida, type ContextoVista } from '../../src/services/partida/VistaPartida';
import { guionDePrueba, invitado } from './guionDePrueba';

/** Lo que ve cada uno, sin sockets: la vista se prueba sola. */

const contexto: ContextoVista = {
  conversaciones: [],
  invitacionesDe: () => [],
  video: false,
  accionesDe: () => [],
};

function partida() {
  const sala = new SalaService();
  sala.cambiarGuion(guionDePrueba());
  const entra = (nombre: string) => sala.conectar(`s-${nombre}`, `c-${nombre}`, invitado(nombre), () => true).id;
  const narradora = entra('Nora');
  sala.cambiarRol(narradora, 'narrador');
  const ana = entra('Ana');
  const bea = entra('Bea');
  const vera = entra('Vera');
  sala.sentar(ana, sala.asientos()[0].id);
  sala.sentar(bea, sala.asientos()[1].id);
  const vista = (id: string) => new VistaPartida(sala, contexto).para(sala.buscar(id)!);
  const asiento = (i: number) => sala.asientos()[i];
  return { sala, narradora, ana, bea, vera, vista, asiento };
}

describe('VistaPartida', () => {
  it('un viajero ve su alineamiento como se le dijo, no el que se le pone en el grimorio', () => {
    const { sala, ana, vista, asiento } = partida();
    sala.cambiarPersonaje(asiento(0).id, 'voudon');
    sala.cambiarAlineamiento(asiento(0).id, 'malvado');
    expect(vista(ana).asientos[0]).toMatchObject({ personaje: 'voudon', alineamiento: null });
    sala.comunicarFicha(asiento(0).id, [], 'malvado');
    expect(vista(ana).asientos[0]).toMatchObject({ personaje: 'voudon', alineamiento: 'malvado' });
  });

  it('se ve quién es de verdad un viajero aunque lleve otra ficha (el Aprendiz)', () => {
    const { sala, bea, vista, asiento } = partida();
    sala.cambiarPersonaje(asiento(0).id, 'apprentice');
    sala.cambiarPersonaje(asiento(0).id, 'chef');
    expect(vista(bea).asientos[0].personaje).toBe('apprentice');
  });

  it('el visitante con el grimorio ve todos los despertares', () => {
    const { sala, vera, vista, asiento } = partida();
    sala.cambiarAccesoGrimorio(vera, 'concedido');
    sala.irANoche();
    sala.despertar(asiento(0).id);
    sala.despertar(asiento(1).id);
    expect(vista(vera).despertares).toHaveLength(2);
  });

  it('el grimorio enviado solo le llega al jugador del asiento', () => {
    const { sala, ana, bea, vista, asiento } = partida();
    sala.enviarGrimorio(asiento(0).id, [], ['chef']);
    expect(vista(ana).grimorioRecibido).toMatchObject({ faroles: ['chef'] });
    expect(vista(bea).grimorioRecibido).toBeNull();
  });

  it('en una votación secreta no se sabe con cuántos votos se puso la calavera', () => {
    const { sala, narradora, ana, vista, asiento } = partida();
    sala.cambiarPersonaje(asiento(4).id, 'organgrinder');
    sala.marcar(asiento(1).id, true, 4);
    expect(vista(narradora).asientos[1].votosMarca).toBe(4);
    expect(vista(ana).asientos[1].votosMarca).toBeNull();
  });

  it('de noche, un jugador solo ve la conversación en la que está, y nunca quién escucha', () => {
    const { sala, ana, vista } = partida();
    const conversaciones = [
      { id: 'c1', miembros: [ana, 'otro'], oyentes: ['vera'] },
      { id: 'c2', miembros: ['x', 'y'], oyentes: [] },
    ];
    const de = (id: string) => new VistaPartida(sala, { ...contexto, conversaciones }).para(sala.buscar(id)!);
    expect(de(ana).conversaciones).toHaveLength(2);
    expect(de(ana).conversaciones[0].oyentes).toEqual([]);
    sala.irANoche();
    expect(de(ana).conversaciones.map((c) => c.id)).toEqual(['c1']);
  });

  it('las acciones y las invitaciones las pone quien crea la vista', () => {
    const { sala, ana } = partida();
    const v = new VistaPartida(sala, { ...contexto, accionesDe: (p) => [`hola:${p.nombre}`], invitacionesDe: () => [{ id: 'i', de: 'x', para: ana }] });
    expect(v.para(sala.buscar(ana)!)).toMatchObject({ yo: ana, acciones: ['hola:Ana'], invitaciones: [{ id: 'i' }] });
  });
});
