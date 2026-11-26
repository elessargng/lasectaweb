import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resumenPartida, type RegistroPartida } from '../../src/models/estadisticas/resumenPartida';
import { SALA_CUENTA_ATRAS_MS } from '../../src/models/botc/partida/Nominaciones';
import { SalaDeJuego } from '../../src/models/botc/SalaDeJuego';
import { conCuenta, guionDePrueba, conSemilla } from './guionDePrueba';

/** Lo que se guarda de cada partida para las estadísticas (al revelar el grimorio). */

/** Las partidas que se mandan guardar: al terminar, sacadas de su diario (como en SalaService). */
function guardadas(juego: SalaDeJuego): RegistroPartida[] {
  const registros: RegistroPartida[] = [];
  juego.partida.alTerminar = (diario, id) => {
    const registro = resumenPartida(id, diario);
    if (registro) registros.push(registro);
  };
  return registros;
}

/** Algo que hace la narradora, como un paso de la historia (para poder deshacerlo). */
const paso = (juego: SalaDeJuego, hacer: () => unknown) => void juego.partida.historia.hacer('nora', 'prueba', hacer);

/** Ana (1), Bea (2) y Ceci (3) sentadas en los asientos 1 a 3 con chef, imp y empath; Nora (9) narra. */
function partida() {
  const juego = new SalaDeJuego(conSemilla(1));
  const { sala } = juego;
  juego.partida.cambiarGuion(guionDePrueba());
  const entra = (userId: string, nombre: string) => sala.participantes.conectar(`s-${nombre}`, `c-${nombre}`, conCuenta(userId, nombre), () => true).id;
  const ids = [entra('1', 'ana'), entra('2', 'bea'), entra('3', 'ceci')];
  ids.forEach((id, i) => sala.sentar(id, juego.partida.plaza()[i].id));
  sala.participantes.cambiarRol(entra('9', 'nora'), 'narrador');
  ['chef', 'imp', 'empath'].forEach((p, i) => juego.partida.grimorio.cambiarPersonaje(juego.partida.plaza()[i].id, p));
  const asiento = (i: number) => juego.partida.plaza()[i].id;
  return { juego, ids, asiento, registros: guardadas(juego) };
}

describe('estadísticas de la partida', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const votar = (juego: SalaDeJuego) => {
    const { partida } = juego;
    partida.nominaciones.iniciarCuentaAtras(Date.now());
    vi.advanceTimersByTime(SALA_CUENTA_ATRAS_MS + partida.configuracion.actual().segundosPorFicha * 1000 * partida.plaza().length);
  };

  it('apunta roles, nominaciones, votos y ejecuciones de cada jugador con cuenta', () => {
    const { juego, ids, asiento, registros } = partida();
    const { sala } = juego;
    juego.partida.irANoche();
    // De noche cambia la ficha de Ana: cuenta, porque empieza el día con ella
    juego.partida.grimorio.cambiarPersonaje(asiento(0), 'librarian');
    juego.partida.amanecer();
    // Día 1: Ana nomina a Bea, votan Ana y Ceci; Bea se lleva la calavera y anochece
    juego.partida.nominar(asiento(0), asiento(1));
    sala.participantes.levantarMano(ids[0], true);
    sala.participantes.levantarMano(ids[2], true);
    votar(juego);
    juego.partida.grimorio.marcar(asiento(1), true, 2);
    juego.partida.irANoche();
    juego.partida.amanecer();
    // Día 2: Bea nomina a Ceci y se la ejecuta
    juego.partida.nominar(asiento(1), asiento(2));
    juego.partida.ejecutar(asiento(2));
    juego.partida.empezarRevelacion('bueno', ['slayer']);

    expect(registros).toHaveLength(1);
    const r = registros[0];
    expect(r).toMatchObject({
      guion: 'Guion de prueba',
      edicion: null,
      ganador: 'bueno',
      dias: 3,
      causas: ['slayer'],
      narradores: ['9'],
      narradoresNombres: ['nora'],
      npcs: [],
    });
    expect(r.votaciones.map((v) => [v.nomina, v.nominado, v.votos])).toEqual([
      ['ana', 'bea', 2],
      ['bea', 'ceci', null],
    ]);
    expect(r.mesa).toHaveLength(7);
    expect(r.mesa[2]).toEqual({ id: asiento(2), numero: 3, nombre: 'ceci', userId: '3', personaje: 'empath', ficha: null, alineamiento: 'bueno', muerto: true, droison: null });
    expect(r.mesa[3]).toEqual({ id: asiento(3), numero: 4, nombre: null, userId: null, personaje: null, ficha: null, alineamiento: null, muerto: false, droison: null });
    expect(r.jugadores).toEqual([
      {
        userId: '1', roles: ['chef', 'librarian'], rolFinal: 'librarian', alineamientoInicial: 'bueno', alineamientoFinal: 'bueno',
        gano: true, vivo: true, causas: [], nominaciones: 1, nominado: 0, votos: 1, ejecutado: 0,
      },
      {
        userId: '2', roles: ['imp'], rolFinal: 'imp', alineamientoInicial: 'malvado', alineamientoFinal: 'malvado',
        gano: false, vivo: true, causas: [], nominaciones: 1, nominado: 1, votos: 0, ejecutado: 1,
      },
      {
        userId: '3', roles: ['empath'], rolFinal: 'empath', alineamientoInicial: 'bueno', alineamientoFinal: 'bueno',
        gano: true, vivo: false, causas: [], nominaciones: 0, nominado: 1, votos: 1, ejecutado: 1,
      },
    ]);
  });

  it('reiniciar la votación descuenta los votos ya contados; pedir una expulsión no es nominar', () => {
    const { juego, ids, asiento, registros } = partida();
    const { sala } = juego;
    juego.partida.irANoche();
    juego.partida.amanecer();
    juego.partida.nominar(asiento(0), asiento(1));
    sala.participantes.levantarMano(ids[0], true);
    juego.partida.nominaciones.iniciarCuentaAtras(Date.now());
    vi.advanceTimersByTime(SALA_CUENTA_ATRAS_MS + juego.partida.configuracion.actual().segundosPorFicha * 1000 * 3);
    juego.partida.nominaciones.reiniciarVotacion();
    juego.partida.grimorio.cambiarPersonaje(asiento(2), 'butcher');
    juego.partida.nominar(asiento(1), asiento(2));
    juego.partida.empezarRevelacion('bueno');
    const de = (userId: string) => registros[0].jugadores.find((j) => j.userId === userId);
    expect(de('1')).toMatchObject({ nominaciones: 1, votos: 0 });
    expect(de('2')).toMatchObject({ nominaciones: 0, nominado: 1 });
    expect(de('3')).toMatchObject({ nominado: 0 });
  });

  it('volver atrás también devuelve las estadísticas como estaban', () => {
    const { juego, asiento, registros } = partida();
    paso(juego, () => juego.partida.irANoche());
    paso(juego, () => juego.partida.amanecer());
    paso(juego, () => juego.partida.grimorio.marcar(asiento(1), true));
    paso(juego, () => juego.partida.irANoche());
    // Se había precipitado: vuelve al día justo antes de anochecer (con la calavera)
    juego.partida.historia.volverDeFase();
    expect(juego.partida.grimorio.calavera()?.jugadorId).toBe(asiento(1));
    juego.partida.grimorio.desmarcar();
    juego.partida.empezarRevelacion('malvado');
    expect(registros[0].jugadores.find((j) => j.userId === '2')?.ejecutado).toBe(0);
  });

  it('volviendo dos fases atrás, se deshace todo lo de después de cada una', () => {
    const { juego, asiento, registros } = partida();
    paso(juego, () => juego.partida.irANoche());
    paso(juego, () => juego.partida.grimorio.cambiarPersonaje(asiento(0), 'librarian'));
    // El rol con el que Ana empieza el día 1 cuenta, salvo que se deshaga ese amanecer
    paso(juego, () => juego.partida.amanecer());
    paso(juego, () => juego.partida.grimorio.marcar(asiento(1), true));
    paso(juego, () => juego.partida.irANoche());
    juego.partida.historia.volverDeFase();
    juego.partida.historia.volverDeFase();
    expect(juego.partida.fases.actual()).toMatchObject({ momento: 'noche', numero: 1 });
    expect(juego.partida.plaza()[0].personaje).toBe('librarian');
    juego.partida.empezarRevelacion('bueno');
    const ana = registros[0].jugadores.find((j) => j.userId === '1');
    expect(ana).toMatchObject({ roles: ['chef'] });
    expect(registros[0].jugadores.find((j) => j.userId === '2')?.ejecutado).toBe(0);
  });

  it('deshacer devuelve las estadísticas de antes de ese paso', () => {
    const { juego, asiento, registros } = partida();
    paso(juego, () => juego.partida.irANoche());
    paso(juego, () => juego.partida.amanecer());
    paso(juego, () => juego.partida.nominar(asiento(0), asiento(1)));
    juego.partida.historia.deshacer();
    expect(juego.partida.nominaciones.nominacion()).toBeNull();
    juego.partida.empezarRevelacion('bueno');
    expect(registros[0].jugadores.find((j) => j.userId === '1')).toMatchObject({ nominaciones: 0 });
  });

  it('volviendo a la preparación, la partida no ha empezado: se guarda sin jugadores', () => {
    const { juego, registros } = partida();
    paso(juego, () => juego.partida.irANoche());
    juego.partida.historia.volverDeFase();
    juego.partida.empezarRevelacion('bueno');
    expect(registros).toHaveLength(1);
    expect(registros[0].jugadores).toEqual([]);
    expect(registros[0].narradores).toEqual(['9']);
  });

  it('una causa de esbirro es de la cuenta del esbirro que eligió el narrador', () => {
    const { juego, asiento, registros } = partida();
    juego.partida.grimorio.cambiarPersonaje(asiento(1), 'poisoner');
    juego.partida.grimorio.cambiarPersonaje(asiento(2), 'damsel');
    juego.partida.irANoche();
    juego.partida.empezarRevelacion('malvado', ['damsel'], { damsel: asiento(1) });
    const causas = Object.fromEntries(registros[0].jugadores.map((j) => [j.userId, j.causas]));
    expect(causas).toEqual({ '1': [], '2': ['damsel'], '3': [] });
  });

  it('limpiar el grimorio empieza otra partida: lo apuntado se olvida', () => {
    const { juego, asiento, registros } = partida();
    juego.partida.irANoche();
    juego.partida.amanecer();
    juego.partida.nominar(asiento(0), asiento(1));
    juego.partida.limpiarGrimorio();
    juego.partida.empezarRevelacion('bueno');
    expect(registros[0].jugadores).toEqual([]);
  });

  it('el diario apunta, por noches y días, los despertares, las muertes, la ejecución y los faroles', () => {
    const { juego, asiento, registros } = partida();
    const envio = { tarjeta: null, personajes: [], texto: null, alineamiento: null };
    // En la preparación, el demonio se pone un farol
    juego.partida.faroles.ponerFarolAsiento(asiento(1), 0, 'empath');
    juego.partida.irANoche();
    // Noche 1: el narrador despierta a Bea (el demonio), le pide que elija y elige a Ceci, que muere
    juego.partida.despertares.despertar(asiento(1));
    juego.partida.mandarDelNarrador(asiento(1), { ...envio, ficha: null, tarjeta: 'eleccion', jugadores: [] });
    juego.partida.despertares.enviar(asiento(1), { ...envio, autor: asiento(1), ficha: 'jugador', jugadores: [asiento(2)] });
    juego.partida.grimorio.cambiarVida(asiento(2), true);
    juego.partida.amanecer();
    juego.partida.grimorio.confirmarMuerte(asiento(2));
    juego.partida.faroles.usarFarol(asiento(1), 'empath');
    juego.partida.nominar(asiento(0), asiento(1));
    juego.partida.ejecutar(asiento(1));
    juego.partida.empezarRevelacion('bueno');

    const resumen = registros[0].diario.map(({ fase, hora, ...h }) => [`${fase.momento} ${fase.numero}`, h]);
    // Cada asiento, con su número, quien se sentaba, su id y su cuenta
    const bea = { numero: 2, nombre: 'bea', id: asiento(1), userId: '2' };
    const ceci = { numero: 3, nombre: 'ceci', id: asiento(2), userId: '3' };
    expect(resumen).toEqual([
      ['preparacion 0', { tipo: 'farol', asiento: bea, posicion: 0, personaje: 'empath' }],
      ['noche 1', expect.objectContaining({ tipo: 'despertar', asiento: bea, delNarrador: true, tarjeta: 'eleccion', jugadores: [] })],
      ['noche 1', expect.objectContaining({ tipo: 'despertar', delNarrador: false, ficha: 'jugador', jugadores: [ceci] })],
      ['noche 1', { tipo: 'muere', asiento: ceci, causa: 'narrador' }],
      ['dia 1', { tipo: 'usaFarol', asiento: bea, personaje: 'empath' }],
      ['dia 1', { tipo: 'ejecucion', asiento: bea }],
      ['dia 1', { tipo: 'muere', asiento: bea, causa: 'ejecucion' }],
    ]);
  });

  it('volver atrás saca del diario lo hecho desde el cambio de fase al que vuelve', () => {
    const { juego, asiento, registros } = partida();
    paso(juego, () => juego.partida.irANoche());
    paso(juego, () => juego.partida.grimorio.cambiarVida(asiento(2), true));
    paso(juego, () => juego.partida.amanecer());
    paso(juego, () => juego.partida.grimorio.cambiarAlineamiento(asiento(0), 'malvado'));
    juego.partida.historia.volverDeFase();
    expect(juego.partida.grimorio.alineamiento(juego.partida.plaza()[0])).not.toBe('malvado');
    juego.partida.empezarRevelacion('bueno');
    expect(registros[0].diario.map((e) => e.tipo)).toEqual(['muere']);
  });

  it('una ejecución cuenta una vez, aunque siga con la calavera al anochecer; sin ejecutar, la calavera al anochecer cuenta', () => {
    const { juego, asiento, registros } = partida();
    const { partida: p } = juego;
    p.irANoche();
    p.amanecer();
    // Día 1: se ejecuta a Bea, que sigue con la calavera (como el Bufón, que no muere) al anochecer
    p.ejecutar(asiento(1));
    p.grimorio.marcar(asiento(1), true);
    p.irANoche();
    p.amanecer();
    // Día 2: el narrador no ejecuta: anochece con la calavera puesta a Ceci
    p.grimorio.marcar(asiento(2), true);
    p.irANoche();
    p.empezarRevelacion('bueno');
    const de = (userId: string) => registros[0].jugadores.find((j) => j.userId === userId);
    expect(de('2')?.ejecutado).toBe(1);
    expect(de('3')?.ejecutado).toBe(1);
  });

  it('deshacer la revelación y volver a revelar guarda la misma partida (con su id)', () => {
    const { juego, registros } = partida();
    paso(juego, () => juego.partida.irANoche());
    paso(juego, () => juego.partida.empezarRevelacion('bueno'));
    juego.partida.historia.deshacer();
    paso(juego, () => juego.partida.empezarRevelacion('malvado'));
    expect(registros.map((r) => r.ganador)).toEqual(['bueno', 'malvado']);
    expect(registros[1].id).toBe(registros[0].id);
    // Otra partida, otro id
    paso(juego, () => juego.partida.limpiarGrimorio());
    paso(juego, () => juego.partida.irANoche());
    paso(juego, () => juego.partida.empezarRevelacion('bueno'));
    expect(registros[2].id).not.toBe(registros[0].id);
  });

  it('las votaciones salen del diario: quién nomina a quién, quién vota y cuántos votos', () => {
    const { juego, ids, asiento, registros } = partida();
    juego.partida.irANoche();
    juego.partida.amanecer();
    juego.partida.nominar(asiento(0), asiento(1));
    for (const id of [ids[0], ids[1]]) juego.sala.participantes.levantarMano(id, true);
    votar(juego);
    juego.partida.empezarRevelacion('bueno');
    expect(registros[0].votaciones).toEqual([
      expect.objectContaining({ dia: 1, nomina: 'ana', nominado: 'bea', nominaAsiento: asiento(0), nominadoAsiento: asiento(1), votantes: ['ana', 'bea'], votos: 2 }),
    ]);
  });
});

describe('el guardarraíl del diario', () => {
  it('un paso que cambia a un jugador sin apuntarlo en el diario falla', () => {
    const { juego, asiento } = partida();
    expect(() => paso(juego, () => {
      juego.partida.plaza().find((a) => a.id === asiento(0))!.muerto = true;
    })).toThrow('[Historia] «prueba» ha cambiado un jugador sin apuntarlo en el diario.');
  });

  it('lo mismo, apuntado, pasa; y lo que no cuenta como hecho (una nota) también', () => {
    const { juego, asiento } = partida();
    expect(() => paso(juego, () => juego.partida.grimorio.cambiarVida(asiento(0), true))).not.toThrow();
    expect(() => paso(juego, () => juego.partida.grimorio.escribirNota(asiento(1), 'sospechosa'))).not.toThrow();
  });
});
