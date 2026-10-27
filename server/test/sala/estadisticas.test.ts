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
      ['asiento 1 (ana)', 'asiento 2 (bea)', 2],
      ['asiento 2 (bea)', 'asiento 3 (ceci)', null],
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
});
