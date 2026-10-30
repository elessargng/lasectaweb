import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EstadisticasPartida } from '../../src/services/estadisticas/EstadisticasPartida';
import { SALA_GRACIA_MS } from '../../src/services/sala/Participantes';
import { SALA_CUENTA_ATRAS_MS } from '../../src/services/partida/Nominaciones';
import { SalaDeJuego } from '../../src/services/SalaDeJuego';
import { BOLSA_DE_SIETE, conCuenta, guionDePrueba, invitado } from './guionDePrueba';
import { identidadDe } from '../../src/services/partida/Grimorio';

/**
 * Tests de caracterización: fijan cómo se comporta hoy la sala, para poder
 * partir SalaDeJuego sin cambiar lo que hace. Si uno falla tras un refactor, o
 * se ha roto algo o el cambio de comportamiento era a propósito (y el test se cambia).
 */

const siempreViva = () => true;

/** Una sala con guion y los jugadores dados sentados en los primeros asientos, en orden. */
function salaConJugadores(...nombres: string[]) {
  const juego = new SalaDeJuego();
  const { sala, partida } = juego;
  partida.cambiarGuion(guionDePrueba());
  const ids = nombres.map((nombre, i) => {
    const { id } = sala.participantes.conectar(`socket-${nombre}`, `cliente-${nombre}`, invitado(nombre), siempreViva);
    expect(sala.sentar(id, partida.mesa()[i].id)).toBeNull();
    return id;
  });
  const asiento = (i: number) => partida.mesa()[i];
  return { juego, ids, asiento };
}

/** Pasa al día 1 (noche 1 y amanecer). */
function alDia(juego: SalaDeJuego) {
  const { partida } = juego;
  partida.irANoche();
  partida.amanecer();
}

describe('SalaDeJuego', () => {
  describe('una sala nueva', () => {
    it('empieza en la preparación, con 7 asientos libres y sin nadie', () => {
      const juego = new SalaDeJuego();
      const { sala, partida } = juego;
      expect(partida.fases.actual()).toEqual({ momento: 'preparacion', numero: 0, reinicios: 0 });
      expect(partida.mesa()).toHaveLength(7);
      expect(partida.mesa().every((a) => a.ocupante === null && !a.muerto && a.personaje === null)).toBe(true);
      expect(sala.participantes.participantes()).toEqual([]);
      expect(sala.participantes.hayNarrador()).toBe(false);
      expect(partida.guion.actual()).toBeNull();
    });
  });

  describe('conexiones', () => {
    it('quien entra es visitante', () => {
      const juego = new SalaDeJuego();
      const { sala } = juego;
      const { id } = sala.participantes.conectar('s1', 'c1', invitado('Ana'), siempreViva);
      expect(sala.participantes.buscar(id)).toMatchObject({ nombre: 'Ana', rol: 'visitante', persona: { tipo: 'invitado' }, conectado: true });
    });

    it('una cuenta que entra otra vez retoma su sitio y echa a la conexión anterior', () => {
      const juego = new SalaDeJuego();
      const { sala, partida } = juego;
      const primera = sala.participantes.conectar('s1', 'c1', conCuenta('42', 'ana'), siempreViva);
      sala.sentar(primera.id, partida.mesa()[0].id);
      const segunda = sala.participantes.conectar('s2', 'c2', conCuenta('42', 'ana'), siempreViva);
      expect(segunda.id).toBe(primera.id);
      expect(segunda.expulsar).toBe('s1');
      expect(sala.participantes.buscar(primera.id)?.rol).toBe('jugador');
      expect(sala.participantes.participantes()).toHaveLength(1);
    });

    it('un invitado que vuelve con su id de cliente tras perder la conexión retoma su sitio', () => {
      const juego = new SalaDeJuego();
      const { sala } = juego;
      const antes = sala.participantes.conectar('s1', 'c1', invitado('Ana'), siempreViva);
      const despues = sala.participantes.conectar('s2', 'c1', invitado('Ana'), () => false);
      expect(despues.id).toBe(antes.id);
    });

    it('un invitado con otro id de cliente entra como uno nuevo', () => {
      const juego = new SalaDeJuego();
      const { sala } = juego;
      const a = sala.participantes.conectar('s1', 'c1', invitado('Ana'), siempreViva);
      const b = sala.participantes.conectar('s2', 'c2', invitado('Bea'), siempreViva);
      expect(b.id).not.toBe(a.id);
      expect(sala.participantes.participantes()).toHaveLength(2);
    });

    describe('con el tiempo parado', () => {
      beforeEach(() => vi.useFakeTimers());
      afterEach(() => vi.useRealTimers());

      it('al perder la conexión se le guarda el sitio un rato y después sale', () => {
        const juego = new SalaDeJuego();
        const { sala } = juego;
        const { clave, id } = sala.participantes.conectar('s1', 'c1', invitado('Ana'), siempreViva);
        const alExpulsar = vi.fn();
        sala.participantes.desconectar(clave, 's1', alExpulsar);
        expect(sala.participantes.participantes()[0]).toMatchObject({ id, conectado: false });
        vi.advanceTimersByTime(SALA_GRACIA_MS - 1);
        expect(sala.participantes.buscar(id)).toBeDefined();
        vi.advanceTimersByTime(1);
        expect(sala.participantes.buscar(id)).toBeUndefined();
        expect(alExpulsar).toHaveBeenCalledOnce();
      });
    });

    it('quien sale a propósito se va enseguida', () => {
      const juego = new SalaDeJuego();
      const { sala } = juego;
      const { clave, id } = sala.participantes.conectar('s1', 'c1', invitado('Ana'), siempreViva);
      sala.participantes.salir(clave, 's1');
      expect(sala.participantes.buscar(id)).toBeUndefined();
    });

    it('un invitado no puede usar un nombre que ya tiene otro (sin distinguir mayúsculas)', () => {
      const juego = new SalaDeJuego();
      const { sala } = juego;
      sala.participantes.conectar('s1', 'c1', invitado('Ana'), siempreViva);
      expect(sala.participantes.nombreLibreParaInvitado('ANA', 'c2', siempreViva)).toBe(false);
      expect(sala.participantes.nombreLibreParaInvitado('Bea', 'c2', siempreViva)).toBe(true);
    });

    it('con cuenta y menos de 10 partidas es novato', () => {
      const juego = new SalaDeJuego();
      const { sala } = juego;
      const { id } = sala.participantes.conectar('s1', 'c1', conCuenta('7', 'nuevo', 3), siempreViva);
      expect(sala.participantes.buscar(id)?.persona).toEqual({ tipo: 'usuario', usuarioId: '7', novato: true });
      sala.participantes.cambiarPartidasJugadas('7', 10);
      expect(sala.participantes.buscar(id)?.persona).toEqual({ tipo: 'usuario', usuarioId: '7', novato: false });
    });
  });

  describe('acceso al grimorio', () => {
    const acceso = ({ partida }: SalaDeJuego, id: string) => partida.acceso.de(id);

    it('concedido, se recupera al salir y volver (invitado, con el mismo navegador)', () => {
      const juego = new SalaDeJuego();
      const { sala, partida } = juego;
      const { clave, id } = sala.participantes.conectar('s1', 'c1', invitado('Vera'), siempreViva);
      partida.acceso.cambiar(id, 'concedido');
      sala.participantes.salir(clave, 's1');
      const vuelta = sala.participantes.conectar('s2', 'c1', invitado('Vera'), siempreViva);
      expect(vuelta.id).not.toBe(id);
      expect(acceso(juego, vuelta.id)).toBe('concedido');
    });

    it('concedido, se recupera al volver con la misma cuenta', () => {
      const juego = new SalaDeJuego();
      const { sala, partida } = juego;
      const { clave, id } = sala.participantes.conectar('s1', 'c1', conCuenta('9', 'vera'), siempreViva);
      partida.acceso.cambiar(id, 'concedido');
      sala.participantes.salir(clave, 's1');
      expect(acceso(juego, sala.participantes.conectar('s2', 'c2', conCuenta('9', 'vera'), siempreViva).id)).toBe('concedido');
    });

    it('solicitado, se pierde al salir', () => {
      const juego = new SalaDeJuego();
      const { sala, partida } = juego;
      const { clave, id } = sala.participantes.conectar('s1', 'c1', invitado('Vera'), siempreViva);
      partida.acceso.cambiar(id, 'solicitado');
      expect(acceso(juego, id)).toBe('solicitado');
      sala.participantes.salir(clave, 's1');
      expect(acceso(juego, sala.participantes.conectar('s2', 'c1', invitado('Vera'), siempreViva).id)).toBe('ninguno');
    });

    it('se pierde al cambiar de papel (al sentarse) y no vuelve al levantarse', () => {
      const juego = new SalaDeJuego();
      const { sala, partida } = juego;
      const { id } = sala.participantes.conectar('s1', 'c1', invitado('Vera'), siempreViva);
      partida.acceso.cambiar(id, 'concedido');
      sala.sentar(id, partida.mesa()[0].id);
      expect(acceso(juego, id)).toBe('ninguno');
      sala.levantar(id);
      expect(acceso(juego, id)).toBe('ninguno');
    });

    it('expulsado por un narrador, al volver no lo recupera', () => {
      const juego = new SalaDeJuego();
      const { sala, partida } = juego;
      const { id } = sala.participantes.conectar('s1', 'c1', invitado('Vera'), siempreViva);
      partida.acceso.cambiar(id, 'concedido');
      sala.participantes.expulsar(id);
      expect(acceso(juego, sala.participantes.conectar('s2', 'c1', invitado('Vera'), siempreViva).id)).toBe('ninguno');
    });

    it('otra partida: lo pierde quien lo tenía (también quien había salido); lo solicitado sigue', () => {
      const juego = new SalaDeJuego();
      const { sala, partida } = juego;
      const vera = sala.participantes.conectar('s1', 'c1', invitado('Vera'), siempreViva);
      const { id: luis } = sala.participantes.conectar('s2', 'c2', invitado('Luis'), siempreViva);
      const { id: eva } = sala.participantes.conectar('s3', 'c3', invitado('Eva'), siempreViva);
      partida.acceso.cambiar(vera.id, 'concedido');
      partida.acceso.cambiar(luis, 'concedido');
      partida.acceso.cambiar(eva, 'solicitado');
      sala.participantes.salir(vera.clave, 's1');
      partida.limpiarGrimorio();
      expect(acceso(juego, luis)).toBe('ninguno');
      expect(acceso(juego, eva)).toBe('solicitado');
      expect(acceso(juego, sala.participantes.conectar('s4', 'c1', invitado('Vera'), siempreViva).id)).toBe('ninguno');
    });
  });

  describe('la mesa', () => {
    it('al sentarse pasa a jugador; al levantarse, a visitante', () => {
      const { juego, ids, asiento } = salaConJugadores('Ana');
      const { sala } = juego;
      expect(sala.participantes.buscar(ids[0])?.rol).toBe('jugador');
      expect(asiento(0).ocupante).toBe(ids[0]);
      sala.levantar(ids[0]);
      expect(sala.participantes.buscar(ids[0])?.rol).toBe('visitante');
      expect(asiento(0).ocupante).toBeNull();
    });

    it('no se puede sentar en un asiento ocupado ni en uno que no existe', () => {
      const { juego, asiento } = salaConJugadores('Ana');
      const { sala } = juego;
      const { id } = sala.participantes.conectar('s2', 'c2', invitado('Bea'), siempreViva);
      expect(sala.sentar(id, asiento(0).id)).toBe('Ese asiento ya está ocupado.');
      expect(sala.sentar(id, 'no-existe')).toBe('Ese asiento ya no existe.');
    });

    it('quien deja de ser jugador libera su asiento', () => {
      const { juego, ids, asiento } = salaConJugadores('Ana');
      const { sala } = juego;
      sala.participantes.cambiarRol(ids[0], 'narrador');
      expect(asiento(0).ocupante).toBeNull();
    });

    it('al quitar el último asiento, quien estaba sentado vuelve a visitante', () => {
      const juego = new SalaDeJuego();
      const { sala, partida } = juego;
      const { id } = sala.participantes.conectar('s1', 'c1', invitado('Ana'), siempreViva);
      sala.sentar(id, partida.mesa()[6].id);
      sala.quitarAsiento();
      expect(partida.mesa()).toHaveLength(6);
      expect(sala.participantes.buscar(id)?.rol).toBe('visitante');
    });

    it('al cambiar de asiento, el jugador se lleva su ficha', () => {
      const { juego, ids, asiento } = salaConJugadores('Ana');
      const { sala, partida } = juego;
      partida.grimorio.cambiarPersonaje(asiento(0).id, 'chef');
      partida.grimorio.cambiarVida(asiento(0).id, true);
      expect(sala.moverOcupante(asiento(0).id, asiento(3).id)).toBeNull();
      expect(asiento(3)).toMatchObject({ ocupante: ids[0], personaje: 'chef', muerto: true });
      expect(asiento(0)).toMatchObject({ ocupante: null, personaje: null, muerto: false });
    });

    it('al mezclar los asientos, cada jugador sigue con su ficha', () => {
      const { juego, ids } = salaConJugadores('Ana', 'Bea', 'Ceci');
      const { sala, partida } = juego;
      const personajes = ['chef', 'empath', 'imp'];
      ids.forEach((_, i) => partida.grimorio.cambiarPersonaje(partida.mesa()[i].id, personajes[i]));
      expect(sala.mezclar()).toBe(3);
      ids.forEach((id, i) => expect(partida.asientoDe(id)?.personaje).toBe(personajes[i]));
    });

    it('dos jugadores son vecinos si no hay nadie sentado entre ellos (los libres se saltan)', () => {
      const juego = new SalaDeJuego();
      const { sala, partida } = juego;
      const [a, b, c] = ['Ana', 'Bea', 'Ceci'].map((n) => sala.participantes.conectar(`s-${n}`, `c-${n}`, invitado(n), siempreViva).id);
      sala.sentar(a, partida.mesa()[0].id);
      sala.sentar(b, partida.mesa()[3].id);
      sala.sentar(c, partida.mesa()[5].id);
      expect(sala.sonVecinos(a, b)).toBe(true);
      expect(sala.sonVecinos(a, c)).toBe(true);
      expect(sala.sonVecinos(b, c)).toBe(true);
    });
  });

  describe('fichas, bolsa y reparto', () => {
    it('con 7 asientos, el reparto es de 5 aldeanos, 0 forasteros, 1 esbirro y 1 demonio', () => {
      const juego = new SalaDeJuego();
      const { partida } = juego;
      partida.cambiarGuion(guionDePrueba());
      expect(partida.reparto.distribucion()).toEqual({ jugadores: 7, jugadoresVivos: 7, viajeros: 0, viajerosVivos: 0, aldeanos: 5, forasteros: 0, esbirros: 1, demonios: 1 });
    });

    it('un viajero puesto a mano no cuenta para el reparto ni para la bolsa', () => {
      const juego = new SalaDeJuego();
      const { partida } = juego;
      partida.cambiarGuion(guionDePrueba());
      partida.grimorio.cambiarPersonaje(partida.mesa()[0].id, 'voudon');
      expect(partida.reparto.distribucion()).toMatchObject({ jugadores: 6, viajeros: 1, aldeanos: 3, forasteros: 1 });
      expect(partida.reparto.fichasParaRepartir()).toBe(6);
    });

    it('repartir la bolsa da un personaje de la bolsa a cada asiento y la bolsa se queda igual', () => {
      const juego = new SalaDeJuego();
      const { partida } = juego;
      partida.cambiarGuion(guionDePrueba());
      BOLSA_DE_SIETE.forEach((id) => partida.reparto.bolsa.alternar(id));
      partida.reparto.repartir();
      const repartidos = partida.mesa().map((a) => a.personaje);
      expect([...repartidos].sort()).toEqual([...BOLSA_DE_SIETE].sort());
      expect(partida.mesa().every((a) => a.alineamiento === null)).toBe(true);
      expect(partida.reparto.bolsa.bolsa()).toEqual(BOLSA_DE_SIETE);
    });

    it('meter dos veces un personaje en la bolsa lo saca', () => {
      const juego = new SalaDeJuego();
      const { partida } = juego;
      partida.reparto.bolsa.alternar('chef');
      partida.reparto.bolsa.alternar('chef');
      expect(partida.reparto.bolsa.bolsa()).toEqual([]);
    });

    it('el jugador ve lo que se le entregó, no lo que el narrador cambia después', () => {
      const { juego, asiento } = salaConJugadores('Ana');
      const { partida } = juego;
      partida.grimorio.cambiarPersonaje(asiento(0).id, 'chef');
      expect(partida.entregas.fichaEntregada(asiento(0).id)).toEqual({ personaje: null, alineamiento: null });
      partida.entregas.entregarFichas();
      partida.grimorio.cambiarPersonaje(asiento(0).id, 'imp');
      expect(partida.entregas.fichaEntregada(asiento(0).id)).toEqual({ personaje: 'chef', alineamiento: null });
      // «Tú eres»: se entera del cambio
      partida.entregas.comunicarFicha(asiento(0).id, ['imp'], 'malvado');
      expect(partida.entregas.fichaEntregada(asiento(0).id)).toEqual({ personaje: 'imp', alineamiento: 'malvado' });
    });

    it('quien es de verdad: el de su «Is The …» o, sin él, el de su ficha', () => {
      const { juego, asiento } = salaConJugadores('Ana');
      const { partida } = juego;
      partida.grimorio.cambiarPersonaje(asiento(0).id, 'chef');
      expect(identidadDe(asiento(0))).toBe('chef');
      partida.grimorio.ponerRecordatorio(asiento(0).id, { personaje: 'drunk', indice: 0, texto: 'Is The Drunk' });
      expect(identidadDe(asiento(0))).toBe('drunk');
    });

    it('el alineamiento: el puesto por el narrador o el de su tipo', () => {
      const { juego, asiento } = salaConJugadores('Ana', 'Bea', 'Ceci');
      const { partida } = juego;
      partida.grimorio.cambiarPersonaje(asiento(0).id, 'chef');
      partida.grimorio.cambiarPersonaje(asiento(1).id, 'imp');
      partida.grimorio.cambiarPersonaje(asiento(2).id, 'voudon');
      expect(partida.grimorio.alineamiento(asiento(0))).toBe('bueno');
      expect(partida.grimorio.alineamiento(asiento(1))).toBe('malvado');
      expect(partida.grimorio.alineamiento(asiento(2))).toBeNull();
      partida.grimorio.cambiarAlineamiento(asiento(0).id, 'malvado');
      expect(partida.grimorio.alineamiento(asiento(0))).toBe('malvado');
    });

    it('cambiar el personaje devuelve el alineamiento al de su tipo', () => {
      const { juego, asiento } = salaConJugadores('Ana');
      const { partida } = juego;
      partida.grimorio.cambiarPersonaje(asiento(0).id, 'chef');
      partida.grimorio.cambiarAlineamiento(asiento(0).id, 'malvado');
      partida.grimorio.cambiarPersonaje(asiento(0).id, 'empath');
      expect(asiento(0).alineamiento).toBeNull();
    });

    it('al poner al Aprendiz en una ficha se le pone solo su «Is The Apprentice»', () => {
      const { juego, asiento } = salaConJugadores('Ana');
      const { partida } = juego;
      partida.grimorio.cambiarPersonaje(asiento(0).id, 'apprentice');
      expect(asiento(0).recordatorios.map((r) => r.texto)).toEqual(['Is The Apprentice']);
      partida.grimorio.cambiarPersonaje(asiento(0).id, 'chef');
      expect(identidadDe(asiento(0))).toBe('apprentice');
    });

    it('los NPCs del guion están en juego desde el principio; los del catálogo, al ponerlos', () => {
      const juego = new SalaDeJuego();
      const { partida } = juego;
      partida.cambiarGuion(guionDePrueba());
      expect(partida.npcs.npcs()).toEqual([]);
      partida.alternarNpc('gardener');
      expect(partida.npcs.activo('gardener')).toBe(true);
    });

    it('el silencio solo vale con el Bibliotecario del Infierno en juego', () => {
      const juego = new SalaDeJuego();
      const { partida } = juego;
      partida.cambiarGuion(guionDePrueba());
      partida.npcs.pedirSilencio(true);
      expect(partida.npcs.silencio()).toBe(false);
      partida.alternarNpc('hellslibrarian');
      expect(partida.npcs.silencio()).toBe(true);
    });

    it('al quitar el Gardener, los personajes retenidos se entregan', () => {
      const { juego, asiento } = salaConJugadores('Ana');
      const { partida } = juego;
      partida.alternarNpc('gardener');
      partida.grimorio.cambiarPersonaje(asiento(0).id, 'chef');
      partida.entregas.retenerFichas(true);
      partida.alternarNpc('gardener');
      expect(partida.entregas.fichasRetenidas()).toBe(false);
      expect(partida.entregas.fichaEntregada(asiento(0).id).personaje).toBe('chef');
    });
  });

  describe('fases', () => {
    it('preparación → noche 1 → día 1 → noche 2', () => {
      const juego = new SalaDeJuego();
      const { partida } = juego;
      partida.irANoche();
      expect(partida.fases.actual()).toEqual({ momento: 'noche', numero: 1, reinicios: 0 });
      partida.amanecer();
      expect(partida.fases.actual()).toEqual({ momento: 'dia', numero: 1, reinicios: 0 });
      partida.irANoche();
      expect(partida.fases.actual()).toEqual({ momento: 'noche', numero: 2, reinicios: 0 });
    });

    it('al anochecer se quita la calavera y se cierra la nominación', () => {
      const { juego, asiento } = salaConJugadores('Ana', 'Bea');
      const { partida } = juego;
      alDia(juego);
      partida.nominar(asiento(0).id, asiento(1).id);
      partida.grimorio.marcar(asiento(1).id, true);
      partida.irANoche();
      expect(partida.grimorio.hayMarca()).toBe(false);
      expect(partida.nominaciones.nominacion()).toBeNull();
    });

    it('la máquina del tiempo vuelve a la fase anterior y devuelve la calavera', () => {
      const { juego, asiento } = salaConJugadores('Ana', 'Bea');
      const { partida } = juego;
      expect(partida.fases.anterior()).toBeNull();
      alDia(juego);
      partida.grimorio.marcar(asiento(1).id, true, 3);
      partida.irANoche();
      expect(partida.volverAtras()).toBe(true);
      expect(partida.fases.actual()).toMatchObject({ momento: 'dia', numero: 1 });
      expect(asiento(1)).toMatchObject({ marcado: true, votosMarca: 3 });
      expect(partida.volverAtras()).toBe(true);
      expect(partida.fases.actual()).toMatchObject({ momento: 'noche', numero: 1 });
      expect(partida.volverAtras()).toBe(true);
      expect(partida.fases.actual()).toMatchObject({ momento: 'preparacion', numero: 0 });
      expect(partida.volverAtras()).toBe(false);
    });

    it('limpiar el grimorio deja la partida como al principio, con los jugadores sentados', () => {
      const { juego, ids, asiento } = salaConJugadores('Ana');
      const { partida } = juego;
      BOLSA_DE_SIETE.forEach((id) => partida.reparto.bolsa.alternar(id));
      partida.reparto.repartir();
      partida.grimorio.ponerRecordatorio(asiento(0).id, { personaje: 'poisoner', indice: 0, texto: 'Poisoned' });
      alDia(juego);
      partida.grimorio.cambiarVida(asiento(0).id, true);
      partida.nominar(asiento(1).id, asiento(2).id);
      const { reinicios } = partida.fases.actual();
      partida.limpiarGrimorio();
      expect(partida.fases.actual()).toEqual({ momento: 'preparacion', numero: 0, reinicios: reinicios + 1 });
      expect(asiento(0)).toMatchObject({ ocupante: ids[0], muerto: false, personaje: null, recordatorios: [] });
      expect(partida.reparto.bolsa.bolsa()).toEqual([]);
      expect(partida.nominaciones.votaciones()).toEqual([]);
      expect(partida.nominaciones.nominacion()).toBeNull();
    });

    it('cambiar de guion limpia el grimorio', () => {
      const { juego, asiento } = salaConJugadores('Ana');
      const { partida } = juego;
      partida.grimorio.cambiarPersonaje(asiento(0).id, 'chef');
      const version = partida.guion.version();
      partida.cambiarGuion(guionDePrueba());
      expect(asiento(0).personaje).toBeNull();
      expect(partida.guion.version()).toBe(version + 1);
    });
  });

  describe('muertes y votos de los muertos', () => {
    it('de día se muere enseguida y se pierde la calavera', () => {
      const { juego, asiento } = salaConJugadores('Ana');
      const { partida } = juego;
      alDia(juego);
      partida.grimorio.marcar(asiento(0).id, true);
      partida.grimorio.cambiarVida(asiento(0).id, true);
      expect(asiento(0)).toMatchObject({ muerto: true, muertePendiente: false, marcado: false });
    });

    it('de noche la muerte queda pendiente hasta que el narrador la anuncia', () => {
      const { juego, asiento } = salaConJugadores('Ana');
      const { partida } = juego;
      partida.irANoche();
      partida.grimorio.cambiarVida(asiento(0).id, true);
      expect(asiento(0)).toMatchObject({ muerto: false, muertePendiente: true });
      expect(partida.grimorio.confirmarMuerte(asiento(0).id)).toBe(true);
      expect(asiento(0)).toMatchObject({ muerto: true, muertePendiente: false });
    });

    it('al anunciar la muerte se quita el «Dead» de quien lo mató (y nada más)', () => {
      const { juego, asiento } = salaConJugadores('Ana', 'Bea');
      const { partida } = juego;
      partida.irANoche();
      for (const a of [asiento(0), asiento(1)]) {
        partida.grimorio.ponerRecordatorio(a.id, { personaje: 'imp', indice: 0, texto: 'Dead' });
        partida.grimorio.ponerRecordatorio(a.id, { personaje: 'poisoner', indice: 0, texto: 'Poisoned' });
        partida.grimorio.cambiarVida(a.id, true);
      }
      alDia(juego);
      partida.grimorio.confirmarMuerte(asiento(0).id);
      expect(asiento(0).recordatorios.map((r) => r.texto)).toEqual(['Poisoned']);
      // También si se da por muerto con el sudario de la ficha (cambiarVida)
      partida.grimorio.cambiarVida(asiento(1).id, true);
      expect(asiento(1)).toMatchObject({ muerto: true, muertePendiente: false });
      expect(asiento(1).recordatorios.map((r) => r.texto)).toEqual(['Poisoned']);
    });

    it('al morir o revivir se recupera el voto; el Barquero se lo devuelve a todos', () => {
      const { juego, asiento } = salaConJugadores('Ana', 'Bea');
      const { partida } = juego;
      alDia(juego);
      partida.grimorio.cambiarVida(asiento(0).id, true);
      partida.grimorio.cambiarVida(asiento(1).id, true);
      expect(partida.grimorio.cambiarVoto(asiento(0).id, true)).toBe(true);
      expect(partida.grimorio.cambiarVoto(asiento(1).id, true)).toBe(true);
      expect(partida.grimorio.devolverVotos()).toBe(2);
      partida.grimorio.cambiarVoto(asiento(0).id, true);
      partida.grimorio.cambiarVida(asiento(0).id, false);
      expect(asiento(0).votoGastado).toBe(false);
      expect(partida.grimorio.cambiarVoto(asiento(0).id, true)).toBe(false);
    });
  });

  describe('nominaciones y votaciones', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    /** Cuenta atrás y la aguja por todas las fichas. */
    const votar = (juego: SalaDeJuego) => {
      const { partida } = juego;
      partida.nominaciones.iniciarCuentaAtras(Date.now());
      vi.advanceTimersByTime(SALA_CUENTA_ATRAS_MS);
      vi.advanceTimersByTime(partida.configuracion.actual().segundosPorFicha * 1000 * partida.mesa().length);
    };

    it('la palabra es de la nominación: al cerrarla o empezar otra, vuelven a hablar todos', () => {
      const { juego, ids, asiento } = salaConJugadores('Ana', 'Bea');
      const { partida } = juego;
      alDia(juego);
      expect(partida.nominaciones.darPalabra(ids[0])).toBe('No hay ninguna nominación.');
      expect(partida.nominaciones.darPalabra(null)).toBeNull();
      partida.nominar(asiento(0).id, asiento(1).id);
      expect(partida.nominaciones.palabra()).toBeNull();
      expect(partida.nominaciones.darPalabra(ids[0])).toBeNull();
      expect(partida.nominaciones.palabra()).toBe(ids[0]);
      partida.nominar(asiento(1).id, asiento(0).id);
      expect(partida.nominaciones.palabra()).toBeNull();
      partida.nominaciones.darPalabra(ids[1]);
      partida.nominaciones.cerrarNominacion();
      expect(partida.nominaciones.palabra()).toBeNull();
    });

    it('al anochecer o al irse el narrador virtual, la palabra vuelve a ser de todos', () => {
      const { juego, ids, asiento } = salaConJugadores('Ana', 'Bea');
      const { partida, narrador } = juego;
      alDia(juego);
      partida.nominar(asiento(0).id, asiento(1).id);
      partida.nominaciones.darPalabra(ids[0]);
      narrador.quitar();
      expect(partida.nominaciones.palabra()).toBeNull();
      partida.nominaciones.darPalabra(ids[0]);
      partida.irANoche();
      expect(partida.nominaciones.palabra()).toBeNull();
    });

    it('hacen falta la mitad de las fichas vivas, redondeando hacia arriba', () => {
      const { juego, asiento } = salaConJugadores('Ana', 'Bea');
      const { partida } = juego;
      alDia(juego);
      partida.nominar(asiento(0).id, asiento(1).id);
      expect(partida.nominaciones.nominacion()).toMatchObject({ votosNecesarios: 4, votosNecesariosPorDefecto: 4, privada: false });
      partida.grimorio.cambiarVida(asiento(2).id, true);
      expect(partida.nominaciones.nominacion()?.votosNecesarios).toBe(3);
      partida.nominaciones.elegirVotosNecesarios(1);
      expect(partida.nominaciones.nominacion()).toMatchObject({ votosNecesarios: 1, votosNecesariosPorDefecto: 3 });
    });

    it('vota quien tiene la mano levantada cuando le llega la aguja, y se le baja', () => {
      const { juego, ids, asiento } = salaConJugadores('Ana', 'Bea', 'Ceci');
      const { sala, partida } = juego;
      alDia(juego);
      partida.nominar(asiento(2).id, asiento(1).id);
      sala.participantes.levantarMano(ids[0], true);
      sala.participantes.levantarMano(ids[2], true);
      votar(juego);
      const v = partida.nominaciones.nominacion()?.votacion;
      expect(v).toMatchObject({ terminada: true, votos: 2 });
      // La aguja empieza en el asiento siguiente al nominado y acaba en él
      expect(v?.orden[0]).toBe(asiento(2).id);
      expect(v?.orden[v.orden.length - 1]).toBe(asiento(1).id);
      expect(sala.participantes.buscar(ids[0])?.manoLevantada).toBe(false);
      expect(partida.nominaciones.votaciones()).toEqual([
        expect.objectContaining({ dia: 1, nomina: 'Ceci', nominado: 'Bea', votantes: ['Ceci', 'Ana'], votos: 2 }),
      ]);
    });

    it('un muerto vota una vez: al votar gasta su voto', () => {
      const { juego, ids, asiento } = salaConJugadores('Ana', 'Bea');
      const { sala, partida } = juego;
      alDia(juego);
      partida.grimorio.cambiarVida(asiento(0).id, true);
      partida.nominar(asiento(1).id, asiento(1).id);
      sala.participantes.levantarMano(ids[0], true);
      votar(juego);
      expect(partida.nominaciones.nominacion()?.votacion?.votos).toBe(1);
      expect(asiento(0).votoGastado).toBe(true);
      expect(partida.sinVoto(ids[0])).toBe(true);
    });

    it('la siguiente votación tiene que superar a la que más tuvo del día', () => {
      const { juego, ids, asiento } = salaConJugadores('Ana', 'Bea', 'Ceci');
      const { sala, partida } = juego;
      while (partida.mesa().length > 3) sala.quitarAsiento();
      alDia(juego);
      partida.nominar(asiento(0).id, asiento(1).id);
      expect(partida.nominaciones.nominacion()?.votosNecesarios).toBe(2);
      sala.participantes.levantarMano(ids[0], true);
      sala.participantes.levantarMano(ids[1], true);
      votar(juego);
      partida.nominar(asiento(1).id, asiento(2).id);
      expect(partida.nominaciones.nominacion()?.votosNecesarios).toBe(3);
    });

    it('al nominar se cierra la anterior y queda apuntada en el registro', () => {
      const { juego, asiento } = salaConJugadores('Ana', 'Bea');
      const { partida } = juego;
      alDia(juego);
      partida.nominar(asiento(0).id, asiento(1).id);
      partida.nominar(asiento(1).id, asiento(0).id);
      expect(partida.nominaciones.nominacion()).toMatchObject({ desde: asiento(1).id, hasta: asiento(0).id, votacion: null });
      expect(partida.nominaciones.votaciones().map((v) => v.votantes)).toEqual([null, null]);
    });

    it('con el Voudon vivo solo votan él y los muertos, y basta con 1 voto', () => {
      const { juego, ids, asiento } = salaConJugadores('Ana', 'Bea', 'Ceci');
      const { partida } = juego;
      partida.grimorio.cambiarPersonaje(asiento(0).id, 'voudon');
      alDia(juego);
      partida.grimorio.cambiarVida(asiento(2).id, true);
      expect(partida.voudonVivo()).toBe(true);
      expect(partida.sinVoto(ids[0])).toBe(false);
      expect(partida.sinVoto(ids[1])).toBe(true);
      expect(partida.sinVoto(ids[2])).toBe(false);
      partida.nominar(asiento(0).id, asiento(1).id);
      expect(partida.nominaciones.nominacion()?.votosNecesarios).toBe(1);
    });

    it('al nominar se baja la mano de quien no puede votar', () => {
      const { juego, ids, asiento } = salaConJugadores('Ana', 'Bea');
      const { sala, partida } = juego;
      alDia(juego);
      partida.grimorio.cambiarVida(asiento(0).id, true);
      partida.grimorio.cambiarVoto(asiento(0).id, true);
      sala.participantes.levantarMano(ids[0], true);
      partida.nominar(asiento(1).id, asiento(1).id);
      expect(sala.participantes.buscar(ids[0])?.manoLevantada).toBe(false);
    });

    it('el voto del Burócrata vale 3 y el del Ladrón resta', () => {
      const { juego, ids, asiento } = salaConJugadores('Ana', 'Bea');
      const { sala, partida } = juego;
      alDia(juego);
      partida.grimorio.ponerRecordatorio(asiento(0).id, { personaje: 'bureaucrat', indice: 0, texto: '3 Votes' });
      partida.grimorio.ponerRecordatorio(asiento(1).id, { personaje: 'thief', indice: 0, texto: 'Negative Vote' });
      partida.nominar(asiento(0).id, asiento(1).id);
      sala.participantes.levantarMano(ids[0], true);
      sala.participantes.levantarMano(ids[1], true);
      votar(juego);
      const v = partida.nominaciones.nominacion()?.votacion;
      expect(v?.votos).toBe(2);
      expect(v?.valores).toEqual({ [asiento(0).id]: 3, [asiento(1).id]: -1 });
    });

    it('con el Organ Grinder vivo y sin «Drunk», la votación es secreta', () => {
      const { juego, asiento } = salaConJugadores('Ana');
      const { partida } = juego;
      partida.grimorio.cambiarPersonaje(asiento(0).id, 'organgrinder');
      expect(partida.votacionSecreta()).toBe(true);
      partida.grimorio.ponerRecordatorio(asiento(0).id, { personaje: 'organgrinder', indice: 1, texto: 'Drunk' });
      expect(partida.votacionSecreta()).toBe(false);
      partida.grimorio.quitarRecordatorio(asiento(0).id, asiento(0).recordatorios[0].id);
      alDia(juego);
      partida.grimorio.cambiarVida(asiento(0).id, true);
      expect(partida.votacionSecreta()).toBe(false);
    });

    it('nominar a un viajero es pedir su expulsión: la mitad de la mesa, votos de 1 y, si sale, muere', () => {
      const { juego, ids, asiento } = salaConJugadores('Ana', 'Bea', 'Ceci', 'Dani');
      const { sala, partida } = juego;
      partida.grimorio.cambiarPersonaje(asiento(1).id, 'butcher');
      partida.grimorio.cambiarPersonaje(asiento(2).id, 'organgrinder');
      alDia(juego);
      partida.grimorio.cambiarVida(asiento(0).id, true);
      partida.grimorio.cambiarVida(asiento(3).id, true);
      partida.nominar(asiento(0).id, asiento(1).id);
      // 7 asientos, vivos o muertos: hacen falta 4; el Organ Grinder no la esconde
      expect(partida.nominaciones.nominacion()).toMatchObject({ expulsion: true, votosNecesarios: 4, privada: false });
      // Los muertos votan sin gastar su voto
      expect(partida.sinVoto(ids[0])).toBe(false);
      for (const id of ids) sala.participantes.levantarMano(id, true);
      votar(juego);
      expect(partida.nominaciones.nominacion()?.votacion?.votos).toBe(4);
      expect(asiento(0).votoGastado).toBe(false);
      expect(asiento(1).muerto).toBe(true);
      expect(partida.nominaciones.votaciones()[0]).toMatchObject({ expulsion: true, nominaAsiento: asiento(0).id, nominadoAsiento: asiento(1).id });
      // No deja récord para las nominaciones del día: la mitad de los 4 vivos, no 5
      partida.nominar(asiento(2).id, asiento(2).id);
      expect(partida.nominaciones.nominacion()?.votosNecesariosPorDefecto).toBe(2);
    });

    it('al nominar se bajan todas las manos', () => {
      const { juego, ids, asiento } = salaConJugadores('Ana', 'Bea');
      const { sala, partida } = juego;
      alDia(juego);
      sala.participantes.levantarMano(ids[0], true);
      partida.nominar(asiento(0).id, asiento(1).id);
      expect(sala.participantes.buscar(ids[0])?.manoLevantada).toBe(false);
    });

    it('reiniciar la votación la deja como recién abierta y devuelve el voto a los muertos', () => {
      const { juego, ids, asiento } = salaConJugadores('Ana', 'Bea');
      const { sala, partida } = juego;
      alDia(juego);
      partida.grimorio.cambiarVida(asiento(0).id, true);
      // Nominado el último asiento, la aguja empieza por Ana
      partida.nominar(asiento(1).id, asiento(6).id);
      expect(partida.nominaciones.votacionEnMarcha()).toBe(false);
      sala.participantes.levantarMano(ids[0], true);
      sala.participantes.levantarMano(ids[1], true);
      partida.nominaciones.iniciarCuentaAtras(Date.now());
      expect(partida.nominaciones.votacionEnMarcha()).toBe(true);
      vi.advanceTimersByTime(SALA_CUENTA_ATRAS_MS + partida.configuracion.actual().segundosPorFicha * 1000);
      // La aguja ha pasado por Ana (muerta): ha gastado su voto
      expect(asiento(0).votoGastado).toBe(true);
      expect(partida.nominaciones.votacionEnMarcha()).toBe(true);
      partida.nominaciones.reiniciarVotacion();
      expect(partida.nominaciones.nominacion()).toMatchObject({ cuentaAtrasFin: null, votacion: null });
      expect(asiento(0).votoGastado).toBe(false);
      expect(sala.participantes.buscar(ids[1])?.manoLevantada).toBe(false);
      expect(partida.nominaciones.votacionEnMarcha()).toBe(false);
    });
  });

  describe('ejecuciones', () => {
    it('el ejecutado muere y anochece', () => {
      const { juego, asiento } = salaConJugadores('Ana');
      const { partida } = juego;
      alDia(juego);
      partida.grimorio.marcar(asiento(0).id, true);
      expect(partida.ejecutar(asiento(0).id)).toEqual({ anochece: true, final: false });
      expect(asiento(0).muerto).toBe(true);
      expect(partida.fases.actual()).toMatchObject({ momento: 'noche', numero: 2 });
    });

    it('con el Carnicero vivo no anochece', () => {
      const { juego, asiento } = salaConJugadores('Ana');
      const { partida } = juego;
      partida.grimorio.cambiarPersonaje(asiento(1).id, 'butcher');
      alDia(juego);
      expect(partida.ejecutar(asiento(0).id)).toEqual({ anochece: false, final: false });
      expect(partida.fases.actual().momento).toBe('dia');
    });

    it('si quedan dos vivos, decide el narrador', () => {
      const { juego, asiento } = salaConJugadores('Ana');
      const { partida } = juego;
      alDia(juego);
      for (const i of [3, 4, 5, 6]) partida.grimorio.cambiarVida(asiento(i).id, true);
      expect(partida.ejecutar(asiento(0).id)).toEqual({ anochece: false, final: true });
    });

    it('con el Enterrador vivo, el ejecutado lleva su «Die Today» (solo uno en la mesa)', () => {
      const { juego, asiento } = salaConJugadores('Ana');
      const { partida } = juego;
      partida.grimorio.cambiarPersonaje(asiento(1).id, 'undertaker');
      alDia(juego);
      partida.ejecutar(asiento(0).id);
      expect(asiento(0).recordatorios.map((r) => r.texto)).toEqual(['Die Today']);
      partida.amanecer();
      partida.ejecutar(asiento(2).id);
      expect(asiento(0).recordatorios).toEqual([]);
      expect(asiento(2).recordatorios.map((r) => r.texto)).toEqual(['Die Today']);
    });
  });

  describe('despertares y señalamientos', () => {
    it('al amanecer se cierran los despertares', () => {
      const { juego, ids, asiento } = salaConJugadores('Ana');
      const { partida } = juego;
      partida.irANoche();
      expect(partida.despertares.despertar(asiento(0).id)).toBeNull();
      partida.despertares.enviar(asiento(0).id, {
        autor: 'narrador',
        ficha: 'entendido',
        tarjeta: null,
        jugadores: [],
        personajes: [],
        texto: null,
        alineamiento: null,
      });
      expect(partida.despertares.asientoDespiertoDe(ids[0])).toBe(asiento(0).id);
      partida.amanecer();
      expect(partida.despertares.despertares()).toEqual([]);
    });

    it('el jugador no está despierto hasta que el narrador le manda algo', () => {
      const { juego, ids, asiento } = salaConJugadores('Ana');
      const { partida } = juego;
      partida.irANoche();
      partida.despertares.despertar(asiento(0).id);
      expect(partida.despertares.hayDespertar(asiento(0).id)).toBe(true);
      expect(partida.despertares.asientoDespiertoDe(ids[0])).toBeNull();
    });

    it('si el jugador se levanta, su despertar se cierra', () => {
      const { juego, ids, asiento } = salaConJugadores('Ana');
      const { sala, partida } = juego;
      partida.irANoche();
      partida.despertares.despertar(asiento(0).id);
      sala.levantar(ids[0]);
      expect(partida.despertares.hayDespertar(asiento(0).id)).toBe(false);
    });

    it('de noche, el señalamiento solo lo ven el narrador y quien señala (al que se despierta)', () => {
      const { juego, ids, asiento } = salaConJugadores('Ana', 'Bea');
      const { sala, partida } = juego;
      const { id: narrador } = sala.participantes.conectar('s-n', 'c-n', invitado('Nora'), siempreViva);
      sala.participantes.cambiarRol(narrador, 'narrador');
      partida.irANoche();
      partida.empezarSenalamiento({ mensaje: '', segundos: null, senaladores: [asiento(0).id], objetivos: [] });
      expect(partida.senalamientos.senalamiento()?.publico).toBe(false);
      expect(partida.senalamientos.veSenalamiento(sala.participantes.buscar(narrador)!)).toBe(true);
      expect(partida.senalamientos.veSenalamiento(sala.participantes.buscar(ids[0])!)).toBe(true);
      expect(partida.senalamientos.veSenalamiento(sala.participantes.buscar(ids[1])!)).toBe(false);
      expect(partida.despertares.hayDespertar(asiento(0).id)).toBe(true);
      expect(partida.senalar(ids[1], asiento(0).id)).toBe('No te toca señalar.');
      expect(partida.senalar(ids[0], asiento(1).id)).toBeNull();
      expect(partida.senalamientos.senalamiento()?.senales).toEqual({ [asiento(0).id]: asiento(1).id });
    });

    it('de día el señalamiento es público', () => {
      const { juego, ids } = salaConJugadores('Ana', 'Bea');
      const { sala, partida } = juego;
      alDia(juego);
      partida.empezarSenalamiento({ mensaje: '¿Quién?', segundos: 10, senaladores: [], objetivos: [] });
      expect(partida.senalamientos.senalamiento()).toMatchObject({ publico: true, senaladores: partida.mesa().map((a) => a.id) });
      expect(partida.senalamientos.veSenalamiento(sala.participantes.buscar(ids[1])!)).toBe(true);
    });
  });

  describe('fin de la partida', () => {
    it('al revelar el grimorio se acaba todo lo que corre: la nominación, el reloj y el señalamiento', () => {
      const { juego } = salaConJugadores('Ana', 'Bea');
      const { partida } = juego;
      alDia(juego);
      const [a, b] = partida.mesa();
      partida.nominar(a.id, b.id);
      partida.reloj.ponerReloj(60, 'Privados');
      partida.empezarSenalamiento({ mensaje: '¿Quién?', segundos: 10, senaladores: [], objetivos: [] });
      partida.empezarRevelacion('bueno');
      expect(partida.nominaciones.nominacion()).toBeNull();
      expect(partida.reloj.reloj()).toBeNull();
      expect(partida.senalamientos.senalamiento()).toBeNull();
    });

    it('al revelar el grimorio se guarda la partida de quien tiene cuenta', () => {
      const juego = new SalaDeJuego();
      const { sala, partida } = juego;
      partida.cambiarGuion(guionDePrueba());
      const { id } = sala.participantes.conectar('s1', 'c1', conCuenta('42', 'ana'), siempreViva);
      sala.sentar(id, partida.mesa()[0].id);
      partida.grimorio.cambiarPersonaje(partida.mesa()[0].id, 'chef');
      const alTerminar = vi.fn();
      const estadisticas = new EstadisticasPartida(alTerminar);
      partida.suscribir((evento) => estadisticas.registrar(evento));
      partida.irANoche();
      partida.empezarRevelacion('bueno');
      expect(alTerminar).toHaveBeenCalledOnce();
      const registro = alTerminar.mock.calls[0][0];
      expect(registro).toMatchObject({ ganador: 'bueno', guion: 'Guion de prueba', dias: 1 });
      expect(registro.jugadores).toEqual([expect.objectContaining({ userId: '42' })]);
      expect(registro.mesa[0]).toMatchObject({ numero: 1, nombre: 'ana', userId: '42', personaje: 'chef', alineamiento: 'bueno' });
    });

    it('sin partida empezada ni nadie con cuenta, no se guarda nada', () => {
      const { juego } = salaConJugadores('Ana');
      const { partida } = juego;
      const alTerminar = vi.fn();
      const estadisticas = new EstadisticasPartida(alTerminar);
      partida.suscribir((evento) => estadisticas.registrar(evento));
      partida.empezarRevelacion('malvado');
      expect(alTerminar).not.toHaveBeenCalled();
    });

    it('las causas solo se cuentan cuando todo está revelado', () => {
      const { juego } = salaConJugadores('Ana');
      const { partida } = juego;
      partida.empezarRevelacion('bueno', ['slayer']);
      expect(partida.revelacion.revelacion()).toMatchObject({ terminada: false, causas: [] });
      partida.revelacion.revelarTodas();
      expect(partida.revelacion.revelacion()).toMatchObject({ terminada: true, causas: ['slayer'] });
    });
  });
});
