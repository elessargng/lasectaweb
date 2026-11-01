import { describe, expect, it } from 'vitest';
import { SalaDeJuego } from '../../src/models/SalaDeJuego';
import type { HabilidadNocheDto } from '../../src/views/dto/despertar';
import {
  describirPreguntaPartida,
  leerPreguntaPartida,
  type PreguntaPartida,
} from '../../src/models/compartido/preguntaPartida';
import { ficha } from '../../src/models/partida/habilidades/HabilidadNocturna';
import { contestarPregunta } from '../../src/models/narradorVirtual/contestarPregunta';
import { cronicaNueva } from '../../src/models/narradorVirtual/final/cronica';
import { guionNoGreaterJoy, invitado, personaje } from './guionDePrueba';

/** El despertar guiado de No Greater Joy: el Relojero, la Camarera y el Sabio. */

/** Una plaza de No Greater Joy con esos personajes (uno por asiento, en orden) y sus jugadores, de noche. */
function plaza(...personajes: string[]) {
  const juego = new SalaDeJuego();
  const { sala, partida } = juego;
  const guion = guionNoGreaterJoy();
  // La Reclusa y el Espía, para ver cómo registran
  partida.cambiarGuion({ ...guion, personajes: [...guion.personajes, personaje('recluse', 'outsider'), personaje('spy', 'minion')] });
  while (partida.plaza().length > personajes.length) sala.quitarAsiento();
  personajes.forEach((p, i) => {
    const { id } = sala.participantes.conectar(`s-${i}`, `c-${i}`, invitado(`J${i}`), () => true);
    sala.sentar(id, partida.plaza()[i].id);
    partida.grimorio.cambiarPersonaje(partida.plaza()[i].id, p);
  });
  partida.irANoche();
  const asiento = (i: number) => partida.plaza()[i];
  const fila = (personaje: string): HabilidadNocheDto | undefined => partida.guiado.habilidadesNoche().find((h) => h.personaje === personaje);
  const ultimo = (i: number) => partida.despertares.despertares().find((d) => d.jugador === asiento(i).id)?.mensajes.slice(-1)[0];
  const elegir = (i: number, ...elegidos: number[]) => {
    const jugadores = elegidos.map((e) => asiento(e).id);
    partida.despertares.enviar(asiento(i).id, { ...ficha('jugador'), jugadores, autor: asiento(i).id });
    partida.guiado.alElegir(asiento(i).id, jugadores);
  };
  return { juego, asiento, fila, ultimo, elegir };
}

describe('No Greater Joy', () => {
  it('con 5 jugadores, los esbirros y el demonio no se conocen', () => {
    const m = plaza('clockmaker', 'imp', 'empath', 'baron', 'sage');
    expect(m.fila('esbirros')).toMatchObject({ estado: 'falta', avisos: [{ tipo: 'pocosJugadores' }] });
    expect(m.fila('demonios')).toMatchObject({ estado: 'falta', avisos: [{ tipo: 'pocosJugadores' }] });
  });

  it('el Relojero cuenta los pasos del demonio a su esbirro más cercano, dando la vuelta a la plaza', () => {
    expect(plaza('clockmaker', 'imp', 'empath', 'baron', 'sage').fila('clockmaker')?.opciones.map((o) => o.envio.ficha)).toEqual(['dos']);
    expect(plaza('baron', 'clockmaker', 'empath', 'sage', 'imp').fila('clockmaker')?.opciones.map((o) => o.envio.ficha)).toEqual(['uno']);
  });

  it('con la Reclusa o el Espía, el Relojero da cada distancia posible (la de verdad, primero) y lo revisa el narrador', () => {
    // J0 Relojero, J1 Imp, J2 Reclusa, J3 Empático, J4 Barón, J5 Sabio: de verdad, 3; la Reclusa como esbirro, 1; como demonio, 2
    const conReclusa = plaza('clockmaker', 'imp', 'recluse', 'empath', 'baron', 'sage').fila('clockmaker')!;
    expect(conReclusa.estado).toBe('revisar');
    expect(conReclusa.opciones.map((o) => o.envio.ficha)).toEqual(['tres', 'uno', 'dos']);
    expect(conReclusa.opciones[1].registros).toEqual([expect.objectContaining({ como: 'esbirro' })]);
    // El Espía, el único esbirro: si no registra como esbirro, no hay ninguno (cero)
    const conEspia = plaza('clockmaker', 'imp', 'empath', 'spy', 'sage').fila('clockmaker')!;
    expect(conEspia.opciones.map((o) => o.envio.ficha)).toEqual(['dos', 'cero']);
  });

  it('la Camarera, la última, sabe cuántos de sus dos elegidos han despertado por su habilidad', () => {
    const m = plaza('chambermaid', 'empath', 'imp', 'clockmaker', 'baron', 'sage');
    const { partida } = m.juego;
    expect(partida.guiado.despertar('empath')).toBeNull();
    expect(partida.guiado.despertar('chambermaid')).toBeNull();
    expect(m.ultimo(0)).toMatchObject({ tarjeta: 'eleccion', eleccion: { cantidad: 2, puedeElegirse: false } });
    // El Empático ha despertado; el Barón, no
    m.elegir(0, 1, 4);
    const f = m.fila('chambermaid')!;
    expect(f.estado).toBe('revisar');
    expect(f.opciones.map((o) => o.envio.ficha)).toEqual(['uno']);
  });

  it('el Sabio solo despierta si le mata el demonio, y sabe que es uno de dos', () => {
    const m = plaza('sage', 'imp', 'empath', 'baron', 'clockmaker');
    const { partida } = m.juego;
    expect(m.fila('sage')).toMatchObject({ estado: 'falta', avisos: [{ tipo: 'noMuere' }] });
    partida.amanecer();
    partida.irANoche();
    expect(partida.guiado.despertar('imp')).toBeNull();
    m.elegir(1, 0);
    const f = m.fila('sage')!;
    expect(f.estado).toBe('revisar');
    // Una por cada otro jugador, con el demonio
    expect(f.opciones).toHaveLength(3);
    for (const o of f.opciones) {
      expect(o.envio).toMatchObject({ tarjeta: 'esteJugadorEs', personajes: ['imp'] });
      expect(o.envio.jugadores).toContain(m.asiento(1).id);
      expect(o.envio.jugadores).not.toContain(m.asiento(0).id);
    }
  });

  it('el Sabio también puede ver a la Reclusa como demonio', () => {
    const m = plaza('sage', 'imp', 'recluse', 'baron', 'empath');
    const { partida } = m.juego;
    partida.amanecer();
    partida.irANoche();
    expect(partida.guiado.despertar('imp')).toBeNull();
    m.elegir(1, 0);
    const f = m.fila('sage')!;
    // Las 3 con el Imp y 2 más con la Reclusa (la de los dos ya está)
    expect(f.opciones).toHaveLength(5);
    expect(f.opciones.slice(3).every((o) => o.registros[0]?.como === 'demonio')).toBe(true);
  });
});

describe('la pregunta montada sobre la partida', () => {
  // Asientos 1 a 5: J0 Relojero, J1 Imp, J2 Empático, J3 Barón, J4 Sabio
  const m = () => plaza('clockmaker', 'imp', 'empath', 'baron', 'sage');
  const ids = (x: ReturnType<typeof m>, ...i: number[]) => i.map((n) => x.asiento(n).id);

  it('se contesta con el grimorio: en juego, quiénes son, sillas, entre dos y la inicial', () => {
    const x = m();
    const c = (p: PreguntaPartida) => contestarPregunta(x.juego, cronicaNueva(), p);
    const demonio = { por: 'tipo', tipo: 'demon' } as const;
    expect(c({ tipo: 'enJuego', quien: { por: 'personaje', personaje: 'sage' } })).toBe(true);
    expect(c({ tipo: 'enJuego', quien: { por: 'personaje', personaje: 'artist' } })).toBe(false);
    expect(c({ tipo: 'es', jugadores: ids(x, 0, 1), todos: false, quien: demonio })).toBe(true);
    expect(c({ tipo: 'es', jugadores: ids(x, 1, 3), todos: true, quien: { por: 'alineamiento', alineamiento: 'malvado' } })).toBe(true);
    expect(c({ tipo: 'es', jugadores: ids(x, 1, 2), todos: true, quien: { por: 'alineamiento', alineamiento: 'malvado' } })).toBe(false);
    // El Imp, en la silla 2
    expect(c({ tipo: 'silla', quien: demonio, par: true })).toBe(true);
    // Entre el 5 y el 1, dando la vuelta: 5 y 1; entre el 1 y el 3: 1, 2 y 3
    expect(c({ tipo: 'entre', quien: demonio, desde: x.asiento(4).id, hasta: x.asiento(0).id })).toBe(false);
    expect(c({ tipo: 'entre', quien: demonio, desde: x.asiento(0).id, hasta: x.asiento(2).id })).toBe(true);
    expect(c({ tipo: 'inicial', quien: demonio, letra: 'J' })).toBe(true);
    expect(c({ tipo: 'inicial', quien: demonio, letra: 'P' })).toBe(false);
  });

  it('quién eligió a quién, anoche o alguna noche, con lo apuntado en la crónica', () => {
    const x = m();
    const cronica = cronicaNueva();
    cronica.ultimaNoche = 2;
    cronica.noches.set(x.asiento(1).id, [{ noche: 1, eligio: [[x.asiento(4).id]], infos: [], droison: null }]);
    const malvado = { por: 'alineamiento', alineamiento: 'malvado' } as const;
    expect(contestarPregunta(x.juego, cronica, { tipo: 'eligio', quien: malvado, a: x.asiento(4).id, cuando: 'algunaNoche' })).toBe(true);
    expect(contestarPregunta(x.juego, cronica, { tipo: 'eligio', quien: malvado, a: x.asiento(4).id, cuando: 'anoche' })).toBe(false);
  });

  it('se lee y se dice en palabras; lo que no vale, no se lee', () => {
    const asientos = ['a1', 'a2', 'a3'];
    const nombres = { jugador: (id: string) => ({ a1: 'Paco', a2: 'Marta', a3: 'Pepe' })[id] ?? id, personaje: () => 'Mayor', yo: 'a3' };
    const leer = (p: unknown) => leerPreguntaPartida(p, asientos, ['mayor']);
    const di = (p: unknown) => describirPreguntaPartida(leer(p)!, nombres);
    expect(di({ tipo: 'es', jugadores: ['a1', 'a2'], todos: false, quien: { por: 'tipo', tipo: 'demon' } })).toBe('¿Es alguno de Paco o Marta el demonio?');
    expect(di({ tipo: 'es', jugadores: ['a1', 'a2'], todos: true, quien: { por: 'alineamiento', alineamiento: 'malvado' } })).toBe('¿Son Paco y Marta malvados?');
    expect(di({ tipo: 'enJuego', quien: { por: 'personaje', personaje: 'mayor' } })).toBe('¿Está el Mayor en juego?');
    expect(di({ tipo: 'inicial', quien: { por: 'tipo', tipo: 'demon' }, letra: 'p' })).toBe('¿Empieza por «P» el nombre del demonio?');
    expect(di({ tipo: 'eligio', quien: { por: 'alineamiento', alineamiento: 'bueno' }, a: 'a3', cuando: 'anoche' })).toBe('¿Te eligió algún bueno anoche?');
    expect(leer({ tipo: 'es', jugadores: [], todos: false, quien: { por: 'tipo', tipo: 'demon' } })).toBeNull();
    expect(leer({ tipo: 'enJuego', quien: { por: 'personaje', personaje: 'imp' } })).toBeNull();
    expect(leer({ tipo: 'inicial', quien: { por: 'tipo', tipo: 'demon' }, letra: '12' })).toBeNull();
  });
});
