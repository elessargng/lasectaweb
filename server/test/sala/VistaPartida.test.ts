import { describe, expect, it } from 'vitest';
import { SalaDeJuego } from '../../src/services/SalaDeJuego';
import { VistaPartida, type ContextoVista } from '../../src/views/VistaPartida';
import { guionDePrueba, invitado } from './guionDePrueba';

/** Lo que ve cada uno, sin sockets: la vista se prueba sola. */

const contexto: ContextoVista = {
  conversaciones: [],
  invitacionesDe: () => [],
  video: false,
  accionesDe: () => [],
};

function partida() {
  const juego = new SalaDeJuego();
  const { sala } = juego;
  juego.partida.cambiarGuion(guionDePrueba());
  const entra = (nombre: string) => sala.participantes.conectar(`s-${nombre}`, `c-${nombre}`, invitado(nombre), () => true).id;
  const narradora = entra('Nora');
  sala.participantes.cambiarRol(narradora, 'narrador');
  const ana = entra('Ana');
  const bea = entra('Bea');
  const vera = entra('Vera');
  sala.sentar(ana, juego.partida.plaza()[0].id);
  sala.sentar(bea, juego.partida.plaza()[1].id);
  const vista = (id: string) => new VistaPartida(juego, contexto).para(sala.participantes.buscar(id)!);
  const asiento = (i: number) => juego.partida.plaza()[i];
  return { juego, narradora, ana, bea, vera, vista, asiento };
}

describe('VistaPartida', () => {
  it('un viajero ve su alineamiento como se le dijo, no el que se le pone en el grimorio', () => {
    const { juego, ana, vista, asiento } = partida();
    juego.partida.grimorio.cambiarPersonaje(asiento(0).id, 'voudon');
    juego.partida.grimorio.cambiarAlineamiento(asiento(0).id, 'malvado');
    expect(vista(ana).plaza[0]).toMatchObject({ personaje: 'voudon', alineamiento: null });
    juego.partida.entregas.comunicarFicha(asiento(0).id, [], 'malvado');
    expect(vista(ana).plaza[0]).toMatchObject({ personaje: 'voudon', alineamiento: 'malvado' });
  });

  it('se ve quién es de verdad un viajero aunque lleve otra ficha (el Aprendiz)', () => {
    const { juego, bea, vista, asiento } = partida();
    juego.partida.grimorio.cambiarPersonaje(asiento(0).id, 'apprentice');
    juego.partida.grimorio.cambiarPersonaje(asiento(0).id, 'chef');
    expect(vista(bea).plaza[0].personaje).toBe('apprentice');
  });

  it('el visitante con el grimorio ve todos los despertares', () => {
    const { juego, vera, vista, asiento } = partida();
    juego.partida.acceso.cambiar(vera, 'concedido');
    juego.partida.irANoche();
    juego.partida.despertares.despertar(asiento(0).id);
    juego.partida.despertares.despertar(asiento(1).id);
    expect(vista(vera).despertares).toHaveLength(2);
  });

  it('el grimorio enviado solo le llega al jugador del asiento', () => {
    const { juego, ana, bea, vista, asiento } = partida();
    juego.partida.entregas.enviarGrimorio(asiento(0).id, [], ['chef']);
    expect(vista(ana).grimorioRecibido).toMatchObject({ faroles: ['chef'] });
    expect(vista(bea).grimorioRecibido).toBeNull();
  });

  it('en una votación secreta no se sabe con cuántos votos se puso la calavera', () => {
    const { juego, narradora, ana, vista, asiento } = partida();
    juego.partida.grimorio.cambiarPersonaje(asiento(4).id, 'organgrinder');
    juego.partida.grimorio.marcar(asiento(1).id, true, 4);
    expect(vista(narradora).calavera).toEqual({ jugadorId: asiento(1).id, votos: 4 });
    expect(vista(ana).calavera).toEqual({ jugadorId: asiento(1).id, votos: null });
  });

  it('de noche, un jugador solo ve la conversación en la que está, y nunca quién escucha', () => {
    const { juego, ana } = partida();
    const { sala } = juego;
    const conversaciones = [
      { id: 'c1', miembros: [ana, 'otro'], oyentes: ['vera'] },
      { id: 'c2', miembros: ['x', 'y'], oyentes: [] },
    ];
    const de = (id: string) => new VistaPartida(juego, { ...contexto, conversaciones }).para(sala.participantes.buscar(id)!);
    expect(de(ana).conversaciones).toHaveLength(2);
    expect(de(ana).conversaciones[0].oyentes).toEqual([]);
    juego.partida.irANoche();
    expect(de(ana).conversaciones.map((c) => c.id)).toEqual(['c1']);
  });

  it('las acciones y las invitaciones las pone quien crea la vista', () => {
    const { juego, ana } = partida();
    const { sala } = juego;
    const v = new VistaPartida(juego, { ...contexto, accionesDe: (p) => [`hola:${p.nombre}`], invitacionesDe: () => [{ id: 'i', de: 'x', para: ana }] });
    expect(v.para(sala.participantes.buscar(ana)!)).toMatchObject({ yo: ana, acciones: ['hola:Ana'], invitaciones: [{ id: 'i' }] });
  });
});
