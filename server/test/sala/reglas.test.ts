import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SALA_CUENTA_ATRAS_MS } from '../../src/services/partida/Nominaciones';
import { SalaService } from '../../src/services/SalaService';
import { Reglas } from '../../src/services/partida/reglas';
import type { ContextoReglas, ReglaPersonaje } from '../../src/services/partida/reglas/ReglaPersonaje';
import type { SalaAsiento } from '../../src/contrato/sala';
import { guionDePrueba, invitado } from './guionDePrueba';

/** Las reglas de los personajes que cambian la partida, vistas desde fuera (la sala). */

function salaConJugadores(...nombres: string[]) {
  const sala = new SalaService();
  sala.cambiarGuion(guionDePrueba());
  const ids = nombres.map((nombre, i) => {
    const { id } = sala.conectar(`s-${nombre}`, `c-${nombre}`, invitado(nombre), () => true);
    sala.sentar(id, sala.asientos()[i].id);
    return id;
  });
  const asiento = (i: number) => sala.asientos()[i];
  return { sala, ids, asiento };
}

const alDia = (sala: SalaService) => {
  sala.irANoche();
  sala.amanecer();
};

const textos = (sala: SalaService, i: number) => sala.asientos()[i].recordatorios.map((r) => r.texto);

describe('reglas de los personajes', () => {
  describe('votando', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const votar = (sala: SalaService) => {
      sala.iniciarCuentaAtras(Date.now());
      vi.advanceTimersByTime(SALA_CUENTA_ATRAS_MS);
      vi.advanceTimersByTime(sala.configuracion().segundosPorFicha * 1000 * sala.asientos().length);
    };

    it('la Banshee muerta con su habilidad vota con las dos manos y sin gastar su voto', () => {
      const { sala, ids, asiento } = salaConJugadores('Ana', 'Bea');
      sala.cambiarPersonaje(asiento(0).id, 'banshee');
      alDia(sala);
      expect(sala.puedeVotarDoble(ids[0])).toBe(false);
      sala.cambiarVida(asiento(0).id, true);
      sala.ponerRecordatorio(asiento(0).id, { personaje: 'banshee', indice: 0, texto: 'Has Ability' });
      sala.cambiarVoto(asiento(0).id, true);
      expect(sala.puedeVotarDoble(ids[0])).toBe(true);
      expect(sala.sinVoto(ids[0])).toBe(false);
      sala.nominar(asiento(1).id, asiento(1).id);
      sala.levantarMano(ids[0], true, true);
      votar(sala);
      expect(sala.nominacion()?.votacion?.votos).toBe(2);
      expect(asiento(0).votoGastado).toBe(true);
      sala.cambiarVoto(asiento(0).id, false);
      sala.nominar(asiento(1).id, asiento(1).id);
      sala.levantarMano(ids[0], true);
      votar(sala);
      expect(asiento(0).votoGastado).toBe(false);
    });

    it('con el Voudon vivo, los muertos votan sin gastar su voto', () => {
      const { sala, ids, asiento } = salaConJugadores('Ana', 'Bea');
      sala.cambiarPersonaje(asiento(2).id, 'voudon');
      alDia(sala);
      sala.cambiarVida(asiento(0).id, true);
      sala.nominar(asiento(1).id, asiento(1).id);
      sala.levantarMano(ids[0], true);
      votar(sala);
      expect(sala.nominacion()?.votacion?.votos).toBe(1);
      expect(asiento(0).votoGastado).toBe(false);
    });

    it('con el Voudon muerto se vota como siempre', () => {
      const { sala, ids, asiento } = salaConJugadores('Ana', 'Bea');
      sala.cambiarPersonaje(asiento(2).id, 'voudon');
      alDia(sala);
      sala.cambiarVida(asiento(2).id, true);
      expect(sala.voudonVivo()).toBe(false);
      expect(sala.sinVoto(ids[1])).toBe(false);
      sala.nominar(asiento(0).id, asiento(1).id);
      expect(sala.nominacion()?.votosNecesarios).toBe(3);
    });

    it('el Voudon se reconoce también por quien es de verdad («Is The …»)', () => {
      const { sala, asiento } = salaConJugadores('Ana');
      sala.cambiarPersonaje(asiento(0).id, 'apprentice');
      expect(sala.voudonVivo()).toBe(false);
      sala.ponerRecordatorio(asiento(0).id, { personaje: 'voudon', indice: 0, texto: 'Is The Voudon' });
      expect(sala.voudonVivo()).toBe(true);
    });
  });

  describe('nominando', () => {
    /** Ana (asiento 0) nomina a la Virgen (asiento 1), de día; Ana lleva `nominador`. */
    const nominaALaVirgen = (nominador: string, preparar?: (sala: SalaService, asiento: (i: number) => SalaAsiento) => void) => {
      const { sala, asiento } = salaConJugadores('Ana', 'Bea');
      sala.cambiarPersonaje(asiento(0).id, nominador);
      sala.cambiarPersonaje(asiento(1).id, 'virgin');
      preparar?.(sala, asiento);
      alDia(sala);
      const ejecucion = sala.nominar(asiento(0).id, asiento(1).id);
      return { sala, asiento, ejecucion };
    };

    it('la primera vez que nominan a la Virgen, un aldeano que la nomina se ejecuta al momento', () => {
      const { sala, asiento, ejecucion } = nominaALaVirgen('chef');
      expect(ejecucion).toEqual({ anochece: true, final: false });
      expect(asiento(0).muerto).toBe(true);
      expect(textos(sala, 1)).toEqual(['No Ability']);
      expect(sala.nominacion()).toBeNull();
      expect(sala.fase().momento).toBe('noche');
    });

    it('si quien nomina no es aldeano de verdad (el Borracho), pierde la habilidad sin ejecutar', () => {
      const { sala, asiento, ejecucion } = nominaALaVirgen('chef', (s, a) => s.ponerRecordatorio(a(0).id, { personaje: 'drunk', indice: 0, texto: 'Is The Drunk' }));
      expect(ejecucion).toBeNull();
      expect(asiento(0).muerto).toBe(false);
      expect(textos(sala, 1)).toEqual(['No Ability']);
      expect(sala.nominacion()).not.toBeNull();
    });

    it('a un forastero (el Santo), un esbirro o un demonio que la nomina no lo ejecuta: solo a los aldeanos', () => {
      for (const nominador of ['saint', 'poisoner', 'imp']) {
        const { sala, asiento, ejecucion } = nominaALaVirgen(nominador);
        expect(ejecucion).toBeNull();
        expect(asiento(0).muerto).toBe(false);
        expect(sala.nominacion()).not.toBeNull();
      }
    });

    it('envenenada o siendo el Borracho, la pierde sin ejecutar', () => {
      const envenenada = nominaALaVirgen('chef', (s, a) => s.ponerRecordatorio(a(1).id, { personaje: 'poisoner', indice: 0, texto: 'Poisoned' }));
      expect(envenenada.ejecucion).toBeNull();
      expect(textos(envenenada.sala, 1)).toEqual(['Poisoned', 'No Ability']);
      const borracha = nominaALaVirgen('chef', (s, a) => s.ponerRecordatorio(a(1).id, { personaje: 'drunk', indice: 0, texto: 'Is The Drunk' }));
      expect(borracha.ejecucion).toBeNull();
    });

    it('si nomina un Espía sano, antes el narrador dice si registra como aldeano (sin nominar hasta entonces)', () => {
      const { sala, asiento, ejecucion } = nominaALaVirgen('spy');
      expect(ejecucion).toEqual({ pregunta: 'comoAldeano' });
      expect(sala.nominacion()).toBeNull();
      expect(textos(sala, 1)).toEqual([]);
      expect(sala.nominar(asiento(0).id, asiento(1).id, { comoAldeano: true })).toEqual({ anochece: true, final: false });
      expect(asiento(0).muerto).toBe(true);
      expect(textos(sala, 1)).toEqual(['No Ability']);
    });

    it('si el Espía no registra como aldeano, o está envenenado, la Virgen la pierde sin ejecutar', () => {
      const noRegistra = nominaALaVirgen('spy');
      expect(noRegistra.sala.nominar(noRegistra.asiento(0).id, noRegistra.asiento(1).id, { comoAldeano: false })).toBeNull();
      expect(noRegistra.sala.nominacion()).not.toBeNull();
      expect(textos(noRegistra.sala, 1)).toEqual(['No Ability']);
      const envenenado = nominaALaVirgen('spy', (s, a) => s.ponerRecordatorio(a(0).id, { personaje: 'poisoner', indice: 0, texto: 'Poisoned' }));
      expect(envenenado.ejecucion).toBeNull();
    });

    it('la segunda vez ya no pasa nada', () => {
      const { sala, asiento } = nominaALaVirgen('poisoner');
      sala.cerrarNominacion();
      sala.cambiarPersonaje(asiento(0).id, 'chef');
      expect(sala.nominar(asiento(0).id, asiento(1).id)).toBeNull();
      expect(asiento(0).muerto).toBe(false);
    });
  });

  describe('ejecutando', () => {
    it('con el Caníbal vivo, el ejecutado lleva su «Lunch»', () => {
      const { sala, asiento } = salaConJugadores('Ana');
      sala.cambiarPersonaje(asiento(1).id, 'cannibal');
      alDia(sala);
      sala.ejecutar(asiento(0).id);
      expect(textos(sala, 0)).toEqual(['Lunch']);
    });

    it('el ejecutado no se pone su propio recordatorio', () => {
      const { sala, asiento } = salaConJugadores('Ana');
      sala.cambiarPersonaje(asiento(0).id, 'undertaker');
      alDia(sala);
      sala.ejecutar(asiento(0).id);
      expect(textos(sala, 0)).toEqual([]);
    });

    it('con el Leviatán vivo, solo los buenos ejecutados llevan su recordatorio, y se acumulan', () => {
      const { sala, asiento } = salaConJugadores('Ana');
      sala.cambiarPersonaje(asiento(6).id, 'leviathan');
      sala.cambiarPersonaje(asiento(0).id, 'chef');
      sala.cambiarPersonaje(asiento(1).id, 'poisoner');
      sala.cambiarPersonaje(asiento(2).id, 'empath');
      alDia(sala);
      sala.ejecutar(asiento(0).id);
      sala.amanecer();
      sala.ejecutar(asiento(1).id);
      sala.amanecer();
      sala.ejecutar(asiento(2).id);
      expect([textos(sala, 0), textos(sala, 1), textos(sala, 2)]).toEqual([['Good Player Executed'], [], ['Good Player Executed']]);
    });

    it('con el Carnicero muerto, anochece', () => {
      const { sala, asiento } = salaConJugadores('Ana');
      sala.cambiarPersonaje(asiento(1).id, 'butcher');
      alDia(sala);
      sala.cambiarVida(asiento(1).id, true);
      expect(sala.ejecutar(asiento(0).id)?.anochece).toBe(true);
    });
  });

  describe('conversando', () => {
    it('con la Institutriz viva, solo con los vecinos', () => {
      const { sala, asiento } = salaConJugadores('Ana');
      expect(sala.institutrizViva()).toBe(false);
      sala.cambiarPersonaje(asiento(3).id, 'matron');
      expect(sala.institutrizViva()).toBe(true);
      alDia(sala);
      sala.cambiarVida(asiento(3).id, true);
      expect(sala.institutrizViva()).toBe(false);
    });
  });

  describe('repartiendo', () => {
    it('con el Revolutionary, sus dos asientos reciben personajes del mismo alineamiento', () => {
      const bolsa = ['washerwoman', 'librarian', 'investigator', 'chef', 'empath', 'poisoner', 'imp'];
      const buenos = new Set(bolsa.slice(0, 5));
      for (let vez = 0; vez < 40; vez++) {
        const { sala, asiento } = salaConJugadores();
        bolsa.forEach((id) => sala.alternarEnBolsa(id));
        sala.ponerRecordatorio(asiento(1).id, { personaje: 'revolutionary', indice: 0, texto: 'Used' });
        sala.ponerRecordatorio(asiento(4).id, { personaje: 'revolutionary', indice: 0, texto: 'Used' });
        sala.repartirBolsa();
        expect(buenos.has(asiento(1).personaje!)).toBe(buenos.has(asiento(4).personaje!));
        expect(asiento(1).personaje).not.toBe(asiento(4).personaje);
      }
    });
  });

  describe("Lil' Monsta", () => {
    /** 7 asientos, sin demonio y con dos esbirros (toca uno: el otro hace de demonio). */
    function partidaLilMonsta() {
      const p = salaConJugadores('Ana', 'Bea', 'Ceci');
      p.sala.cambiarPersonaje(p.asiento(0).id, 'poisoner');
      p.sala.cambiarPersonaje(p.asiento(1).id, 'organgrinder');
      return p;
    }

    it('se puede empezar de noche, sin demonio y con un esbirro de más', () => {
      const { sala, asiento } = partidaLilMonsta();
      expect(sala.esbirrosLilmonsta()).toBeNull();
      sala.irANoche();
      expect(sala.esbirrosLilmonsta()).toEqual([asiento(0).id, asiento(1).id]);
      sala.cambiarPersonaje(asiento(5).id, 'imp');
      expect(sala.esbirrosLilmonsta()).toBeNull();
    });

    it('cuando los esbirros coinciden, ese lo cuida: se congela y lleva su «Is The Demon»', () => {
      const { sala, ids, asiento } = partidaLilMonsta();
      sala.irANoche();
      sala.ponerRecordatorio(asiento(6).id, { personaje: 'lilmonsta', indice: 0, texto: 'Is The Demon' });
      sala.empezarSenalamiento({ tipo: 'lilmonsta', mensaje: '', segundos: null, senaladores: sala.esbirrosLilmonsta()!, objetivos: [] });
      expect(sala.senalar(ids[0], asiento(2).id)).toBeNull();
      expect(sala.senalamiento()?.congelado).toBe(false);
      expect(sala.senalar(ids[1], asiento(2).id)).toBeNull();
      expect(sala.senalamiento()?.congelado).toBe(true);
      expect(textos(sala, 2)).toEqual(['Is The Demon']);
      expect(textos(sala, 6)).toEqual([]);
    });

    it('si no coinciden, sigue abierto', () => {
      const { sala, ids, asiento } = partidaLilMonsta();
      sala.irANoche();
      sala.empezarSenalamiento({ tipo: 'lilmonsta', mensaje: '', segundos: null, senaladores: sala.esbirrosLilmonsta()!, objetivos: [] });
      sala.senalar(ids[0], asiento(2).id);
      sala.senalar(ids[1], asiento(3).id);
      expect(sala.senalamiento()?.congelado).toBe(false);
      expect(sala.asientos().some((a) => a.recordatorios.length > 0)).toBe(false);
    });
  });
});

describe('Reglas (cómo se combinan)', () => {
  const asiento = (cambios: Partial<SalaAsiento> = {}): SalaAsiento => ({
    id: 'a',
    ocupante: null,
    muerto: false,
    muertePendiente: false,
    votoGastado: false,
    marcado: false,
    votosMarca: null,
    personaje: null,
    alineamiento: null,
    recordatorios: [],
    nota: null,
    faroles: [null, null, null],
    ...cambios,
  });
  const ctx: ContextoReglas = { mesa: () => [], identidad: (a) => a.personaje, alineamiento: () => null, personaje: () => undefined };

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
