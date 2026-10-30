import { describe, expect, it } from 'vitest';
import { SalaService } from '../../src/services/SalaService';
import { ejecutarAccion, type DependenciasSala } from '../../src/sockets/salaAcciones';
import { MemoriaChatRepository } from '../../src/repositories/ChatRepository';
import { habilidadesDelGuion } from '../../src/services/partida/habilidades';
import { TontoYTu } from '../../src/services/narradorVirtual/estrategias/TontoYTu';
import { decisionesDe, type ContextoEtapa, type Etapa } from '../../src/services/narradorVirtual/etapas/Etapa';
import { Noche } from '../../src/services/narradorVirtual/etapas/Noche';
import { planificarNoche } from '../../src/services/narradorVirtual/noche/planificarNoche';
import { informacionesFalsas } from '../../src/services/narradorVirtual/noche/informacionFalsa';
import { ponerFaroles } from '../../src/services/narradorVirtual/noche/requisitos';
import {
  opcionesFalsas,
  probabilidadVerdad,
  recordarDroison,
  recuerdosNuevos,
} from '../../src/services/narradorVirtual/noche/criterioDroison';
import { elegirBolsa, type FueraDeLaBolsa } from '../../src/services/narradorVirtual/preparacion';
import type { Decision } from '../../src/services/narradorVirtual/estrategias/EstrategiaNarrador';
import { comprobarFinal } from '../../src/services/narradorVirtual/final/comprobarFinal';
import { Revelando } from '../../src/services/narradorVirtual/etapas/Revelando';
import { Violinista } from '../../src/services/narradorVirtual/etapas/Violinista';
import { contarDisparo, exterminar } from '../../src/services/narradorVirtual/dia/exterminar';
import { duracionPrivados, PuestaEnComun, TRAS_GONG_MS } from '../../src/services/narradorVirtual/etapas/Dia';
import { FRASES } from '../../src/services/narradorVirtual/frases';
import { invitado } from './guionDePrueba';
import { contextoNoche } from '../../src/services/narradorVirtual/mesaDeJuego';
import { ficha, numero, tarjeta } from '../../src/services/partida/habilidades/HabilidadNocturna';
import { guionTroubleBrewing } from './guionDePrueba';

/** La hoja de noche de Trouble Brewing (la de verdad). */
const PRIMERA_NOCHE = ['poisoner', 'spy', 'washerwoman', 'librarian', 'investigator', 'chef', 'empath', 'fortuneteller', 'butler'];
const OTRAS_NOCHES = ['poisoner', 'monk', 'scarletwoman', 'imp', 'ravenkeeper', 'undertaker', 'empath', 'fortuneteller', 'butler', 'spy'];

const guion = () => ({ ...guionTroubleBrewing(), primeraNoche: PRIMERA_NOCHE, otrasNoches: OTRAS_NOCHES });

/** Un azar con semilla (mulberry32): las mismas elecciones cada vez. */
function conSemilla(semilla: number): () => number {
  let s = semilla;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Una mesa de Trouble Brewing con esos personajes en asientos libres (por ellos
 * elige el narrador virtual) y el narrador virtual con su contexto: la mesa hace
 * las acciones de verdad y anota cuáles, sin esperas.
 */
function mesaVirtual(personajes: string[], { semilla = 1, fuera = [] as FueraDeLaBolsa[] } = {}) {
  const sala = new SalaService();
  sala.cambiarGuion(guion());
  while (sala.asientos().length > personajes.length) sala.quitarAsiento();
  while (sala.asientos().length < personajes.length) sala.anadirAsiento();
  personajes.forEach((p, i) => sala.cambiarPersonaje(sala.asientos()[i].id, p));
  const bot = sala.anadirNarradorVirtual({ id: 'tontoYTu', creador: 'nadie', guion: 'troublebrewing', jugadores: personajes.length }, 'Tonto y tú', '/logo-2.png');
  const deps: DependenciasSala = {
    guiones: { guionPredeterminado: async () => guion(), importar: async () => guion() },
    mensajes: new MemoriaChatRepository(),
    video: null,
    imagenesBiblioteca: { leerPublica: async () => Promise.reject(new Error('Sin Biblioteca')) },
  };
  const azar = conSemilla(semilla);
  const estrategia = new TontoYTu(azar);
  const hechas: { accion: string; datos: unknown }[] = [];
  const frases: string[] = [];
  let etapa: Etapa | null = null;
  let siguiente: Etapa | null = null;
  const ctx: ContextoEtapa = {
    sala,
    mesa: {
      accion: async (accion, datos) => {
        const r = await ejecutarAccion(sala, sala.buscar(bot), accion, datos, deps);
        if (r.ok) hechas.push({ accion, datos });
        // Como al difundir: la etapa mira si ya puede seguir
        void etapa?.alCambiar?.(ctx);
        return r;
      },
    },
    ...decisionesDe(sala, () => estrategia),
    azar,
    temporizador: { programar: (_ms, hacer) => {
      const t = setTimeout(hacer, 0);
      return () => clearTimeout(t);
    } },
    decir: (texto) => void frases.push(texto),
    pasarA: async (e) => {
      siguiente = e;
    },
    fueraDeLaBolsa: () => fuera,
    recuerdos: recuerdosNuevos(),
  };
  /** Corre una noche hasta que amanece (pasa a la etapa siguiente). */
  const noche = async () => {
    siguiente = null;
    etapa = new Noche();
    await etapa.alEntrar!(ctx);
    const limite = Date.now() + 3000;
    while (!siguiente) {
      if (Date.now() > limite) throw new Error('La noche no ha terminado');
      await new Promise((r) => setTimeout(r, 5));
    }
    return siguiente as Etapa;
  };
  const asiento = (personaje: string) => sala.asientos().find((a) => a.personaje === personaje)!;
  const textos = (personaje: string) => asiento(personaje).recordatorios.map((r) => r.texto);
  /**
   * En qué orden se ha despertado a cada uno (por su habilidad, o mandándole lo
   * revisado: droison, por ejemplo, va directo a revisar). Cada uno, la primera vez.
   */
  const despertados = () =>
    hechas
      .filter((h) => h.accion === 'narrador:despertarHabilidad' || h.accion === 'narrador:resolverHabilidad')
      .map((h) => (h.datos as { personajeId: string }).personajeId)
      .filter((p, i, todos) => todos.indexOf(p) === i || todos[i - 1] !== p);
  return { sala, ctx, hechas, frases, noche, asiento, textos, despertados };
}

describe('la noche del narrador virtual', () => {
  it('planifica por tramos, según lo que hace cada rol y no por su nombre', () => {
    const tb = guionTroubleBrewing();
    const tipo = (id: string) => tb.personajes.find((p) => p.id === id)?.tipo;
    const plan = (orden: string[], primera: boolean) =>
      planificarNoche({ orden, primera, habilidades: habilidadesDelGuion('troublebrewing'), tipoDe: tipo }).map((t) => [t.tramo, t.personajes]);
    expect(plan(PRIMERA_NOCHE, true)).toEqual([
      ['malvados', ['esbirros', 'demonios']],
      ['alteraATodos', ['poisoner']],
      ['informacion', ['washerwoman', 'librarian', 'investigator', 'chef', 'empath', 'fortuneteller', 'butler']],
      ['veTodo', ['spy']],
    ]);
    expect(plan(OTRAS_NOCHES, false)).toEqual([
      ['alteraATodos', ['poisoner']],
      ['alteraAlDemonio', ['monk']],
      ['esbirros', ['scarletwoman']],
      ['demonio', ['imp']],
      ['informacion', ['ravenkeeper', 'undertaker', 'empath', 'fortuneteller', 'butler']],
      ['veTodo', ['spy']],
    ]);
  });

  it('los faroles del demonio: tres buenos que no están en juego, con un forastero como mucho', async () => {
    for (let semilla = 1; semilla <= 30; semilla++) {
      const m = mesaVirtual(['empath', 'imp', 'chef', 'washerwoman', 'monk', 'soldier', 'mayor'], { semilla });
      await ponerFaroles(m.ctx);
      const faroles = m.sala.faroles().filter((f): f is string => !!f);
      expect(faroles).toHaveLength(3);
      expect(new Set(faroles).size).toBe(3);
      const enJuego = new Set(m.sala.asientos().map((a) => a.personaje));
      for (const f of faroles) {
        expect(enJuego.has(f)).toBe(false);
        expect(['townsfolk', 'outsider']).toContain(m.sala.personaje(f)?.tipo);
      }
      expect(faroles.filter((f) => m.sala.personaje(f)?.tipo === 'outsider').length).toBeLessThanOrEqual(1);
    }
  });

  it('la información falsa tiene la forma de la verdadera', () => {
    const m = mesaVirtual(['empath', 'imp', 'chef', 'washerwoman', 'monk', 'soldier', 'mayor']);
    const habilidades = habilidadesDelGuion('troublebrewing');
    const falsas = (personaje: string, verdadera: Parameters<typeof informacionesFalsas>[0]['verdadera']) =>
      informacionesFalsas({ verdadera, habilidad: habilidades.get(personaje)!, ctx: contextoNoche(m.sala), personajes: m.sala.guion()!.personajes });
    expect(falsas('fortuneteller', ficha('si'))).toMatchObject([{ ficha: 'no' }]);
    expect(falsas('fortuneteller', ficha('no'))).toMatchObject([{ ficha: 'si' }]);
    // El Empático: los otros números de 0 a 2
    expect(falsas('empath', numero(1)).map((f) => f.ficha)).toEqual(['cero', 'dos']);
    // La Lavandera: con los mismos jugadores, otro aldeano
    const jugadores = [m.sala.asientos()[0].id, m.sala.asientos()[3].id];
    const lavandera = falsas('washerwoman', tarjeta('esteJugadorEs', { jugadores, personajes: ['chef'] }));
    expect(lavandera.length).toBeGreaterThan(0);
    for (const f of lavandera) {
      expect(f.jugadores).toEqual(jugadores);
      expect(f.personajes[0]).not.toBe('chef');
      expect(m.sala.personaje(f.personajes[0])?.tipo).toBe('townsfolk');
    }
  });

  it('a un Empático envenenado con un vecino malvado (la verdad le señala al mal) casi nunca le da la de verdad', async () => {
    let deVerdad = 0;
    const veces = 60;
    for (let semilla = 1; semilla <= veces; semilla++) {
      const m = mesaVirtual(['empath', 'imp', 'chef', 'washerwoman', 'monk', 'soldier', 'mayor'], { semilla });
      // El Empático (entre el Imp y el Alcalde) tiene un vecino malvado
      const indice = m.sala.personaje('poisoner')!.recordatorios.indexOf('Poisoned');
      m.sala.ponerRecordatorio(m.asiento('empath').id, { personaje: 'poisoner', indice, texto: 'Poisoned' });
      m.sala.irANoche();
      await m.noche();
      const enviado = m.hechas.find((h) => h.accion === 'narrador:resolverHabilidad' && (h.datos as { personajeId: string }).personajeId === 'empath');
      const f = (enviado?.datos as { ficha: string }).ficha;
      expect(['cero', 'uno', 'dos']).toContain(f);
      if (f === 'uno') deVerdad++;
    }
    expect(deVerdad / veces).toBeGreaterThan(0);
    expect(deVerdad / veces).toBeLessThan(0.3);
  }, 30_000);

  it('la primera noche: faroles, requisitos, el Envenenador antes que nadie, el Espía el último y buenos días', async () => {
    const m = mesaVirtual(['poisoner', 'imp', 'washerwoman', 'librarian', 'investigator', 'fortuneteller', 'spy']);
    m.sala.irANoche();
    const siguiente = await m.noche();
    expect(siguiente.id).toBe('privados');
    expect(m.sala.fase()).toMatchObject({ momento: 'dia', numero: 1 });
    expect(m.frases).toEqual(['Buenos días plaza, hay un demonio entre vosotros que me ha matado durante la noche, encontradlo y ejecutadlo, tenéis 3 minutos y medio.']);

    // Los faroles: tres buenos que no están en juego
    const faroles = m.sala.faroles();
    const enJuego = new Set(m.sala.asientos().map((a) => a.personaje));
    expect(faroles.filter(Boolean)).toHaveLength(3);
    for (const f of faroles) {
      expect(enJuego.has(f)).toBe(false);
      expect(['townsfolk', 'outsider']).toContain(m.sala.personaje(f!)?.tipo);
    }
    // Lo que pedían en el grimorio, puesto: el correcto es de verdad de su tipo
    const conRecordatorio = (personaje: string, texto: string) => m.sala.asientos().find((a) => a.recordatorios.some((r) => r.personaje === personaje && r.texto === texto));
    expect(['poisoner', 'spy']).toContain(conRecordatorio('investigator', 'Minion')?.personaje);
    expect(conRecordatorio('investigator', 'Wrong')).toBeTruthy();
    expect(m.sala.personaje(conRecordatorio('washerwoman', 'Townsfolk')!.personaje!)?.tipo).toBe('townsfolk');
    expect(m.sala.alineamientoEfectivo(conRecordatorio('fortuneteller', 'Red Herring')!)).not.toBe('malvado');
    // Por los asientos libres elige él: el Envenenador ha envenenado a alguien
    expect(m.sala.asientos().some((a) => a.recordatorios.some((r) => r.texto === 'Poisoned'))).toBe(true);

    const orden = m.despertados();
    expect(orden.slice(0, 2).sort()).toEqual(['demonios', 'esbirros']);
    expect(orden[2]).toBe('poisoner');
    expect(orden[orden.length - 1]).toBe('spy');
    // El Bibliotecario sin forasteros (aunque el Espía pudiera registrar como uno): «cero»
    const bibliotecario = m.asiento('librarian').id;
    expect(m.hechas).toContainEqual({ accion: 'despertar:enviar', datos: { asientoId: bibliotecario, ficha: 'cero' } });
    expect(m.sala.asientos().some((a) => a.recordatorios.some((r) => r.personaje === 'librarian'))).toBe(false);
  });

  it('el Envenenador con jugador: primero ve a su demonio y, cuando dice «Entendido», elige', async () => {
    const m = mesaVirtual(['poisoner', 'imp', 'washerwoman', 'librarian', 'investigator', 'fortuneteller', 'chef']);
    const { id } = m.sala.conectar('s-ana', 'c-ana', invitado('Ana'), () => true);
    const asiento = m.asiento('poisoner').id;
    expect(m.sala.sentar(id, asiento)).toBeNull();
    m.sala.irANoche();
    const noche = new Noche();
    await noche.alEntrar!(m.ctx);
    const mensajes = () => m.sala.despertares().find((d) => d.asiento === asiento)?.mensajes ?? [];
    const hasta = async (cumple: () => boolean) => {
      const limite = Date.now() + 3000;
      while (!cumple()) {
        if (Date.now() > limite) throw new Error('No ha llegado');
        await new Promise((r) => setTimeout(r, 5));
      }
    };
    await hasta(() => mensajes().some((x) => x.tarjeta === 'demonio'));
    // Un rato después, sigue sin pedirle que elija: espera a que lo entienda
    await new Promise((r) => setTimeout(r, 100));
    expect(mensajes().some((x) => x.eleccion)).toBe(false);
    expect(await ejecutarAccion(m.sala, m.sala.buscar(id), 'despertar:enviar', { ficha: 'entendido' }, {} as DependenciasSala)).toMatchObject({ ok: true });
    await noche.alCambiar!();
    await hasta(() => !!mensajes()[mensajes().length - 1]?.eleccion);
    // (Mientras esperaba, el recordatorio de «Entendido»: el reloj de la prueba no espera el minuto)
    expect(mensajes().map((x) => x.tarjeta ?? x.ficha).filter((x) => x !== 'personalizado')).toEqual(['demonio', 'entendido', 'eleccion']);
    noche.alSalir!();
  });

  it('pone al Borracho la primera noche, si salió en la bolsa', async () => {
    const m = mesaVirtual(['poisoner', 'imp', 'chef', 'empath', 'washerwoman', 'investigator', 'soldier'], { fuera: [{ personaje: 'drunk', creeSer: null }] });
    m.sala.irANoche();
    await m.noche();
    const borrachos = m.sala.asientos().filter((a) => a.recordatorios.some((r) => r.texto === 'Is The Drunk'));
    expect(borrachos).toHaveLength(1);
    expect(m.sala.personaje(borrachos[0].personaje!)?.tipo).toBe('townsfolk');
    expect(m.sala.identidad(borrachos[0])).toBe('drunk');
  });

  it('las otras noches: el Monje antes que el Imp, el Imp antes que la información, y se anuncian las muertes', async () => {
    for (const semilla of [1, 2, 3, 4, 5]) {
      const m = mesaVirtual(['monk', 'imp', 'empath', 'poisoner', 'chef', 'ravenkeeper', 'soldier'], { semilla });
      m.sala.irANoche();
      await m.noche();
      m.sala.irANoche();
      await m.noche();
      const orden = m.despertados();
      const desde = orden.lastIndexOf('poisoner');
      const segunda = orden.slice(desde);
      expect(segunda.indexOf('monk')).toBeGreaterThan(0);
      expect(segunda.indexOf('imp')).toBeGreaterThan(segunda.indexOf('monk'));
      // El Empático, si no le ha matado el Imp esta noche (entonces no despierta)
      if (!m.asiento('empath').muerto) expect(segunda.indexOf('empath')).toBeGreaterThan(segunda.indexOf('imp'));
      else expect(segunda).not.toContain('empath');
      expect(m.sala.fase()).toMatchObject({ momento: 'dia', numero: 2 });
      const muertos = m.sala.asientos().filter((a) => a.muerto);
      expect(m.sala.asientos().some((a) => a.muertePendiente)).toBe(false);
      const frase = m.frases[m.frases.length - 1];
      if (muertos.length === 0) expect(frase).toBe('Buenos días a todo el mundo, nadie nos ha dejado esta noche.');
      else for (const a of muertos) expect(frase).toContain(`el asiento ${m.sala.asientos().findIndex((b) => b.id === a.id) + 1}`);
    }
  });

  describe('el final', () => {
    it('sin demonio vivo gana el bueno; con dos vivos, el malvado', async () => {
      const m = mesaVirtual(['imp', 'poisoner', 'chef', 'empath', 'monk', 'soldier', 'mayor']);
      expect(await comprobarFinal(m.ctx)).toBeNull();
      m.sala.cambiarVida(m.asiento('imp').id, true);
      expect(await comprobarFinal(m.ctx)).toBe('bueno');
      const otra = mesaVirtual(['imp', 'poisoner', 'chef', 'empath', 'monk', 'soldier', 'mayor']);
      for (const p of ['chef', 'empath', 'monk', 'soldier', 'mayor']) otra.sala.cambiarVida(otra.asiento(p).id, true);
      expect(await comprobarFinal(otra.ctx)).toBe('malvado');
    });

    it('ejecutar al Santo hace ganar al malvado (salvo droison)', async () => {
      const m = mesaVirtual(['imp', 'poisoner', 'saint', 'empath', 'monk', 'soldier', 'mayor']);
      m.sala.cambiarVida(m.asiento('saint').id, true);
      expect(await comprobarFinal(m.ctx, { ejecutado: m.asiento('saint').id })).toBe('malvado');
      // Envenenado, no: sigue
      const indice = m.sala.personaje('poisoner')!.recordatorios.indexOf('Poisoned');
      m.sala.ponerRecordatorio(m.asiento('saint').id, { personaje: 'poisoner', indice, texto: 'Poisoned' });
      expect(await comprobarFinal(m.ctx, { ejecutado: m.asiento('saint').id })).toBeNull();
      // Muerto de otra forma (no ejecutado), tampoco
      expect(await comprobarFinal(m.ctx)).toBeNull();
    });

    it('con tres vivos, el Alcalde vivo y sin ejecución, gana el bueno', async () => {
      const m = mesaVirtual(['imp', 'poisoner', 'chef', 'empath', 'monk', 'soldier', 'mayor']);
      for (const p of ['chef', 'empath', 'monk', 'soldier']) m.sala.cambiarVida(m.asiento(p).id, true);
      expect(await comprobarFinal(m.ctx)).toBeNull();
      expect(await comprobarFinal(m.ctx, { sinEjecucion: true })).toBe('bueno');
      // Sin el Alcalde vivo, no
      const sin = mesaVirtual(['imp', 'poisoner', 'chef', 'empath', 'monk', 'soldier', 'mayor']);
      for (const p of ['empath', 'monk', 'soldier', 'mayor']) sin.sala.cambiarVida(sin.asiento(p).id, true);
      expect(await comprobarFinal(sin.ctx, { sinEjecucion: true })).toBeNull();
    });

    it('el Exterminador solo mata al demonio (o a la Reclusa si registra como tal); al Santo, no', async () => {
      /** Una mesa de día con alguien sentado en el asiento de `tirador`; dispara a `objetivo`. */
      const dispara = async (tirador: string, objetivo: string, semilla = 1) => {
        const m = mesaVirtual(['slayer', 'imp', 'saint', 'recluse', 'chef', 'empath', 'poisoner'], { semilla });
        const { id } = m.sala.conectar('s-t', 'c-t', invitado('Tiradora'), () => true);
        m.sala.sentar(id, m.asiento(tirador).id);
        m.sala.irANoche();
        m.sala.amanecer();
        const muere = await exterminar(m.ctx, id, m.asiento(objetivo).id);
        // La muerte se pone al contarlo
        const ganador = await contarDisparo(m.ctx, id, m.asiento(objetivo).id, muere);
        return { muere, muerto: m.asiento(objetivo).muerto, ganador, m };
      };
      expect(await dispara('slayer', 'imp')).toMatchObject({ muere: true, muerto: true, ganador: 'bueno' });
      expect(await dispara('slayer', 'saint')).toMatchObject({ muere: false, muerto: false });
      expect(await dispara('slayer', 'chef')).toMatchObject({ muere: false, muerto: false });
      // Quien no es el Exterminador no mata ni al demonio
      expect(await dispara('chef', 'imp')).toMatchObject({ muere: false, muerto: false });
      // La Reclusa: según registre (al azar), unas veces sí y otras no; si muere, la partida sigue (el demonio vive)
      const reclusa = await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map((s) => dispara('slayer', 'recluse', s)));
      expect(reclusa.some((r) => r.muere)).toBe(true);
      expect(reclusa.some((r) => !r.muere)).toBe(true);
      expect(reclusa.every((r) => r.ganador === null)).toBe(true);
      // El Exterminador de verdad pierde su habilidad al disparar
      expect((await dispara('slayer', 'saint')).m.textos('slayer')).toEqual(['No Ability']);
    });

    it('el disparo se cuenta con pausas: «… y…», «X muere.» y si sigue la partida o se revela', async () => {
      const m = mesaVirtual(['slayer', 'imp', 'scarletwoman', 'chef', 'empath', 'monk', 'mayor']);
      const { id } = m.sala.conectar('s-t', 'c-t', invitado('Tiradora'), () => true);
      m.sala.sentar(id, m.asiento('slayer').id);
      m.sala.irANoche();
      m.sala.amanecer();
      const imp = m.asiento('imp').id;
      const muere = await exterminar(m.ctx, id, imp);
      // Aún no está muerto: se pone al decirlo
      expect(m.asiento('imp').muerto).toBe(false);
      // Con la Mujer Escarlata y siete vivos, hereda: la partida sigue
      expect(await contarDisparo(m.ctx, id, imp, muere)).toBeNull();
      expect(m.textos('scarletwoman')).toEqual(['Is The Demon']);
      expect(m.frases.slice(-3)).toEqual([
        expect.stringMatching(/ se declara exterminador y dispara a .+ y…$/),
        expect.stringMatching(/ muere\.$/),
        'La partida continúa.',
      ]);
      // Sin morir nadie: «… y…» y la partida continúa
      const chef = m.asiento('chef').id;
      expect(await contarDisparo(m.ctx, id, chef, false)).toBeNull();
      expect(m.frases.slice(-2)).toEqual([expect.stringMatching(/ y…$/), 'La partida continúa.']);
      expect(m.asiento('chef').muerto).toBe(false);
    });

    it('la Mujer Escarlata hereda el demonio con cinco vivos o más (contando al que muere)', async () => {
      const m = mesaVirtual(['imp', 'scarletwoman', 'chef', 'empath', 'monk', 'soldier', 'mayor']);
      m.sala.cambiarVida(m.asiento('imp').id, true);
      expect(await comprobarFinal(m.ctx)).toBeNull();
      expect(m.textos('scarletwoman')).toEqual(['Is The Demon']);
      // Con pocos vivos, no: gana el bueno
      const pocos = mesaVirtual(['imp', 'scarletwoman', 'chef', 'empath', 'monk', 'soldier', 'mayor']);
      for (const p of ['empath', 'monk', 'soldier', 'imp']) pocos.sala.cambiarVida(pocos.asiento(p).id, true);
      expect(await comprobarFinal(pocos.ctx)).toBe('bueno');
    });

    it('la Mujer Escarlata que hereda pasa a ser el Imp esa noche: se le dice y despierta como el Imp', async () => {
      const m = mesaVirtual(['imp', 'scarletwoman', 'chef', 'empath', 'monk', 'soldier', 'mayor']);
      m.sala.irANoche();
      await m.noche();
      m.sala.amanecer();
      // De día, muere el Imp: hereda
      m.sala.cambiarVida(m.asiento('imp').id, true);
      expect(await comprobarFinal(m.ctx)).toBeNull();
      const escarlata = m.asiento('scarletwoman').id;
      m.sala.irANoche();
      await m.noche();
      const asiento = m.sala.asientos().find((a) => a.id === escarlata)!;
      expect(m.sala.identidad(asiento)).toBe('imp');
      expect(m.ctx.recuerdos.cronica.antes.get(escarlata)).toBe('scarletwoman');
      // Se le dijo «Tú eres el Imp» y luego despertó como el Imp (a elegir)
      const despertados = m.despertados();
      expect(despertados.indexOf('imp')).toBeGreaterThan(despertados.indexOf('scarletwoman'));
      expect(m.hechas).toContainEqual({ accion: 'narrador:cambiarPersonaje', datos: { asientoId: escarlata, personajeId: 'imp' } });
    });

    it('si acaba antes de esa noche, al revelar la Mujer Escarlata que ha heredado ya es el Imp', async () => {
      const m = mesaVirtual(['imp', 'scarletwoman', 'chef', 'empath', 'monk', 'soldier', 'mayor']);
      m.sala.irANoche();
      m.sala.amanecer();
      m.sala.cambiarVida(m.asiento('imp').id, true);
      expect(await comprobarFinal(m.ctx)).toBeNull();
      const escarlata = m.asiento('scarletwoman').id;
      await new Revelando('malvado').alEntrar(m.ctx);
      expect(m.sala.identidad(m.sala.asientos().find((a) => a.id === escarlata)!)).toBe('imp');
      const limite = Date.now() + 3000;
      while (!m.frases.some((f) => / pasó a ser el demonio/.test(f)) && Date.now() < limite) await new Promise((r) => setTimeout(r, 5));
      // El demonio, sin su nombre
      expect(m.frases.find((f) => / pasó a ser el demonio/.test(f))).toMatch(/^.+ era scarletwoman y pasó a ser el demonio/);
    });

    it('revela el grimorio ficha a ficha, con el demonio el último', async () => {
      const m = mesaVirtual(['imp', 'poisoner', 'chef', 'empath', 'monk', 'soldier', 'mayor']);
      m.sala.irANoche();
      m.sala.amanecer();
      await new Revelando('bueno').alEntrar(m.ctx);
      expect(m.sala.revelacion()?.ganador).toBe('bueno');
      const limite = Date.now() + 3000;
      while (m.hechas.filter((h) => h.accion === 'narrador:revelarFicha').length < 7 && Date.now() < limite) await new Promise((r) => setTimeout(r, 5));
      const orden = m.hechas.filter((h) => h.accion === 'narrador:revelarFicha').map((h) => (h.datos as { asientoId: string }).asientoId);
      expect(orden).toHaveLength(7);
      expect(orden[6]).toBe(m.asiento('imp').id);
      expect(m.frases).toContain('Revelamos el grimorio.');
      // Y, revelado todo, quién gana
      while (!/buenos/.test(m.frases[m.frases.length - 1] ?? '') && Date.now() < limite) await new Promise((r) => setTimeout(r, 5));
      expect(m.frases[m.frases.length - 1]).toMatch(/buenos/);
    });

    it('el Violinista: sin demonio que conteste, elige su estrategia; todos señalan y se revela', async () => {
      const m = mesaVirtual(['imp', 'poisoner', 'chef', 'empath', 'monk', 'soldier', 'mayor']);
      m.sala.irANoche();
      m.sala.amanecer();
      let siguiente: string | null = null;
      const ctx = { ...m.ctx, pasarA: async (e: { id: string }) => void (siguiente = e.id) };
      await new Violinista().alEntrar(ctx as typeof m.ctx);
      const limite = Date.now() + 3000;
      while (!siguiente && Date.now() < limite) await new Promise((r) => setTimeout(r, 5));
      expect(siguiente).toBe('revelando');
      const senalamiento = m.hechas.find((h) => h.accion === 'narrador:senalamiento')?.datos as { objetivos: string[] };
      expect(senalamiento.objetivos[0]).toBe(m.asiento('imp').id);
      expect(m.sala.alineamientoEfectivo(m.sala.asientos().find((a) => a.id === senalamiento.objetivos[1])!)).toBe('bueno');
    });
  });
});

describe('los privados del narrador virtual', () => {
  it('duran medio minuto por cada jugador vivo', () => {
    const m = mesaVirtual(['empath', 'imp', 'chef', 'washerwoman', 'monk', 'soldier', 'mayor']);
    expect(duracionPrivados(m.sala)).toBe(7 * 30_000);
    m.sala.cambiarVida(m.asiento('chef').id, true);
    m.sala.cambiarVida(m.asiento('monk').id, true);
    expect(duracionPrivados(m.sala)).toBe(5 * 30_000);
  });

  it('el primer día dice el tiempo en minutos y medios', () => {
    expect(FRASES.primerDia(210)).toMatch(/tenéis 3 minutos y medio\.$/);
    expect(FRASES.primerDia(240)).toMatch(/tenéis 4 minutos\.$/);
    expect(FRASES.primerDia(90)).toMatch(/tenéis 1 minuto y medio\.$/);
    expect(FRASES.primerDia(30)).toMatch(/tenéis medio minuto\.$/);
  });

  it('al acabar suena el gong y, unos segundos después, se cierran', async () => {
    const m = mesaVirtual(['empath', 'imp', 'chef', 'washerwoman', 'monk', 'soldier', 'mayor']);
    const programados: { ms: number; hacer: () => void }[] = [];
    const ctx = { ...m.ctx, temporizador: { programar: (ms: number, hacer: () => void) => (programados.push({ ms, hacer }), () => {}) } };
    await new PuestaEnComun().alEntrar(ctx);
    const acciones = () => m.hechas.map((h) => h.accion);
    expect(acciones()).toContain('narrador:sonarGong');
    expect(m.sala.privadosPermitidos()).toBe(true);
    programados.find((p) => p.ms === TRAS_GONG_MS)!.hacer();
    await new Promise((r) => setTimeout(r, 0));
    expect(m.sala.privadosPermitidos()).toBe(false);
    expect(acciones().indexOf('narrador:privados')).toBeGreaterThan(acciones().indexOf('narrador:sonarGong'));
  });
});

describe('droison con criterio', () => {
  const mesa = () => mesaVirtual(['empath', 'imp', 'chef', 'washerwoman', 'poisoner', 'soldier', 'mayor']);

  it('la verdad que no le cuesta nada al mal se dice más a menudo que la que lo señala', () => {
    const m = mesa();
    const empatico = m.asiento('empath').id;
    const inofensiva = probabilidadVerdad(m.sala, empatico, 'empath', numero(0), recuerdosNuevos());
    const destapa = probabilidadVerdad(m.sala, empatico, 'empath', numero(1), recuerdosNuevos());
    expect(inofensiva).toBeGreaterThanOrEqual(0.3);
    expect(destapa).toBeLessThanOrEqual(0.1);
    expect(inofensiva).toBeGreaterThan(destapa);
  });

  it('a lo mismo que otra noche, lo mismo: repite la mentira', () => {
    const m = mesa();
    const empatico = m.asiento('empath').id;
    const recuerdos = recuerdosNuevos();
    recordarDroison(recuerdos, empatico, 'empath', numero(1), numero(2));
    expect(probabilidadVerdad(m.sala, empatico, 'empath', numero(1), recuerdos)).toBeLessThanOrEqual(0.05);
    const opciones = opcionesFalsas(m.sala, empatico, 'empath', numero(1), [numero(0), numero(2)], recuerdos);
    const pesos = Object.fromEntries(opciones.map((o) => [o.valor.ficha, o.peso ?? 1]));
    expect(pesos.dos).toBeGreaterThan(pesos.cero * 5);
    // Y si entonces dijo la verdad, la vuelve a decir
    recordarDroison(recuerdos, empatico, 'empath', numero(1), numero(1));
    expect(probabilidadVerdad(m.sala, empatico, 'empath', numero(1), recuerdos)).toBeGreaterThanOrEqual(0.9);
  });

  it('las mentiras que confirman el farol que usa un malvado pesan más', () => {
    const m = mesa();
    const envenenador = m.asiento('poisoner').id;
    m.sala.ponerFarolAsiento(envenenador, 0, 'monk');
    expect(m.sala.usarFarol(envenenador, 'monk')).toBeNull();
    const jugadores = [m.asiento('soldier').id, envenenador];
    const verdadera = tarjeta('esteJugadorEs', { jugadores, personajes: ['soldier'] });
    const falsas = ['monk', 'chef'].map((p) => tarjeta('esteJugadorEs', { jugadores, personajes: [p] }));
    const [monje, chef] = opcionesFalsas(m.sala, m.asiento('washerwoman').id, 'washerwoman', verdadera, falsas, recuerdosNuevos());
    expect(monje.rasgos).toContain('confirmaFarol');
    expect(monje.peso!).toBeGreaterThan(chef.peso ?? 1);
  });
});

describe('la bolsa que elige el narrador', () => {
  /** Una estrategia que elige siempre la primera opción, y apunta lo que le preguntan. */
  const laPrimera = () => {
    const preguntas: Decision<unknown>[] = [];
    const decidir = async <T,>(d: Decision<T>): Promise<T> => {
      preguntas.push(d as Decision<unknown>);
      return d.opciones[0].valor;
    };
    return { decidir, preguntas };
  };

  it('hueco a hueco: el demonio, los esbirros, los forasteros y los aldeanos que tocan', async () => {
    const m = mesaVirtual(['empath', 'imp', 'chef', 'washerwoman', 'monk', 'soldier', 'mayor']);
    const { decidir, preguntas } = laPrimera();
    const bolsa = (await elegirBolsa(m.sala.guion()!.personajes, m.sala.distribucion(), decidir))!;
    const tipos = bolsa.personajes.map((p) => m.sala.personaje(p)?.tipo);
    expect(tipos.filter((t) => t === 'demon')).toHaveLength(1);
    expect(tipos.filter((t) => t === 'minion')).toHaveLength(1);
    expect(bolsa.personajes).toHaveLength(7);
    expect(preguntas.every((p) => p.motivo === 'bolsa')).toBe(true);
    // Lo ya elegido va en la pregunta siguiente
    expect(preguntas[1].pregunta).toMatch(/Ya en la bolsa: imp./);
  });

  it('sin grimorio: a cada hueco, los personajes del guion y las decisiones anteriores', async () => {
    const m = mesaVirtual(['empath', 'imp', 'chef', 'washerwoman', 'monk', 'soldier', 'mayor']);
    const personajes = m.sala.guion()!.personajes;
    const { decidir, preguntas } = laPrimera();
    await elegirBolsa(personajes, m.sala.distribucion(), decidir);
    const [primera, segunda] = preguntas;
    expect(primera.sinGrimorio).toMatchObject({ decisionesAnteriores: [] });
    expect((primera.sinGrimorio!.guion as unknown[]).length).toBe(personajes.length);
    expect(segunda.sinGrimorio!.decisionesAnteriores).toEqual([
      { pregunta: primera.pregunta, elegido: { id: 'imp', nombre: expect.any(String), tipo: 'demon' } },
    ]);
    expect(preguntas[preguntas.length - 1].sinGrimorio!.decisionesAnteriores).toHaveLength(preguntas.length - 1);
  });
});

