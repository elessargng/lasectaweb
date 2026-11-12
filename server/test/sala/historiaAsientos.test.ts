import { describe, expect, it } from 'vitest';
import { SalaDeJuego } from '../../src/models/SalaDeJuego';
import { informacionDada, muertes, nochesPorAsiento, personajesPorAsiento, ultimaNoche } from '../../src/models/partida/proyecciones/historiaAsientos';
import { conSemilla, guionDePrueba, invitado } from './guionDePrueba';

/** Lo que ha pasado a cada asiento, sacado del diario de la partida. */

const envio = { ficha: null, tarjeta: null, jugadores: [] as string[], personajes: [] as string[], texto: null, alineamiento: null };

function montar() {
  const juego = new SalaDeJuego(conSemilla(1));
  const { sala, partida } = juego;
  partida.cambiarGuion(guionDePrueba());
  ['Ana', 'Bea', 'Ceci'].forEach((nombre, i) => {
    const { id } = sala.participantes.conectar(`s-${nombre}`, `c-${nombre}`, invitado(nombre), () => true);
    sala.sentar(id, partida.plaza()[i].id);
  });
  ['imp', 'empath', 'chef'].forEach((p, i) => partida.grimorio.cambiarPersonaje(partida.plaza()[i].id, p));
  const asiento = (i: number) => partida.plaza()[i].id;
  return { juego, partida, asiento };
}

describe('la historia de cada asiento', () => {
  it('lo que eligió cada noche, lo que le dijo el narrador (y si era falso), cómo amaneció y su muerte con su causa', () => {
    const { partida, asiento } = montar();
    partida.irANoche();
    // El Imp elige a Ceci, que muere
    partida.despertares.despertar(asiento(0));
    partida.mandarDelNarrador(asiento(0), { ...envio, tarjeta: 'eleccion' }, { eleccion: { cantidad: 1, puedeElegirse: true } });
    partida.despertares.enviar(asiento(0), { ...envio, autor: asiento(0), ficha: 'jugador', jugadores: [asiento(2)] });
    partida.grimorio.cambiarVida(asiento(2), true, 'imp');
    // A la Empática se le da un 2 que es mentira (la verdad era 1)
    const uno = { ...envio, ficha: 'uno' as const };
    const dos = { ...envio, ficha: 'dos' as const };
    partida.anotar({ tipo: 'informacion', asiento: partida.asientoDiario(asiento(1)), personaje: 'empath', verdadera: uno, dada: dos, droison: 'envenenado' });
    partida.despertares.despertar(asiento(1));
    partida.mandarDelNarrador(asiento(1), dos);
    partida.amanecer();

    const diario = partida.registro.hechos();
    const noches = nochesPorAsiento(diario);
    expect(noches.get(asiento(0))).toEqual([{ noche: 1, eligio: [[asiento(2)]], infos: [], droison: null }]);
    expect(noches.get(asiento(1))).toEqual([{ noche: 1, eligio: [], infos: [{ envio: expect.objectContaining({ ficha: 'dos' }), falsa: true }], droison: null }]);
    expect(muertes(diario).get(asiento(2))).toEqual({ momento: 'noche', numero: 1, causa: 'imp' });
    expect(informacionDada(diario, asiento(1), 'empath')).toEqual({ verdadera: uno, dada: dos });
    expect(ultimaNoche(diario)).toBe(1);
  });

  it('los personajes que lleva cada asiento desde que empieza la partida', () => {
    const { partida, asiento } = montar();
    partida.irANoche();
    partida.grimorio.cambiarPersonaje(asiento(1), 'imp');
    expect(personajesPorAsiento(partida.registro.hechos()).get(asiento(1))).toEqual(['empath', 'imp']);
  });
});
