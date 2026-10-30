import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EstadisticasPartida } from '../../src/services/estadisticas/EstadisticasPartida';
import type { RegistroPartida } from '../../src/services/estadisticas/SeguimientoPartida';
import { SALA_CUENTA_ATRAS_MS } from '../../src/services/partida/Nominaciones';
import { SalaService } from '../../src/services/SalaService';
import { conCuenta, guionDePrueba } from './guionDePrueba';

/** Lo que se guarda de cada partida para las estadísticas (al revelar el grimorio). */

/** Las partidas que se mandan guardar: las estadísticas, escuchando a la sala (como en salaSocket). */
function guardadas(sala: SalaService): RegistroPartida[] {
  const registros: RegistroPartida[] = [];
  const estadisticas = new EstadisticasPartida((registro) => registros.push(registro));
  sala.suscribir((evento) => estadisticas.registrar(evento));
  return registros;
}

/** Ana (1), Bea (2) y Ceci (3) sentadas en los asientos 1 a 3 con chef, imp y empath; Nora (9) narra. */
function partida() {
  const sala = new SalaService();
  sala.cambiarGuion(guionDePrueba());
  const entra = (userId: string, nombre: string) => sala.conectar(`s-${nombre}`, `c-${nombre}`, conCuenta(userId, nombre), () => true).id;
  const ids = [entra('1', 'ana'), entra('2', 'bea'), entra('3', 'ceci')];
  ids.forEach((id, i) => sala.sentar(id, sala.asientos()[i].id));
  sala.cambiarRol(entra('9', 'nora'), 'narrador');
  ['chef', 'imp', 'empath'].forEach((p, i) => sala.cambiarPersonaje(sala.asientos()[i].id, p));
  const asiento = (i: number) => sala.asientos()[i].id;
  return { sala, ids, asiento, registros: guardadas(sala) };
}

describe('estadísticas de la partida', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const votar = (sala: SalaService) => {
    sala.iniciarCuentaAtras(Date.now());
    vi.advanceTimersByTime(SALA_CUENTA_ATRAS_MS + sala.configuracion().segundosPorFicha * 1000 * sala.asientos().length);
  };

  it('apunta roles, nominaciones, votos y ejecuciones de cada jugador con cuenta', () => {
    const { sala, ids, asiento, registros } = partida();
    sala.irANoche();
    // De noche cambia la ficha de Ana: cuenta, porque empieza el día con ella
    sala.cambiarPersonaje(asiento(0), 'librarian');
    sala.amanecer();
    // Día 1: Ana nomina a Bea, votan Ana y Ceci; Bea se lleva la calavera y anochece
    sala.nominar(asiento(0), asiento(1));
    sala.levantarMano(ids[0], true);
    sala.levantarMano(ids[2], true);
    votar(sala);
    sala.marcar(asiento(1), true, 2);
    sala.irANoche();
    sala.amanecer();
    // Día 2: Bea nomina a Ceci y se la ejecuta
    sala.nominar(asiento(1), asiento(2));
    sala.ejecutar(asiento(2));
    sala.empezarRevelacion('bueno', ['slayer']);

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
    expect(r.mesa[2]).toEqual({ numero: 3, nombre: 'ceci', userId: '3', personaje: 'empath', ficha: null, alineamiento: 'bueno', muerto: true });
    expect(r.mesa[3]).toEqual({ numero: 4, nombre: null, userId: null, personaje: null, ficha: null, alineamiento: null, muerto: false });
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
    const { sala, ids, asiento, registros } = partida();
    sala.irANoche();
    sala.amanecer();
    sala.nominar(asiento(0), asiento(1));
    sala.levantarMano(ids[0], true);
    sala.iniciarCuentaAtras(Date.now());
    vi.advanceTimersByTime(SALA_CUENTA_ATRAS_MS + sala.configuracion().segundosPorFicha * 1000 * 3);
    sala.reiniciarVotacion();
    sala.cambiarPersonaje(asiento(2), 'butcher');
    sala.nominar(asiento(1), asiento(2));
    sala.empezarRevelacion('bueno');
    const de = (userId: string) => registros[0].jugadores.find((j) => j.userId === userId);
    expect(de('1')).toMatchObject({ nominaciones: 1, votos: 0 });
    expect(de('2')).toMatchObject({ nominaciones: 0, nominado: 1 });
    expect(de('3')).toMatchObject({ nominado: 0 });
  });

  it('la máquina del tiempo también devuelve las estadísticas como estaban', () => {
    const { sala, asiento, registros } = partida();
    sala.irANoche();
    sala.amanecer();
    sala.marcar(asiento(1), true);
    sala.irANoche();
    // Se había precipitado: vuelve al día (con la calavera) y no anochece
    sala.volverAtras();
    sala.desmarcar();
    sala.empezarRevelacion('malvado');
    expect(registros[0].jugadores.find((j) => j.userId === '2')?.ejecutado).toBe(0);
  });

  it('volviendo dos fases atrás, cada una deshace lo suyo', () => {
    const { sala, asiento, registros } = partida();
    sala.irANoche();
    // El rol con el que Ana empieza el día 1 cuenta, salvo que se deshaga ese amanecer
    sala.cambiarPersonaje(asiento(0), 'librarian');
    sala.amanecer();
    sala.marcar(asiento(1), true);
    sala.irANoche();
    sala.volverAtras();
    sala.volverAtras();
    expect(sala.fase()).toMatchObject({ momento: 'noche', numero: 1 });
    sala.empezarRevelacion('bueno');
    const ana = registros[0].jugadores.find((j) => j.userId === '1');
    expect(ana).toMatchObject({ roles: ['chef'], rolFinal: 'chef' });
    expect(registros[0].jugadores.find((j) => j.userId === '2')?.ejecutado).toBe(0);
  });

  it('volviendo a la preparación, la partida no ha empezado: se guarda sin jugadores', () => {
    const { sala, registros } = partida();
    sala.irANoche();
    sala.volverAtras();
    sala.empezarRevelacion('bueno');
    expect(registros).toHaveLength(1);
    expect(registros[0].jugadores).toEqual([]);
    expect(registros[0].narradores).toEqual(['9']);
  });

  it('una causa de esbirro es de la cuenta del esbirro que eligió el narrador', () => {
    const { sala, asiento, registros } = partida();
    sala.cambiarPersonaje(asiento(1), 'poisoner');
    sala.cambiarPersonaje(asiento(2), 'damsel');
    sala.irANoche();
    sala.empezarRevelacion('malvado', ['damsel'], { damsel: asiento(1) });
    const causas = Object.fromEntries(registros[0].jugadores.map((j) => [j.userId, j.causas]));
    expect(causas).toEqual({ '1': [], '2': ['damsel'], '3': [] });
  });

  it('limpiar el grimorio empieza otra partida: lo apuntado se olvida', () => {
    const { sala, asiento, registros } = partida();
    sala.irANoche();
    sala.amanecer();
    sala.nominar(asiento(0), asiento(1));
    sala.limpiarGrimorio();
    sala.empezarRevelacion('bueno');
    expect(registros[0].jugadores).toEqual([]);
  });

  it('el diario apunta, por noches y días, los despertares, las muertes, la ejecución y los faroles', () => {
    const { sala, asiento, registros } = partida();
    const envio = { tarjeta: null, personajes: [], texto: null, alineamiento: null };
    // En la preparación, el demonio se pone un farol
    sala.ponerFarolAsiento(asiento(1), 0, 'empath');
    sala.irANoche();
    // Noche 1: el narrador despierta a Bea (el demonio), le pide que elija y elige a Ceci, que muere
    sala.despertar(asiento(1));
    sala.mandarDelNarrador(asiento(1), { ...envio, ficha: null, tarjeta: 'eleccion', jugadores: [] });
    sala.enviarDespertar(asiento(1), { ...envio, autor: asiento(1), ficha: 'jugador', jugadores: [asiento(2)] });
    sala.cambiarVida(asiento(2), true);
    sala.amanecer();
    sala.confirmarMuerte(asiento(2));
    sala.usarFarol(asiento(1), 'empath');
    sala.nominar(asiento(0), asiento(1));
    sala.ejecutar(asiento(1));
    sala.empezarRevelacion('bueno');

    const resumen = registros[0].diario.map(({ fase, hora, ...h }) => [`${fase.momento} ${fase.numero}`, h]);
    expect(resumen).toEqual([
      ['preparacion 0', { tipo: 'farol', asiento: { numero: 2, nombre: 'bea' }, posicion: 0, personaje: 'empath' }],
      [
        'noche 1',
        expect.objectContaining({ tipo: 'despertar', asiento: { numero: 2, nombre: 'bea' }, delNarrador: true, tarjeta: 'eleccion', jugadores: [] }),
      ],
      [
        'noche 1',
        expect.objectContaining({ tipo: 'despertar', delNarrador: false, ficha: 'jugador', jugadores: [{ numero: 3, nombre: 'ceci' }] }),
      ],
      ['noche 1', { tipo: 'muere', asiento: { numero: 3, nombre: 'ceci' } }],
      ['dia 1', { tipo: 'usaFarol', asiento: { numero: 2, nombre: 'bea' }, personaje: 'empath' }],
      ['dia 1', { tipo: 'ejecucion', asiento: { numero: 2, nombre: 'bea' } }],
    ]);
  });

  it('la máquina del tiempo saca del diario lo hecho desde el cambio de fase que deshace', () => {
    const { sala, asiento, registros } = partida();
    sala.irANoche();
    sala.cambiarVida(asiento(2), true);
    sala.amanecer();
    sala.cambiarAlineamiento(asiento(0), 'malvado');
    sala.volverAtras();
    sala.empezarRevelacion('bueno');
    expect(registros[0].diario.map((e) => e.tipo)).toEqual(['muere']);
  });
});
