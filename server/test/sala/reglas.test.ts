import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SALA_CUENTA_ATRAS_MS } from '../../src/services/partida/Nominaciones';
import { SalaDeJuego } from '../../src/services/SalaDeJuego';
import { Reglas } from '../../src/services/partida/reglas';
import type { ContextoReglas, ReglaPersonaje } from '../../src/services/partida/reglas/ReglaPersonaje';
import { guionDePrueba, invitado } from './guionDePrueba';
import { Jugador } from '../../src/services/partida/Jugador';

/** Las reglas de los personajes que cambian la partida, vistas desde fuera (la sala). */

function salaConJugadores(...nombres: string[]) {
  const juego = new SalaDeJuego();
  const { sala, partida } = juego;
  partida.cambiarGuion(guionDePrueba());
  const ids = nombres.map((nombre, i) => {
    const { id } = sala.participantes.conectar(`s-${nombre}`, `c-${nombre}`, invitado(nombre), () => true);
    sala.sentar(id, partida.plaza()[i].id);
    return id;
  });
  const asiento = (i: number) => partida.plaza()[i];
  return { juego, ids, asiento };
}

const alDia = (juego: SalaDeJuego) => {
  const { partida } = juego;
  partida.irANoche();
  partida.amanecer();
};

const textos = ({ partida }: SalaDeJuego, i: number) => partida.plaza()[i].recordatorios.map((r) => r.texto);

describe('reglas de los personajes', () => {
  describe('votando', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const votar = (juego: SalaDeJuego) => {
      const { partida } = juego;
      partida.nominaciones.iniciarCuentaAtras(Date.now());
      vi.advanceTimersByTime(SALA_CUENTA_ATRAS_MS);
      vi.advanceTimersByTime(partida.configuracion.actual().segundosPorFicha * 1000 * partida.plaza().length);
    };

    it('la Banshee muerta con su habilidad vota con las dos manos y sin gastar su voto', () => {
      const { juego, ids, asiento } = salaConJugadores('Ana', 'Bea');
      const { sala, partida } = juego;
      partida.grimorio.cambiarPersonaje(asiento(0).id, 'banshee');
      alDia(juego);
      expect(partida.puedeVotarDoble(ids[0])).toBe(false);
      partida.grimorio.cambiarVida(asiento(0).id, true);
      partida.grimorio.ponerRecordatorio(asiento(0).id, { personaje: 'banshee', indice: 0, texto: 'Has Ability' });
      partida.grimorio.cambiarVoto(asiento(0).id, true);
      expect(partida.puedeVotarDoble(ids[0])).toBe(true);
      expect(partida.sinVoto(ids[0])).toBe(false);
      partida.nominar(asiento(1).id, asiento(1).id);
      sala.participantes.levantarMano(ids[0], true, true);
      votar(juego);
      expect(partida.nominaciones.nominacion()?.votacion?.votos).toBe(2);
      expect(asiento(0).votoGastado).toBe(true);
      partida.grimorio.cambiarVoto(asiento(0).id, false);
      partida.nominar(asiento(1).id, asiento(1).id);
      sala.participantes.levantarMano(ids[0], true);
      votar(juego);
      expect(asiento(0).votoGastado).toBe(false);
    });

    it('con el Voudon vivo, los muertos votan sin gastar su voto', () => {
      const { juego, ids, asiento } = salaConJugadores('Ana', 'Bea');
      const { sala, partida } = juego;
      partida.grimorio.cambiarPersonaje(asiento(2).id, 'voudon');
      alDia(juego);
      partida.grimorio.cambiarVida(asiento(0).id, true);
      partida.nominar(asiento(1).id, asiento(1).id);
      sala.participantes.levantarMano(ids[0], true);
      votar(juego);
      expect(partida.nominaciones.nominacion()?.votacion?.votos).toBe(1);
      expect(asiento(0).votoGastado).toBe(false);
    });

    it('con el Voudon muerto se vota como siempre', () => {
      const { juego, ids, asiento } = salaConJugadores('Ana', 'Bea');
      const { partida } = juego;
      partida.grimorio.cambiarPersonaje(asiento(2).id, 'voudon');
      alDia(juego);
      partida.grimorio.cambiarVida(asiento(2).id, true);
      expect(partida.voudonVivo()).toBe(false);
      expect(partida.sinVoto(ids[1])).toBe(false);
      partida.nominar(asiento(0).id, asiento(1).id);
      expect(partida.nominaciones.nominacion()?.votosNecesarios).toBe(3);
    });

    it('el Voudon se reconoce también por quien es de verdad («Is The …»)', () => {
      const { juego, asiento } = salaConJugadores('Ana');
      const { partida } = juego;
      partida.grimorio.cambiarPersonaje(asiento(0).id, 'apprentice');
      expect(partida.voudonVivo()).toBe(false);
      partida.grimorio.ponerRecordatorio(asiento(0).id, { personaje: 'voudon', indice: 0, texto: 'Is The Voudon' });
      expect(partida.voudonVivo()).toBe(true);
    });
  });

  describe('nominando', () => {
    /** Ana (asiento 0) nomina a la Virgen (asiento 1), de día; Ana lleva `nominador`. */
    const nominaALaVirgen = (nominador: string, preparar?: (sala: SalaDeJuego, asiento: (i: number) => Jugador) => void) => {
      const { juego, asiento } = salaConJugadores('Ana', 'Bea');
      const { partida } = juego;
      partida.grimorio.cambiarPersonaje(asiento(0).id, nominador);
      partida.grimorio.cambiarPersonaje(asiento(1).id, 'virgin');
      preparar?.(juego, asiento);
      alDia(juego);
      const ejecucion = partida.nominar(asiento(0).id, asiento(1).id);
      return { juego, asiento, ejecucion };
    };

    it('la primera vez que nominan a la Virgen, un aldeano que la nomina se ejecuta al momento', () => {
      const { juego, asiento, ejecucion } = nominaALaVirgen('chef');
      const { partida } = juego;
      expect(ejecucion).toEqual({ anochece: true, final: false });
      expect(asiento(0).muerto).toBe(true);
      expect(textos(juego, 1)).toEqual(['No Ability']);
      expect(partida.nominaciones.nominacion()).toBeNull();
      expect(partida.fases.actual().momento).toBe('noche');
    });

    it('si quien nomina no es aldeano de verdad (el Borracho), pierde la habilidad sin ejecutar', () => {
      const { juego, asiento, ejecucion } = nominaALaVirgen('chef', (s, a) => s.partida.grimorio.ponerRecordatorio(a(0).id, { personaje: 'drunk', indice: 0, texto: 'Is The Drunk' }));
      const { partida } = juego;
      expect(ejecucion).toBeNull();
      expect(asiento(0).muerto).toBe(false);
      expect(textos(juego, 1)).toEqual(['No Ability']);
      expect(partida.nominaciones.nominacion()).not.toBeNull();
    });

    it('a un forastero (el Santo), un esbirro o un demonio que la nomina no lo ejecuta: solo a los aldeanos', () => {
      for (const nominador of ['saint', 'poisoner', 'imp']) {
        const { juego, asiento, ejecucion } = nominaALaVirgen(nominador);
        const { partida } = juego;
        expect(ejecucion).toBeNull();
        expect(asiento(0).muerto).toBe(false);
        expect(partida.nominaciones.nominacion()).not.toBeNull();
      }
    });

    it('envenenada o siendo el Borracho, la pierde sin ejecutar', () => {
      const envenenada = nominaALaVirgen('chef', (s, a) => s.partida.grimorio.ponerRecordatorio(a(1).id, { personaje: 'poisoner', indice: 0, texto: 'Poisoned' }));
      expect(envenenada.ejecucion).toBeNull();
      expect(textos(envenenada.juego, 1)).toEqual(['Poisoned', 'No Ability']);
      const borracha = nominaALaVirgen('chef', (s, a) => s.partida.grimorio.ponerRecordatorio(a(1).id, { personaje: 'drunk', indice: 0, texto: 'Is The Drunk' }));
      expect(borracha.ejecucion).toBeNull();
    });

    it('si nomina un Espía sano, antes el narrador dice si registra como aldeano (sin nominar hasta entonces)', () => {
      const { juego, asiento, ejecucion } = nominaALaVirgen('spy');
      const { partida } = juego;
      expect(ejecucion).toEqual({ pregunta: 'comoAldeano' });
      expect(partida.nominaciones.nominacion()).toBeNull();
      expect(textos(juego, 1)).toEqual([]);
      expect(partida.nominar(asiento(0).id, asiento(1).id, { comoAldeano: true })).toEqual({ anochece: true, final: false });
      expect(asiento(0).muerto).toBe(true);
      expect(textos(juego, 1)).toEqual(['No Ability']);
    });

    it('si el Espía no registra como aldeano, o está envenenado, la Virgen la pierde sin ejecutar', () => {
      const noRegistra = nominaALaVirgen('spy');
      const { partida } = noRegistra.juego;
      expect(partida.nominar(noRegistra.asiento(0).id, noRegistra.asiento(1).id, { comoAldeano: false })).toBeNull();
      expect(partida.nominaciones.nominacion()).not.toBeNull();
      expect(textos(noRegistra.juego, 1)).toEqual(['No Ability']);
      const envenenado = nominaALaVirgen('spy', (s, a) => s.partida.grimorio.ponerRecordatorio(a(0).id, { personaje: 'poisoner', indice: 0, texto: 'Poisoned' }));
      expect(envenenado.ejecucion).toBeNull();
    });

    it('la segunda vez ya no pasa nada', () => {
      const { juego, asiento } = nominaALaVirgen('poisoner');
      const { partida } = juego;
      partida.nominaciones.cerrarNominacion();
      partida.grimorio.cambiarPersonaje(asiento(0).id, 'chef');
      expect(partida.nominar(asiento(0).id, asiento(1).id)).toBeNull();
      expect(asiento(0).muerto).toBe(false);
    });
  });

  describe('ejecutando', () => {
    it('con el Caníbal vivo, el ejecutado lleva su «Lunch»', () => {
      const { juego, asiento } = salaConJugadores('Ana');
      const { partida } = juego;
      partida.grimorio.cambiarPersonaje(asiento(1).id, 'cannibal');
      alDia(juego);
      partida.ejecutar(asiento(0).id);
      expect(textos(juego, 0)).toEqual(['Lunch']);
    });

    it('el ejecutado no se pone su propio recordatorio', () => {
      const { juego, asiento } = salaConJugadores('Ana');
      const { partida } = juego;
      partida.grimorio.cambiarPersonaje(asiento(0).id, 'undertaker');
      alDia(juego);
      partida.ejecutar(asiento(0).id);
      expect(textos(juego, 0)).toEqual([]);
    });

    it('con el Leviatán vivo, solo los buenos ejecutados llevan su recordatorio, y se acumulan', () => {
      const { juego, asiento } = salaConJugadores('Ana');
      const { partida } = juego;
      partida.grimorio.cambiarPersonaje(asiento(6).id, 'leviathan');
      partida.grimorio.cambiarPersonaje(asiento(0).id, 'chef');
      partida.grimorio.cambiarPersonaje(asiento(1).id, 'poisoner');
      partida.grimorio.cambiarPersonaje(asiento(2).id, 'empath');
      alDia(juego);
      partida.ejecutar(asiento(0).id);
      partida.amanecer();
      partida.ejecutar(asiento(1).id);
      partida.amanecer();
      partida.ejecutar(asiento(2).id);
      expect([textos(juego, 0), textos(juego, 1), textos(juego, 2)]).toEqual([['Good Player Executed'], [], ['Good Player Executed']]);
    });

    it('con el Carnicero muerto, anochece', () => {
      const { juego, asiento } = salaConJugadores('Ana');
      const { partida } = juego;
      partida.grimorio.cambiarPersonaje(asiento(1).id, 'butcher');
      alDia(juego);
      partida.grimorio.cambiarVida(asiento(1).id, true);
      expect(partida.ejecutar(asiento(0).id)?.anochece).toBe(true);
    });
  });

  describe('conversando', () => {
    it('con la Institutriz viva, solo con los vecinos', () => {
      const { juego, asiento } = salaConJugadores('Ana');
      const { partida } = juego;
      expect(partida.institutrizViva()).toBe(false);
      partida.grimorio.cambiarPersonaje(asiento(3).id, 'matron');
      expect(partida.institutrizViva()).toBe(true);
      alDia(juego);
      partida.grimorio.cambiarVida(asiento(3).id, true);
      expect(partida.institutrizViva()).toBe(false);
    });
  });

  describe('repartiendo', () => {
    it('con el Revolutionary, sus dos asientos reciben personajes del mismo alineamiento', () => {
      const bolsa = ['washerwoman', 'librarian', 'investigator', 'chef', 'empath', 'poisoner', 'imp'];
      const buenos = new Set(bolsa.slice(0, 5));
      for (let vez = 0; vez < 40; vez++) {
        const { juego, asiento } = salaConJugadores();
        const { partida } = juego;
        bolsa.forEach((id) => partida.reparto.bolsa.alternar(id));
        partida.grimorio.ponerRecordatorio(asiento(1).id, { personaje: 'revolutionary', indice: 0, texto: 'Used' });
        partida.grimorio.ponerRecordatorio(asiento(4).id, { personaje: 'revolutionary', indice: 0, texto: 'Used' });
        partida.reparto.repartir();
        expect(buenos.has(asiento(1).personaje!)).toBe(buenos.has(asiento(4).personaje!));
        expect(asiento(1).personaje).not.toBe(asiento(4).personaje);
      }
    });
  });

  describe("Lil' Monsta", () => {
    /** 7 asientos, sin demonio y con dos esbirros (toca uno: el otro hace de demonio). */
    function partidaLilMonsta() {
      const p = salaConJugadores('Ana', 'Bea', 'Ceci');
      const { partida } = p.juego;
      partida.grimorio.cambiarPersonaje(p.asiento(0).id, 'poisoner');
      partida.grimorio.cambiarPersonaje(p.asiento(1).id, 'organgrinder');
      return p;
    }

    it('se puede empezar de noche, sin demonio y con un esbirro de más', () => {
      const { juego, asiento } = partidaLilMonsta();
      const { partida } = juego;
      expect(partida.esbirrosLilmonsta()).toBeNull();
      partida.irANoche();
      expect(partida.esbirrosLilmonsta()).toEqual([asiento(0).id, asiento(1).id]);
      partida.grimorio.cambiarPersonaje(asiento(5).id, 'imp');
      expect(partida.esbirrosLilmonsta()).toBeNull();
    });

    it('cuando los esbirros coinciden, ese lo cuida: se congela y lleva su «Is The Demon»', () => {
      const { juego, ids, asiento } = partidaLilMonsta();
      const { partida } = juego;
      partida.irANoche();
      partida.grimorio.ponerRecordatorio(asiento(6).id, { personaje: 'lilmonsta', indice: 0, texto: 'Is The Demon' });
      partida.empezarSenalamiento({ tipo: 'lilmonsta', mensaje: '', segundos: null, senaladores: partida.esbirrosLilmonsta()!, objetivos: [] });
      expect(partida.senalar(ids[0], asiento(2).id)).toBeNull();
      expect(partida.senalamientos.senalamiento()?.congelado).toBe(false);
      expect(partida.senalar(ids[1], asiento(2).id)).toBeNull();
      expect(partida.senalamientos.senalamiento()?.congelado).toBe(true);
      expect(textos(juego, 2)).toEqual(['Is The Demon']);
      expect(textos(juego, 6)).toEqual([]);
    });

    it('si no coinciden, sigue abierto', () => {
      const { juego, ids, asiento } = partidaLilMonsta();
      const { partida } = juego;
      partida.irANoche();
      partida.empezarSenalamiento({ tipo: 'lilmonsta', mensaje: '', segundos: null, senaladores: partida.esbirrosLilmonsta()!, objetivos: [] });
      partida.senalar(ids[0], asiento(2).id);
      partida.senalar(ids[1], asiento(3).id);
      expect(partida.senalamientos.senalamiento()?.congelado).toBe(false);
      expect(partida.plaza().some((a) => a.recordatorios.length > 0)).toBe(false);
    });
  });
});

describe('Reglas (cómo se combinan)', () => {
  const asiento = (cambios: Partial<Pick<Jugador, 'muerto' | 'votoGastado' | 'personaje' | 'recordatorios'>> = {}): Jugador =>
    Object.assign(new Jugador(), cambios);
  const ctx: ContextoReglas = { plaza: () => [], identidad: (a) => a.personaje, alineamiento: () => null, personaje: () => undefined };

  it('sin reglas: vota quien no es un muerto sin voto, y hace falta la mitad', () => {
    const reglas = new Reglas(ctx, []);
    expect(reglas.puedeVotar(asiento())).toBe(true);
    expect(reglas.puedeVotar(asiento({ muerto: true, votoGastado: true }))).toBe(false);
    expect(reglas.mayoria(7)).toBe(4);
    expect(reglas.valorDelVoto(asiento(), false)).toBe(1);
    expect(reglas.anocheceTrasEjecutar()).toBe(true);
  });

  it('decide la primera regla que responde; los multiplicadores se combinan', () => {
    const nadie: ReglaPersonaje = { personaje: 'nadie', puedeVotar: () => false, multiplicaVoto: () => 3 };
    const todos: ReglaPersonaje = { personaje: 'todos', puedeVotar: () => true, multiplicaVoto: () => -2 };
    expect(new Reglas(ctx, [nadie, todos]).puedeVotar(asiento())).toBe(false);
    expect(new Reglas(ctx, [todos, nadie]).puedeVotar(asiento())).toBe(true);
    expect(new Reglas(ctx, [nadie, todos]).valorDelVoto(asiento(), false)).toBe(-6);
  });

  it('un personaje nuevo es una regla más, sin tocar la sala', () => {
    const verdugo: ReglaPersonaje = {
      personaje: 'verdugo',
      alEjecutar: () => ({ texto: 'Ajusticiado', unico: true }),
      impideAnochecer: () => true,
    };
    const reglas = new Reglas(ctx, [verdugo]);
    expect(reglas.recordatoriosAlEjecutar(asiento())).toEqual([{ personaje: 'verdugo', texto: 'Ajusticiado', unico: true }]);
    expect(reglas.anocheceTrasEjecutar()).toBe(false);
  });
});
