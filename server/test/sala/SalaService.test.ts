import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EstadisticasPartida } from '../../src/services/estadisticas/EstadisticasPartida';
import { SALA_GRACIA_MS } from '../../src/services/partida/Participantes';
import { SALA_CUENTA_ATRAS_MS } from '../../src/services/partida/Nominaciones';
import { SalaService } from '../../src/services/SalaService';
import { BOLSA_DE_SIETE, conCuenta, guionDePrueba, invitado } from './guionDePrueba';

/**
 * Tests de caracterización: fijan cómo se comporta hoy la sala, para poder
 * partir SalaService sin cambiar lo que hace. Si uno falla tras un refactor, o
 * se ha roto algo o el cambio de comportamiento era a propósito (y el test se cambia).
 */

const siempreViva = () => true;

/** Una sala con guion y los jugadores dados sentados en los primeros asientos, en orden. */
function salaConJugadores(...nombres: string[]) {
  const sala = new SalaService();
  sala.cambiarGuion(guionDePrueba());
  const ids = nombres.map((nombre, i) => {
    const { id } = sala.conectar(`socket-${nombre}`, `cliente-${nombre}`, invitado(nombre), siempreViva);
    expect(sala.sentar(id, sala.asientos()[i].id)).toBeNull();
    return id;
  });
  const asiento = (i: number) => sala.asientos()[i];
  return { sala, ids, asiento };
}

/** Pasa al día 1 (noche 1 y amanecer). */
function alDia(sala: SalaService) {
  sala.irANoche();
  sala.amanecer();
}

describe('SalaService', () => {
  describe('una sala nueva', () => {
    it('empieza en la preparación, con 7 asientos libres y sin nadie', () => {
      const sala = new SalaService();
      expect(sala.fase()).toEqual({ momento: 'preparacion', numero: 0, reinicios: 0 });
      expect(sala.asientos()).toHaveLength(7);
      expect(sala.asientos().every((a) => a.ocupante === null && !a.muerto && a.personaje === null)).toBe(true);
      expect(sala.participantes()).toEqual([]);
      expect(sala.hayNarrador()).toBe(false);
      expect(sala.guion()).toBeNull();
    });
  });

  describe('conexiones', () => {
    it('quien entra es visitante', () => {
      const sala = new SalaService();
      const { id } = sala.conectar('s1', 'c1', invitado('Ana'), siempreViva);
      expect(sala.buscar(id)).toMatchObject({ nombre: 'Ana', rol: 'visitante', conCuenta: false, conectado: true });
    });

    it('una cuenta que entra otra vez retoma su sitio y echa a la conexión anterior', () => {
      const sala = new SalaService();
      const primera = sala.conectar('s1', 'c1', conCuenta('42', 'ana'), siempreViva);
      sala.sentar(primera.id, sala.asientos()[0].id);
      const segunda = sala.conectar('s2', 'c2', conCuenta('42', 'ana'), siempreViva);
      expect(segunda.id).toBe(primera.id);
      expect(segunda.expulsar).toBe('s1');
      expect(sala.buscar(primera.id)?.rol).toBe('jugador');
      expect(sala.participantes()).toHaveLength(1);
    });

    it('un invitado que vuelve con su id de cliente tras perder la conexión retoma su sitio', () => {
      const sala = new SalaService();
      const antes = sala.conectar('s1', 'c1', invitado('Ana'), siempreViva);
      const despues = sala.conectar('s2', 'c1', invitado('Ana'), () => false);
      expect(despues.id).toBe(antes.id);
    });

    it('un invitado con otro id de cliente entra como uno nuevo', () => {
      const sala = new SalaService();
      const a = sala.conectar('s1', 'c1', invitado('Ana'), siempreViva);
      const b = sala.conectar('s2', 'c2', invitado('Bea'), siempreViva);
      expect(b.id).not.toBe(a.id);
      expect(sala.participantes()).toHaveLength(2);
    });

    describe('con el tiempo parado', () => {
      beforeEach(() => vi.useFakeTimers());
      afterEach(() => vi.useRealTimers());

      it('al perder la conexión se le guarda el sitio un rato y después sale', () => {
        const sala = new SalaService();
        const { clave, id } = sala.conectar('s1', 'c1', invitado('Ana'), siempreViva);
        const alExpulsar = vi.fn();
        sala.desconectar(clave, 's1', alExpulsar);
        expect(sala.participantes()[0]).toMatchObject({ id, conectado: false });
        vi.advanceTimersByTime(SALA_GRACIA_MS - 1);
        expect(sala.buscar(id)).toBeDefined();
        vi.advanceTimersByTime(1);
        expect(sala.buscar(id)).toBeUndefined();
        expect(alExpulsar).toHaveBeenCalledOnce();
      });
    });

    it('quien sale a propósito se va enseguida', () => {
      const sala = new SalaService();
      const { clave, id } = sala.conectar('s1', 'c1', invitado('Ana'), siempreViva);
      sala.salir(clave, 's1');
      expect(sala.buscar(id)).toBeUndefined();
    });

    it('un invitado no puede usar un nombre que ya tiene otro (sin distinguir mayúsculas)', () => {
      const sala = new SalaService();
      sala.conectar('s1', 'c1', invitado('Ana'), siempreViva);
      expect(sala.nombreLibreParaInvitado('ANA', 'c2', siempreViva)).toBe(false);
      expect(sala.nombreLibreParaInvitado('Bea', 'c2', siempreViva)).toBe(true);
    });

    it('con cuenta y menos de 10 partidas es novato', () => {
      const sala = new SalaService();
      const { id } = sala.conectar('s1', 'c1', conCuenta('7', 'nuevo', 3), siempreViva);
      expect(sala.buscar(id)?.novato).toBe(true);
      sala.cambiarPartidasJugadas('7', 10);
      expect(sala.buscar(id)?.novato).toBe(false);
    });
  });

  describe('la mesa', () => {
    it('al sentarse pasa a jugador; al levantarse, a visitante', () => {
      const { sala, ids, asiento } = salaConJugadores('Ana');
      expect(sala.buscar(ids[0])?.rol).toBe('jugador');
      expect(asiento(0).ocupante).toBe(ids[0]);
      sala.levantar(ids[0]);
      expect(sala.buscar(ids[0])?.rol).toBe('visitante');
      expect(asiento(0).ocupante).toBeNull();
    });

    it('no se puede sentar en un asiento ocupado ni en uno que no existe', () => {
      const { sala, asiento } = salaConJugadores('Ana');
      const { id } = sala.conectar('s2', 'c2', invitado('Bea'), siempreViva);
      expect(sala.sentar(id, asiento(0).id)).toBe('Ese asiento ya está ocupado.');
      expect(sala.sentar(id, 'no-existe')).toBe('Ese asiento ya no existe.');
    });

    it('quien deja de ser jugador libera su asiento', () => {
      const { sala, ids, asiento } = salaConJugadores('Ana');
      sala.cambiarRol(ids[0], 'narrador');
      expect(asiento(0).ocupante).toBeNull();
    });

    it('al quitar el último asiento, quien estaba sentado vuelve a visitante', () => {
      const sala = new SalaService();
      const { id } = sala.conectar('s1', 'c1', invitado('Ana'), siempreViva);
      sala.sentar(id, sala.asientos()[6].id);
      sala.quitarAsiento();
      expect(sala.asientos()).toHaveLength(6);
      expect(sala.buscar(id)?.rol).toBe('visitante');
    });

    it('al cambiar de asiento, el jugador se lleva su ficha', () => {
      const { sala, ids, asiento } = salaConJugadores('Ana');
      sala.cambiarPersonaje(asiento(0).id, 'chef');
      sala.cambiarVida(asiento(0).id, true);
      expect(sala.moverOcupante(asiento(0).id, asiento(3).id)).toBeNull();
      expect(asiento(3)).toMatchObject({ ocupante: ids[0], personaje: 'chef', muerto: true });
      expect(asiento(0)).toMatchObject({ ocupante: null, personaje: null, muerto: false });
    });

    it('al mezclar los asientos, cada jugador sigue con su ficha', () => {
      const { sala, ids } = salaConJugadores('Ana', 'Bea', 'Ceci');
      const personajes = ['chef', 'empath', 'imp'];
      ids.forEach((_, i) => sala.cambiarPersonaje(sala.asientos()[i].id, personajes[i]));
      expect(sala.mezclarAsientos()).toBe(3);
      ids.forEach((id, i) => expect(sala.asientoDe(id)?.personaje).toBe(personajes[i]));
    });

    it('dos jugadores son vecinos si no hay nadie sentado entre ellos (los libres se saltan)', () => {
      const sala = new SalaService();
      const [a, b, c] = ['Ana', 'Bea', 'Ceci'].map((n) => sala.conectar(`s-${n}`, `c-${n}`, invitado(n), siempreViva).id);
      sala.sentar(a, sala.asientos()[0].id);
      sala.sentar(b, sala.asientos()[3].id);
      sala.sentar(c, sala.asientos()[5].id);
      expect(sala.sonVecinos(a, b)).toBe(true);
      expect(sala.sonVecinos(a, c)).toBe(true);
      expect(sala.sonVecinos(b, c)).toBe(true);
    });
  });

  describe('fichas, bolsa y reparto', () => {
    it('con 7 asientos, el reparto es de 5 aldeanos, 0 forasteros, 1 esbirro y 1 demonio', () => {
      const sala = new SalaService();
      sala.cambiarGuion(guionDePrueba());
      expect(sala.distribucion()).toEqual({ jugadores: 7, jugadoresVivos: 7, viajeros: 0, viajerosVivos: 0, aldeanos: 5, forasteros: 0, esbirros: 1, demonios: 1 });
    });

    it('un viajero puesto a mano no cuenta para el reparto ni para la bolsa', () => {
      const sala = new SalaService();
      sala.cambiarGuion(guionDePrueba());
      sala.cambiarPersonaje(sala.asientos()[0].id, 'voudon');
      expect(sala.distribucion()).toMatchObject({ jugadores: 6, viajeros: 1, aldeanos: 3, forasteros: 1 });
      expect(sala.fichasParaRepartir()).toBe(6);
    });

    it('repartir la bolsa da un personaje de la bolsa a cada asiento y la bolsa se queda igual', () => {
      const sala = new SalaService();
      sala.cambiarGuion(guionDePrueba());
      BOLSA_DE_SIETE.forEach((id) => sala.alternarEnBolsa(id));
      sala.repartirBolsa();
      const repartidos = sala.asientos().map((a) => a.personaje);
      expect([...repartidos].sort()).toEqual([...BOLSA_DE_SIETE].sort());
      expect(sala.asientos().every((a) => a.alineamiento === null)).toBe(true);
      expect(sala.bolsa()).toEqual(BOLSA_DE_SIETE);
    });

    it('meter dos veces un personaje en la bolsa lo saca', () => {
      const sala = new SalaService();
      sala.alternarEnBolsa('chef');
      sala.alternarEnBolsa('chef');
      expect(sala.bolsa()).toEqual([]);
    });

    it('el jugador ve lo que se le entregó, no lo que el narrador cambia después', () => {
      const { sala, asiento } = salaConJugadores('Ana');
      sala.cambiarPersonaje(asiento(0).id, 'chef');
      expect(sala.fichaEntregada(asiento(0).id)).toEqual({ personaje: null, alineamiento: null });
      sala.entregarFichas();
      sala.cambiarPersonaje(asiento(0).id, 'imp');
      expect(sala.fichaEntregada(asiento(0).id)).toEqual({ personaje: 'chef', alineamiento: null });
      // «Tú eres»: se entera del cambio
      sala.comunicarFicha(asiento(0).id, ['imp'], 'malvado');
      expect(sala.fichaEntregada(asiento(0).id)).toEqual({ personaje: 'imp', alineamiento: 'malvado' });
    });

    it('quien es de verdad: el de su «Is The …» o, sin él, el de su ficha', () => {
      const { sala, asiento } = salaConJugadores('Ana');
      sala.cambiarPersonaje(asiento(0).id, 'chef');
      expect(sala.identidad(asiento(0))).toBe('chef');
      sala.ponerRecordatorio(asiento(0).id, { personaje: 'drunk', indice: 0, texto: 'Is The Drunk' });
      expect(sala.identidad(asiento(0))).toBe('drunk');
    });

    it('el alineamiento: el puesto por el narrador o el de su tipo', () => {
      const { sala, asiento } = salaConJugadores('Ana', 'Bea', 'Ceci');
      sala.cambiarPersonaje(asiento(0).id, 'chef');
      sala.cambiarPersonaje(asiento(1).id, 'imp');
      sala.cambiarPersonaje(asiento(2).id, 'voudon');
      expect(sala.alineamientoEfectivo(asiento(0))).toBe('bueno');
      expect(sala.alineamientoEfectivo(asiento(1))).toBe('malvado');
      expect(sala.alineamientoEfectivo(asiento(2))).toBeNull();
      sala.cambiarAlineamiento(asiento(0).id, 'malvado');
      expect(sala.alineamientoEfectivo(asiento(0))).toBe('malvado');
    });

    it('cambiar el personaje devuelve el alineamiento al de su tipo', () => {
      const { sala, asiento } = salaConJugadores('Ana');
      sala.cambiarPersonaje(asiento(0).id, 'chef');
      sala.cambiarAlineamiento(asiento(0).id, 'malvado');
      sala.cambiarPersonaje(asiento(0).id, 'empath');
      expect(asiento(0).alineamiento).toBeNull();
    });

    it('al poner al Aprendiz en una ficha se le pone solo su «Is The Apprentice»', () => {
      const { sala, asiento } = salaConJugadores('Ana');
      sala.cambiarPersonaje(asiento(0).id, 'apprentice');
      expect(asiento(0).recordatorios.map((r) => r.texto)).toEqual(['Is The Apprentice']);
      sala.cambiarPersonaje(asiento(0).id, 'chef');
      expect(sala.identidad(asiento(0))).toBe('apprentice');
    });

    it('los NPCs del guion están en juego desde el principio; los del catálogo, al ponerlos', () => {
      const sala = new SalaService();
      sala.cambiarGuion(guionDePrueba());
      expect(sala.npcs()).toEqual([]);
      sala.alternarNpc('gardener');
      expect(sala.npcActivo('gardener')).toBe(true);
    });

    it('el silencio solo vale con el Bibliotecario del Infierno en juego', () => {
      const sala = new SalaService();
      sala.cambiarGuion(guionDePrueba());
      sala.pedirSilencio(true);
      expect(sala.silencio()).toBe(false);
      sala.alternarNpc('hellslibrarian');
      expect(sala.silencio()).toBe(true);
    });

    it('al quitar el Gardener, los personajes retenidos se entregan', () => {
      const { sala, asiento } = salaConJugadores('Ana');
      sala.alternarNpc('gardener');
      sala.cambiarPersonaje(asiento(0).id, 'chef');
      sala.retenerFichas(true);
      sala.alternarNpc('gardener');
      expect(sala.fichasRetenidas()).toBe(false);
      expect(sala.fichaEntregada(asiento(0).id).personaje).toBe('chef');
    });
  });

  describe('fases', () => {
    it('preparación → noche 1 → día 1 → noche 2', () => {
      const sala = new SalaService();
      sala.irANoche();
      expect(sala.fase()).toEqual({ momento: 'noche', numero: 1, reinicios: 0 });
      sala.amanecer();
      expect(sala.fase()).toEqual({ momento: 'dia', numero: 1, reinicios: 0 });
      sala.irANoche();
      expect(sala.fase()).toEqual({ momento: 'noche', numero: 2, reinicios: 0 });
    });

    it('al anochecer se quita la calavera y se cierra la nominación', () => {
      const { sala, asiento } = salaConJugadores('Ana', 'Bea');
      alDia(sala);
      sala.nominar(asiento(0).id, asiento(1).id);
      sala.marcar(asiento(1).id, true);
      sala.irANoche();
      expect(sala.hayMarca()).toBe(false);
      expect(sala.nominacion()).toBeNull();
    });

    it('la máquina del tiempo vuelve a la fase anterior y devuelve la calavera', () => {
      const { sala, asiento } = salaConJugadores('Ana', 'Bea');
      expect(sala.faseAnterior()).toBeNull();
      alDia(sala);
      sala.marcar(asiento(1).id, true, 3);
      sala.irANoche();
      expect(sala.volverAtras()).toBe(true);
      expect(sala.fase()).toMatchObject({ momento: 'dia', numero: 1 });
      expect(asiento(1)).toMatchObject({ marcado: true, votosMarca: 3 });
      expect(sala.volverAtras()).toBe(true);
      expect(sala.fase()).toMatchObject({ momento: 'noche', numero: 1 });
      expect(sala.volverAtras()).toBe(true);
      expect(sala.fase()).toMatchObject({ momento: 'preparacion', numero: 0 });
      expect(sala.volverAtras()).toBe(false);
    });

    it('limpiar el grimorio deja la partida como al principio, con los jugadores sentados', () => {
      const { sala, ids, asiento } = salaConJugadores('Ana');
      BOLSA_DE_SIETE.forEach((id) => sala.alternarEnBolsa(id));
      sala.repartirBolsa();
      sala.ponerRecordatorio(asiento(0).id, { personaje: 'poisoner', indice: 0, texto: 'Poisoned' });
      alDia(sala);
      sala.cambiarVida(asiento(0).id, true);
      sala.nominar(asiento(1).id, asiento(2).id);
      const { reinicios } = sala.fase();
      sala.limpiarGrimorio();
      expect(sala.fase()).toEqual({ momento: 'preparacion', numero: 0, reinicios: reinicios + 1 });
      expect(asiento(0)).toMatchObject({ ocupante: ids[0], muerto: false, personaje: null, recordatorios: [] });
      expect(sala.bolsa()).toEqual([]);
      expect(sala.votaciones()).toEqual([]);
      expect(sala.nominacion()).toBeNull();
    });

    it('cambiar de guion limpia el grimorio', () => {
      const { sala, asiento } = salaConJugadores('Ana');
      sala.cambiarPersonaje(asiento(0).id, 'chef');
      const version = sala.versionGuion();
      sala.cambiarGuion(guionDePrueba());
      expect(asiento(0).personaje).toBeNull();
      expect(sala.versionGuion()).toBe(version + 1);
    });
  });

  describe('muertes y votos de los muertos', () => {
    it('de día se muere enseguida y se pierde la calavera', () => {
      const { sala, asiento } = salaConJugadores('Ana');
      alDia(sala);
      sala.marcar(asiento(0).id, true);
      sala.cambiarVida(asiento(0).id, true);
      expect(asiento(0)).toMatchObject({ muerto: true, muertePendiente: false, marcado: false });
    });

    it('de noche la muerte queda pendiente hasta que el narrador la anuncia', () => {
      const { sala, asiento } = salaConJugadores('Ana');
      sala.irANoche();
      sala.cambiarVida(asiento(0).id, true);
      expect(asiento(0)).toMatchObject({ muerto: false, muertePendiente: true });
      expect(sala.confirmarMuerte(asiento(0).id)).toBe(true);
      expect(asiento(0)).toMatchObject({ muerto: true, muertePendiente: false });
    });

    it('al anunciar la muerte se quita el «Dead» de quien lo mató (y nada más)', () => {
      const { sala, asiento } = salaConJugadores('Ana', 'Bea');
      sala.irANoche();
      for (const a of [asiento(0), asiento(1)]) {
        sala.ponerRecordatorio(a.id, { personaje: 'imp', indice: 0, texto: 'Dead' });
        sala.ponerRecordatorio(a.id, { personaje: 'poisoner', indice: 0, texto: 'Poisoned' });
        sala.cambiarVida(a.id, true);
      }
      alDia(sala);
      sala.confirmarMuerte(asiento(0).id);
      expect(asiento(0).recordatorios.map((r) => r.texto)).toEqual(['Poisoned']);
      // También si se da por muerto con el sudario de la ficha (cambiarVida)
      sala.cambiarVida(asiento(1).id, true);
      expect(asiento(1)).toMatchObject({ muerto: true, muertePendiente: false });
      expect(asiento(1).recordatorios.map((r) => r.texto)).toEqual(['Poisoned']);
    });

    it('al morir o revivir se recupera el voto; el Barquero se lo devuelve a todos', () => {
      const { sala, asiento } = salaConJugadores('Ana', 'Bea');
      alDia(sala);
      sala.cambiarVida(asiento(0).id, true);
      sala.cambiarVida(asiento(1).id, true);
      expect(sala.cambiarVoto(asiento(0).id, true)).toBe(true);
      expect(sala.cambiarVoto(asiento(1).id, true)).toBe(true);
      expect(sala.devolverVotos()).toBe(2);
      sala.cambiarVoto(asiento(0).id, true);
      sala.cambiarVida(asiento(0).id, false);
      expect(asiento(0).votoGastado).toBe(false);
      expect(sala.cambiarVoto(asiento(0).id, true)).toBe(false);
    });
  });

  describe('nominaciones y votaciones', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    /** Cuenta atrás y la aguja por todas las fichas. */
    const votar = (sala: SalaService) => {
      sala.iniciarCuentaAtras(Date.now());
      vi.advanceTimersByTime(SALA_CUENTA_ATRAS_MS);
      vi.advanceTimersByTime(sala.configuracion().segundosPorFicha * 1000 * sala.asientos().length);
    };

    it('hacen falta la mitad de las fichas vivas, redondeando hacia arriba', () => {
      const { sala, asiento } = salaConJugadores('Ana', 'Bea');
      alDia(sala);
      sala.nominar(asiento(0).id, asiento(1).id);
      expect(sala.nominacion()).toMatchObject({ votosNecesarios: 4, votosNecesariosPorDefecto: 4, privada: false });
      sala.cambiarVida(asiento(2).id, true);
      expect(sala.nominacion()?.votosNecesarios).toBe(3);
      sala.elegirVotosNecesarios(1);
      expect(sala.nominacion()).toMatchObject({ votosNecesarios: 1, votosNecesariosPorDefecto: 3 });
    });

    it('vota quien tiene la mano levantada cuando le llega la aguja, y se le baja', () => {
      const { sala, ids, asiento } = salaConJugadores('Ana', 'Bea', 'Ceci');
      alDia(sala);
      sala.nominar(asiento(2).id, asiento(1).id);
      sala.levantarMano(ids[0], true);
      sala.levantarMano(ids[2], true);
      votar(sala);
      const v = sala.nominacion()?.votacion;
      expect(v).toMatchObject({ terminada: true, votos: 2 });
      // La aguja empieza en el asiento siguiente al nominado y acaba en él
      expect(v?.orden[0]).toBe(asiento(2).id);
      expect(v?.orden[v.orden.length - 1]).toBe(asiento(1).id);
      expect(sala.buscar(ids[0])?.manoLevantada).toBe(false);
      expect(sala.votaciones()).toEqual([
        expect.objectContaining({ dia: 1, nomina: 'Ceci', nominado: 'Bea', votantes: ['Ceci', 'Ana'], votos: 2 }),
      ]);
    });

    it('un muerto vota una vez: al votar gasta su voto', () => {
      const { sala, ids, asiento } = salaConJugadores('Ana', 'Bea');
      alDia(sala);
      sala.cambiarVida(asiento(0).id, true);
      sala.nominar(asiento(1).id, asiento(1).id);
      sala.levantarMano(ids[0], true);
      votar(sala);
      expect(sala.nominacion()?.votacion?.votos).toBe(1);
      expect(asiento(0).votoGastado).toBe(true);
      expect(sala.sinVoto(ids[0])).toBe(true);
    });

    it('la siguiente votación tiene que superar a la que más tuvo del día', () => {
      const { sala, ids, asiento } = salaConJugadores('Ana', 'Bea', 'Ceci');
      while (sala.asientos().length > 3) sala.quitarAsiento();
      alDia(sala);
      sala.nominar(asiento(0).id, asiento(1).id);
      expect(sala.nominacion()?.votosNecesarios).toBe(2);
      sala.levantarMano(ids[0], true);
      sala.levantarMano(ids[1], true);
      votar(sala);
      sala.nominar(asiento(1).id, asiento(2).id);
      expect(sala.nominacion()?.votosNecesarios).toBe(3);
    });

    it('al nominar se cierra la anterior y queda apuntada en el registro', () => {
      const { sala, asiento } = salaConJugadores('Ana', 'Bea');
      alDia(sala);
      sala.nominar(asiento(0).id, asiento(1).id);
      sala.nominar(asiento(1).id, asiento(0).id);
      expect(sala.nominacion()).toMatchObject({ desde: asiento(1).id, hasta: asiento(0).id, votacion: null });
      expect(sala.votaciones().map((v) => v.votantes)).toEqual([null, null]);
    });

    it('con el Voudon vivo solo votan él y los muertos, y basta con 1 voto', () => {
      const { sala, ids, asiento } = salaConJugadores('Ana', 'Bea', 'Ceci');
      sala.cambiarPersonaje(asiento(0).id, 'voudon');
      alDia(sala);
      sala.cambiarVida(asiento(2).id, true);
      expect(sala.voudonVivo()).toBe(true);
      expect(sala.sinVoto(ids[0])).toBe(false);
      expect(sala.sinVoto(ids[1])).toBe(true);
      expect(sala.sinVoto(ids[2])).toBe(false);
      sala.nominar(asiento(0).id, asiento(1).id);
      expect(sala.nominacion()?.votosNecesarios).toBe(1);
    });

    it('al nominar se baja la mano de quien no puede votar', () => {
      const { sala, ids, asiento } = salaConJugadores('Ana', 'Bea');
      alDia(sala);
      sala.cambiarVida(asiento(0).id, true);
      sala.cambiarVoto(asiento(0).id, true);
      sala.levantarMano(ids[0], true);
      sala.nominar(asiento(1).id, asiento(1).id);
      expect(sala.buscar(ids[0])?.manoLevantada).toBe(false);
    });

    it('el voto del Burócrata vale 3 y el del Ladrón resta', () => {
      const { sala, ids, asiento } = salaConJugadores('Ana', 'Bea');
      alDia(sala);
      sala.ponerRecordatorio(asiento(0).id, { personaje: 'bureaucrat', indice: 0, texto: '3 Votes' });
      sala.ponerRecordatorio(asiento(1).id, { personaje: 'thief', indice: 0, texto: 'Negative Vote' });
      sala.nominar(asiento(0).id, asiento(1).id);
      sala.levantarMano(ids[0], true);
      sala.levantarMano(ids[1], true);
      votar(sala);
      const v = sala.nominacion()?.votacion;
      expect(v?.votos).toBe(2);
      expect(v?.valores).toEqual({ [asiento(0).id]: 3, [asiento(1).id]: -1 });
    });

    it('con el Organ Grinder vivo y sin «Drunk», la votación es secreta', () => {
      const { sala, asiento } = salaConJugadores('Ana');
      sala.cambiarPersonaje(asiento(0).id, 'organgrinder');
      expect(sala.votacionSecreta()).toBe(true);
      sala.ponerRecordatorio(asiento(0).id, { personaje: 'organgrinder', indice: 1, texto: 'Drunk' });
      expect(sala.votacionSecreta()).toBe(false);
      sala.quitarRecordatorio(asiento(0).id, asiento(0).recordatorios[0].id);
      alDia(sala);
      sala.cambiarVida(asiento(0).id, true);
      expect(sala.votacionSecreta()).toBe(false);
    });

    it('nominar a un viajero es pedir su expulsión: la mitad de la mesa, votos de 1 y, si sale, muere', () => {
      const { sala, ids, asiento } = salaConJugadores('Ana', 'Bea', 'Ceci', 'Dani');
      sala.cambiarPersonaje(asiento(1).id, 'butcher');
      sala.cambiarPersonaje(asiento(2).id, 'organgrinder');
      alDia(sala);
      sala.cambiarVida(asiento(0).id, true);
      sala.cambiarVida(asiento(3).id, true);
      sala.nominar(asiento(0).id, asiento(1).id);
      // 7 asientos, vivos o muertos: hacen falta 4; el Organ Grinder no la esconde
      expect(sala.nominacion()).toMatchObject({ expulsion: true, votosNecesarios: 4, privada: false });
      // Los muertos votan sin gastar su voto
      expect(sala.sinVoto(ids[0])).toBe(false);
      for (const id of ids) sala.levantarMano(id, true);
      votar(sala);
      expect(sala.nominacion()?.votacion?.votos).toBe(4);
      expect(asiento(0).votoGastado).toBe(false);
      expect(asiento(1).muerto).toBe(true);
      expect(sala.votaciones()[0]).toMatchObject({ expulsion: true, nominaAsiento: asiento(0).id, nominadoAsiento: asiento(1).id });
      // No deja récord para las nominaciones del día: la mitad de los 4 vivos, no 5
      sala.nominar(asiento(2).id, asiento(2).id);
      expect(sala.nominacion()?.votosNecesariosPorDefecto).toBe(2);
    });

    it('al nominar se bajan todas las manos', () => {
      const { sala, ids, asiento } = salaConJugadores('Ana', 'Bea');
      alDia(sala);
      sala.levantarMano(ids[0], true);
      sala.nominar(asiento(0).id, asiento(1).id);
      expect(sala.buscar(ids[0])?.manoLevantada).toBe(false);
    });

    it('reiniciar la votación la deja como recién abierta y devuelve el voto a los muertos', () => {
      const { sala, ids, asiento } = salaConJugadores('Ana', 'Bea');
      alDia(sala);
      sala.cambiarVida(asiento(0).id, true);
      // Nominado el último asiento, la aguja empieza por Ana
      sala.nominar(asiento(1).id, asiento(6).id);
      expect(sala.votacionEnMarcha()).toBe(false);
      sala.levantarMano(ids[0], true);
      sala.levantarMano(ids[1], true);
      sala.iniciarCuentaAtras(Date.now());
      expect(sala.votacionEnMarcha()).toBe(true);
      vi.advanceTimersByTime(SALA_CUENTA_ATRAS_MS + sala.configuracion().segundosPorFicha * 1000);
      // La aguja ha pasado por Ana (muerta): ha gastado su voto
      expect(asiento(0).votoGastado).toBe(true);
      expect(sala.votacionEnMarcha()).toBe(true);
      sala.reiniciarVotacion();
      expect(sala.nominacion()).toMatchObject({ cuentaAtrasFin: null, votacion: null });
      expect(asiento(0).votoGastado).toBe(false);
      expect(sala.buscar(ids[1])?.manoLevantada).toBe(false);
      expect(sala.votacionEnMarcha()).toBe(false);
    });
  });

  describe('ejecuciones', () => {
    it('el ejecutado muere y anochece', () => {
      const { sala, asiento } = salaConJugadores('Ana');
      alDia(sala);
      sala.marcar(asiento(0).id, true);
      expect(sala.ejecutar(asiento(0).id)).toEqual({ anochece: true, final: false });
      expect(asiento(0).muerto).toBe(true);
      expect(sala.fase()).toMatchObject({ momento: 'noche', numero: 2 });
    });

    it('con el Carnicero vivo no anochece', () => {
      const { sala, asiento } = salaConJugadores('Ana');
      sala.cambiarPersonaje(asiento(1).id, 'butcher');
      alDia(sala);
      expect(sala.ejecutar(asiento(0).id)).toEqual({ anochece: false, final: false });
      expect(sala.fase().momento).toBe('dia');
    });

    it('si quedan dos vivos, decide el narrador', () => {
      const { sala, asiento } = salaConJugadores('Ana');
      alDia(sala);
      for (const i of [3, 4, 5, 6]) sala.cambiarVida(asiento(i).id, true);
      expect(sala.ejecutar(asiento(0).id)).toEqual({ anochece: false, final: true });
    });

    it('con el Enterrador vivo, el ejecutado lleva su «Die Today» (solo uno en la mesa)', () => {
      const { sala, asiento } = salaConJugadores('Ana');
      sala.cambiarPersonaje(asiento(1).id, 'undertaker');
      alDia(sala);
      sala.ejecutar(asiento(0).id);
      expect(asiento(0).recordatorios.map((r) => r.texto)).toEqual(['Die Today']);
      sala.amanecer();
      sala.ejecutar(asiento(2).id);
      expect(asiento(0).recordatorios).toEqual([]);
      expect(asiento(2).recordatorios.map((r) => r.texto)).toEqual(['Die Today']);
    });
  });

  describe('despertares y señalamientos', () => {
    it('al amanecer se cierran los despertares', () => {
      const { sala, ids, asiento } = salaConJugadores('Ana');
      sala.irANoche();
      expect(sala.despertar(asiento(0).id)).toBeNull();
      sala.enviarDespertar(asiento(0).id, {
        autor: 'narrador',
        ficha: 'entendido',
        tarjeta: null,
        jugadores: [],
        personajes: [],
        texto: null,
        alineamiento: null,
      });
      expect(sala.asientoDespiertoDe(ids[0])).toBe(asiento(0).id);
      sala.amanecer();
      expect(sala.despertares()).toEqual([]);
    });

    it('el jugador no está despierto hasta que el narrador le manda algo', () => {
      const { sala, ids, asiento } = salaConJugadores('Ana');
      sala.irANoche();
      sala.despertar(asiento(0).id);
      expect(sala.hayDespertar(asiento(0).id)).toBe(true);
      expect(sala.asientoDespiertoDe(ids[0])).toBeNull();
    });

    it('si el jugador se levanta, su despertar se cierra', () => {
      const { sala, ids, asiento } = salaConJugadores('Ana');
      sala.irANoche();
      sala.despertar(asiento(0).id);
      sala.levantar(ids[0]);
      expect(sala.hayDespertar(asiento(0).id)).toBe(false);
    });

    it('de noche, el señalamiento solo lo ven el narrador y quien señala (al que se despierta)', () => {
      const { sala, ids, asiento } = salaConJugadores('Ana', 'Bea');
      const { id: narrador } = sala.conectar('s-n', 'c-n', invitado('Nora'), siempreViva);
      sala.cambiarRol(narrador, 'narrador');
      sala.irANoche();
      sala.empezarSenalamiento({ mensaje: '', segundos: null, senaladores: [asiento(0).id], objetivos: [] });
      expect(sala.senalamiento()?.publico).toBe(false);
      expect(sala.veSenalamiento(sala.buscar(narrador)!)).toBe(true);
      expect(sala.veSenalamiento(sala.buscar(ids[0])!)).toBe(true);
      expect(sala.veSenalamiento(sala.buscar(ids[1])!)).toBe(false);
      expect(sala.hayDespertar(asiento(0).id)).toBe(true);
      expect(sala.senalar(ids[1], asiento(0).id)).toBe('No te toca señalar.');
      expect(sala.senalar(ids[0], asiento(1).id)).toBeNull();
      expect(sala.senalamiento()?.senales).toEqual({ [asiento(0).id]: asiento(1).id });
    });

    it('de día el señalamiento es público', () => {
      const { sala, ids } = salaConJugadores('Ana', 'Bea');
      alDia(sala);
      sala.empezarSenalamiento({ mensaje: '¿Quién?', segundos: 10, senaladores: [], objetivos: [] });
      expect(sala.senalamiento()).toMatchObject({ publico: true, senaladores: sala.asientos().map((a) => a.id) });
      expect(sala.veSenalamiento(sala.buscar(ids[1])!)).toBe(true);
    });
  });

  describe('fin de la partida', () => {
    it('al revelar el grimorio se guarda la partida de quien tiene cuenta', () => {
      const sala = new SalaService();
      sala.cambiarGuion(guionDePrueba());
      const { id } = sala.conectar('s1', 'c1', conCuenta('42', 'ana'), siempreViva);
      sala.sentar(id, sala.asientos()[0].id);
      sala.cambiarPersonaje(sala.asientos()[0].id, 'chef');
      const alTerminar = vi.fn();
      const estadisticas = new EstadisticasPartida(alTerminar);
      sala.suscribir((evento) => estadisticas.registrar(evento));
      sala.irANoche();
      sala.empezarRevelacion('bueno');
      expect(alTerminar).toHaveBeenCalledOnce();
      const registro = alTerminar.mock.calls[0][0];
      expect(registro).toMatchObject({ ganador: 'bueno', guion: 'Guion de prueba', dias: 1 });
      expect(registro.jugadores).toEqual([expect.objectContaining({ userId: '42' })]);
      expect(registro.mesa[0]).toMatchObject({ numero: 1, nombre: 'ana', userId: '42', personaje: 'chef', alineamiento: 'bueno' });
    });

    it('sin partida empezada ni nadie con cuenta, no se guarda nada', () => {
      const { sala } = salaConJugadores('Ana');
      const alTerminar = vi.fn();
      const estadisticas = new EstadisticasPartida(alTerminar);
      sala.suscribir((evento) => estadisticas.registrar(evento));
      sala.empezarRevelacion('malvado');
      expect(alTerminar).not.toHaveBeenCalled();
    });

    it('las causas solo se cuentan cuando todo está revelado', () => {
      const { sala } = salaConJugadores('Ana');
      sala.empezarRevelacion('bueno', ['slayer']);
      expect(sala.revelacion()).toMatchObject({ terminada: false, causas: [] });
      sala.revelarTodas();
      expect(sala.revelacion()).toMatchObject({ terminada: true, causas: ['slayer'] });
    });
  });
});
