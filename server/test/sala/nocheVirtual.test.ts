import { describe, expect, it } from 'vitest';
import { SalaDeJuego } from '../../src/models/SalaDeJuego';
import { ejecutarAccion } from '../../src/services/sala/acciones';
import { NocheService } from '../../src/services/sala/NocheService';
import { DiaService } from '../../src/services/sala/DiaService';
import type { RespuestaAccion } from '../../src/models/narradorVirtual/puertos';
import type { DependenciasAcciones } from '../../src/services/sala/puertos';
import { MemoriaImagenRepository } from '../../src/repositories/ImagenRepository';
import { ImagenesSala } from '../../src/services/sala/ImagenesSala';
import { habilidadesDelGuion } from '../../src/models/partida/habilidades';
import { TontoYTu } from '../../src/models/narradorVirtual/estrategias/TontoYTu';
import { decisionesDe, type ContextoEtapa, type Etapa } from '../../src/models/narradorVirtual/etapas/Etapa';
import { Noche } from '../../src/models/narradorVirtual/etapas/Noche';
import { planificarNoche } from '../../src/models/narradorVirtual/noche/planificarNoche';
import { informacionesFalsas } from '../../src/models/narradorVirtual/noche/informacionFalsa';
import { ponerFaroles } from '../../src/models/narradorVirtual/noche/requisitos';
import {
  opcionesFalsas,
  probabilidadVerdad,
  recordarDroison,
  recuerdosNuevos,
} from '../../src/models/narradorVirtual/noche/criterioDroison';
import { elegirBolsa, type FueraDeLaBolsa } from '../../src/models/narradorVirtual/preparacion';
import type { Decision } from '../../src/models/narradorVirtual/estrategias/EstrategiaNarrador';
import { comprobarFinal } from '../../src/models/narradorVirtual/final/comprobarFinal';
import { Revelando } from '../../src/models/narradorVirtual/etapas/Revelando';
import { Violinista } from '../../src/models/narradorVirtual/etapas/Violinista';
import { contarDisparo, exterminar } from '../../src/models/personajes/exterminador';
import { duracionPrivados, PuestaEnComun, TRAS_GONG_MS } from '../../src/models/narradorVirtual/etapas/Dia';
import { FRASES } from '../../src/models/narradorVirtual/frases';
import { contextoNoche } from '../../src/models/narradorVirtual/plazaDeJuego';
import { ficha, numero, tarjeta } from '../../src/models/partida/habilidades/HabilidadNocturna';
import { conSemilla, guionTroubleBrewing, invitado } from './guionDePrueba';
import { identidadDe } from '../../src/models/partida/Grimorio';

/** La hoja de noche de Trouble Brewing (la de verdad). */
const PRIMERA_NOCHE = ['poisoner', 'spy', 'washerwoman', 'librarian', 'investigator', 'chef', 'empath', 'fortuneteller', 'butler'];
const OTRAS_NOCHES = ['poisoner', 'monk', 'scarletwoman', 'imp', 'ravenkeeper', 'undertaker', 'empath', 'fortuneteller', 'butler', 'spy'];

const guion = () => ({ ...guionTroubleBrewing(), primeraNoche: PRIMERA_NOCHE, otrasNoches: OTRAS_NOCHES });

/**
 * Una plaza de Trouble Brewing con esos personajes en asientos libres (por ellos
 * elige el narrador virtual) y el narrador virtual con su contexto: la plaza hace
 * las acciones de verdad y anota cuáles, sin esperas.
 */
function plazaVirtual(personajes: string[], { semilla = 1, fuera = [] as FueraDeLaBolsa[] } = {}) {
  const juego = new SalaDeJuego(conSemilla(1));
  const { sala, partida, narrador } = juego;
  partida.cambiarGuion(guion());
  while (partida.plaza().length > personajes.length) sala.quitarAsiento();
  while (partida.plaza().length < personajes.length) sala.anadirAsiento();
  personajes.forEach((p, i) => partida.grimorio.cambiarPersonaje(partida.plaza()[i].id, p));
  const bot = narrador.anadir({ id: 'tontoYTu', creador: 'nadie', guion: 'troublebrewing', jugadores: personajes.length }, 'Tonto y tú', '/logo-2.png');
  const deps: DependenciasAcciones = {
    guiones: { guionPredeterminado: async () => guion(), importar: async () => guion() },
    imagenesBiblioteca: { leerPublica: async () => Promise.reject(new Error('Sin Biblioteca')) },
    imagenes: new ImagenesSala(new MemoriaImagenRepository()),
  };
  const azar = conSemilla(semilla);
  const estrategia = new TontoYTu(azar);
  const hechas: { accion: string; datos: unknown }[] = [];
  const frases: string[] = [];
  let etapa: Etapa | null = null;
  let siguiente: Etapa | null = null;
  // La noche, con sus permisos de verdad (como el narrador virtual de la sala)
  const deNoche = new NocheService(juego, () => {});
  const deDia = new DiaService(juego, () => {});
  const hecha = (accion: string, datos: unknown, r: RespuestaAccion) => {
    if (r.ok) hechas.push({ accion, datos });
    void etapa?.alCambiar?.(ctx);
    return r;
  };
  const ctx: ContextoEtapa = {
    juego: juego,
    plaza: {
      despertar: async (jugadorId) => hecha('noche:despertar', { jugadorId }, deNoche.despertar(bot, jugadorId)),
      enviarDespertar: async (jugadorId, mensaje) => hecha('noche:enviar', { jugadorId, ...mensaje }, deNoche.enviar(bot, [jugadorId], mensaje)),
      despertarHabilidad: async (personajeId) =>
        hecha('noche:despertarHabilidad', { personajeId }, deNoche.despertarHabilidad(bot, personajeId)),
      resolverHabilidad: async (personajeId, mensaje) =>
        hecha('noche:resolverHabilidad', { personajeId, ...mensaje }, deNoche.resolverHabilidad(bot, personajeId, mensaje)),
      nuevoImp: async (jugadorId) => hecha('noche:nuevoImp', { jugadorId }, deNoche.nuevoImp(bot, jugadorId)),
      darPalabra: async (participanteId) => hecha('dia:darPalabra', { participanteId }, deDia.darPalabra(bot, participanteId)),
      nominar: async (desde, hasta, comoAldeano) => hecha('dia:nominar', { desde, hasta, comoAldeano }, deDia.nominar(bot, desde, hasta, comoAldeano)),
      cuentaAtras: async () => hecha('dia:cuentaAtras', undefined, deDia.cuentaAtras(bot)),
      marcar: async (jugadorId, marcado) => hecha('dia:marcar', { jugadorId, marcado }, deDia.marcar(bot, jugadorId, marcado, true)),
      desmarcar: async () => hecha('dia:desmarcar', undefined, deDia.desmarcar(bot)),
      cerrarNominacion: async () => hecha('dia:cerrarNominacion', undefined, deDia.cerrarNominacion(bot)),
      ejecutar: async (jugadorId) => hecha('dia:ejecutar', { jugadorId }, deDia.ejecutar(bot, jugadorId)),
      accion: async (accion, datos) => {
        const r = await ejecutarAccion(juego, sala.participantes.buscar(bot), accion, datos, deps);
        if (r.ok) hechas.push({ accion, datos });
        // Como al difundir: la etapa mira si ya puede seguir
        void etapa?.alCambiar?.(ctx);
        return r;
      },
      llenarBolsa: async (personajes) => {
        const error = juego.partida.bolsa.llenar(personajes);
        return error ? { ok: false, error } : { ok: true };
      },
      sonarGong: async () => {
        const error = juego.partida.reloj.sonarGong();
        if (!error) hechas.push({ accion: 'reloj:sonarGong', datos: undefined });
        return error ? { ok: false, error } : { ok: true };
      },
      ponerReloj: async (segundos, mensaje) => {
        const error = juego.partida.reloj.ponerReloj(segundos, mensaje);
        if (!error) hechas.push({ accion: 'reloj:poner', datos: { segundos, mensaje } });
        return error ? { ok: false, error } : { ok: true };
      },
      revelarGrimorio: async (ganador) => {
        const error = juego.partida.revelarGrimorio(ganador, [], {});
        if (!error) hechas.push({ accion: 'revelacion:empezar', datos: { ganador } });
        return error ? { ok: false, error } : { ok: true };
      },
      revelarFicha: async (jugadorId) => {
        const error = juego.partida.revelacion.revelarFicha(jugadorId);
        if (!error) hechas.push({ accion: 'revelacion:revelarFicha', datos: { jugadorId } });
        return error ? { ok: false, error } : { ok: true };
      },
      empezarSenalamiento: async (peticion) => {
        const error = juego.partida.empezarSenalamiento(peticion);
        if (!error) hechas.push({ accion: 'senalamiento:empezar', datos: peticion });
        return error ? { ok: false, error } : { ok: true };
      },
      prepararFarol: async (posicion, personajeId) => {
        const error = juego.partida.faroles.ponerFarol(posicion, personajeId);
        if (!error) hechas.push({ accion: 'faroles:preparar', datos: { posicion, personajeId } });
        return error ? { ok: false, error } : { ok: true };
      },
      irANoche: async () => {
        juego.partida.irANoche();
        hechas.push({ accion: 'fase:noche', datos: undefined });
        return { ok: true };
      },
      limpiarGrimorio: async () => {
        juego.partida.limpiarGrimorio();
        return { ok: true };
      },
      amanecer: async () => {
        juego.partida.amanecer();
        hechas.push({ accion: 'fase:amanecer', datos: undefined });
        return { ok: true };
      },
      terminarSenalamiento: async () => {
        juego.partida.senalamientos.terminar();
        hechas.push({ accion: 'senalamiento:terminar', datos: undefined });
        return { ok: true };
      },
    },
    ...decisionesDe(juego, () => estrategia),
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
  const asiento = (personaje: string) => partida.plaza().find((a) => a.personaje === personaje)!;
  const textos = (personaje: string) => asiento(personaje).recordatorios.map((r) => r.texto);
  /**
   * En qué orden se ha despertado a cada uno (por su habilidad, o mandándole lo
   * revisado: droison, por ejemplo, va directo a revisar). Cada uno, la primera vez.
   */
  const despertados = () =>
    hechas
      .filter((h) => h.accion === 'noche:despertarHabilidad' || h.accion === 'noche:resolverHabilidad')
      .map((h) => (h.datos as { personajeId: string }).personajeId)
      .filter((p, i, todos) => todos.indexOf(p) === i || todos[i - 1] !== p);
  return { juego, ctx, hechas, frases, noche, asiento, textos, despertados };
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
      const m = plazaVirtual(['empath', 'imp', 'chef', 'washerwoman', 'monk', 'soldier', 'mayor'], { semilla });
      const { partida } = m.juego;
      await ponerFaroles(m.ctx);
      const faroles = partida.faroles.faroles().filter((f): f is string => !!f);
      expect(faroles).toHaveLength(3);
      expect(new Set(faroles).size).toBe(3);
      const enJuego = new Set(partida.plaza().map((a) => a.personaje));
      for (const f of faroles) {
        expect(enJuego.has(f)).toBe(false);
        expect(['townsfolk', 'outsider']).toContain(partida.guion.personaje(f)?.tipo);
      }
      expect(faroles.filter((f) => partida.guion.personaje(f)?.tipo === 'outsider').length).toBeLessThanOrEqual(1);
    }
  });

  it('la información falsa tiene la forma de la verdadera', () => {
    const m = plazaVirtual(['empath', 'imp', 'chef', 'washerwoman', 'monk', 'soldier', 'mayor']);
    const { partida } = m.juego;
    const habilidades = habilidadesDelGuion('troublebrewing');
    const falsas = (personaje: string, verdadera: Parameters<typeof informacionesFalsas>[0]['verdadera']) =>
      informacionesFalsas({ verdadera, habilidad: habilidades.get(personaje)!, ctx: contextoNoche(m.juego), personajes: partida.guion.actual()!.personajes });
    expect(falsas('fortuneteller', ficha('si'))).toMatchObject([{ ficha: 'no' }]);
    expect(falsas('fortuneteller', ficha('no'))).toMatchObject([{ ficha: 'si' }]);
    // El Empático: los otros números de 0 a 2
    expect(falsas('empath', numero(1)).map((f) => f.ficha)).toEqual(['cero', 'dos']);
    // La Lavandera: con los mismos jugadores, otro aldeano
    const jugadores = [partida.plaza()[0].id, partida.plaza()[3].id];
    const lavandera = falsas('washerwoman', tarjeta('esteJugadorEs', { jugadores, personajes: ['chef'] }));
    expect(lavandera.length).toBeGreaterThan(0);
    for (const f of lavandera) {
      expect(f.jugadores).toEqual(jugadores);
      expect(f.personajes[0]).not.toBe('chef');
      expect(partida.guion.personaje(f.personajes[0])?.tipo).toBe('townsfolk');
    }
  });

  it('a un Empático envenenado con un vecino malvado (la verdad le señala al mal) casi nunca le da la de verdad', async () => {
    let deVerdad = 0;
    const veces = 60;
    for (let semilla = 1; semilla <= veces; semilla++) {
      const m = plazaVirtual(['empath', 'imp', 'chef', 'washerwoman', 'monk', 'soldier', 'mayor'], { semilla });
      const { partida } = m.juego;
      // El Empático (entre el Imp y el Alcalde) tiene un vecino malvado
      const indice = partida.guion.personaje('poisoner')!.recordatorios.indexOf('Poisoned');
      partida.grimorio.ponerRecordatorio(m.asiento('empath').id, { personaje: 'poisoner', indice, texto: 'Poisoned' });
      partida.irANoche();
      await m.noche();
      const enviado = m.hechas.find((h) => h.accion === 'noche:resolverHabilidad' && (h.datos as { personajeId: string }).personajeId === 'empath');
      const f = (enviado?.datos as { ficha: string }).ficha;
      expect(['cero', 'uno', 'dos']).toContain(f);
      if (f === 'uno') deVerdad++;
    }
    expect(deVerdad / veces).toBeGreaterThan(0);
    expect(deVerdad / veces).toBeLessThan(0.3);
  }, 30_000);

  it('la primera noche: faroles, requisitos, el Envenenador antes que nadie, el Espía el último y buenos días', async () => {
    const m = plazaVirtual(['poisoner', 'imp', 'washerwoman', 'librarian', 'investigator', 'fortuneteller', 'spy']);
    const { partida } = m.juego;
    partida.irANoche();
    const siguiente = await m.noche();
    expect(siguiente.id).toBe('privados');
    expect(partida.fases.actual()).toMatchObject({ momento: 'dia', numero: 1 });
    expect(m.frases).toEqual(['Buenos días plaza, hay un demonio entre vosotros que me ha matado durante la noche, encontradlo y ejecutadlo, tenéis 3 minutos y medio.']);

    // Los faroles: tres buenos que no están en juego
    const faroles = partida.faroles.faroles();
    const enJuego = new Set(partida.plaza().map((a) => a.personaje));
    expect(faroles.filter(Boolean)).toHaveLength(3);
    for (const f of faroles) {
      expect(enJuego.has(f)).toBe(false);
      expect(['townsfolk', 'outsider']).toContain(partida.guion.personaje(f!)?.tipo);
    }
    // Lo que pedían en el grimorio, puesto: el correcto es de verdad de su tipo
    const conRecordatorio = (personaje: string, texto: string) => partida.plaza().find((a) => a.recordatorios.some((r) => r.personaje === personaje && r.texto === texto));
    expect(['poisoner', 'spy']).toContain(conRecordatorio('investigator', 'Minion')?.personaje);
    expect(conRecordatorio('investigator', 'Wrong')).toBeTruthy();
    expect(partida.guion.personaje(conRecordatorio('washerwoman', 'Townsfolk')!.personaje!)?.tipo).toBe('townsfolk');
    expect(partida.grimorio.alineamiento(conRecordatorio('fortuneteller', 'Red Herring')!)).not.toBe('malvado');
    // Por los asientos libres elige él: el Envenenador ha envenenado a alguien
    expect(partida.plaza().some((a) => a.recordatorios.some((r) => r.texto === 'Poisoned'))).toBe(true);

    const orden = m.despertados();
    expect(orden.slice(0, 2).sort()).toEqual(['demonios', 'esbirros']);
    expect(orden[2]).toBe('poisoner');
    expect(orden[orden.length - 1]).toBe('spy');
    // El Bibliotecario sin forasteros (aunque el Espía pudiera registrar como uno): «cero»
    const bibliotecario = m.asiento('librarian').id;
    expect(m.hechas).toContainEqual({ accion: 'noche:enviar', datos: { jugadorId: bibliotecario, ficha: 'cero' } });
    expect(partida.plaza().some((a) => a.recordatorios.some((r) => r.personaje === 'librarian'))).toBe(false);
  });

  it('el Envenenador con jugador: primero ve a su demonio y, cuando dice «Entendido», elige', async () => {
    const m = plazaVirtual(['poisoner', 'imp', 'washerwoman', 'librarian', 'investigator', 'fortuneteller', 'chef']);
    const { sala, partida } = m.juego;
    const { id } = sala.participantes.conectar('s-ana', 'c-ana', invitado('Ana'), () => true);
    const asiento = m.asiento('poisoner').id;
    expect(sala.sentar(id, asiento)).toBeNull();
    partida.irANoche();
    const noche = new Noche();
    await noche.alEntrar!(m.ctx);
    const mensajes = () => partida.despertares.despertares().find((d) => d.jugador === asiento)?.mensajes ?? [];
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
    expect(new NocheService(m.juego, () => {}).enviar(id, [], { ficha: 'entendido' })).toMatchObject({ ok: true });
    await noche.alCambiar!();
    await hasta(() => !!mensajes()[mensajes().length - 1]?.eleccion);
    // (Mientras esperaba, el recordatorio de «Entendido»: el reloj de la prueba no espera el minuto)
    expect(mensajes().map((x) => x.tarjeta ?? x.ficha).filter((x) => x !== 'personalizado')).toEqual(['demonio', 'entendido', 'eleccion']);
    noche.alSalir!();
  });

  it('pone al Borracho la primera noche, si salió en la bolsa', async () => {
    const m = plazaVirtual(['poisoner', 'imp', 'chef', 'empath', 'washerwoman', 'investigator', 'soldier'], { fuera: [{ personaje: 'drunk', creeSer: null }] });
    const { partida } = m.juego;
    partida.irANoche();
    await m.noche();
    const borrachos = partida.plaza().filter((a) => a.recordatorios.some((r) => r.texto === 'Is The Drunk'));
    expect(borrachos).toHaveLength(1);
    expect(partida.guion.personaje(borrachos[0].personaje!)?.tipo).toBe('townsfolk');
    expect(identidadDe(borrachos[0])).toBe('drunk');
  });

  it('las otras noches: el Monje antes que el Imp, el Imp antes que la información, y se anuncian las muertes', async () => {
    for (const semilla of [1, 2, 3, 4, 5]) {
      const m = plazaVirtual(['monk', 'imp', 'empath', 'poisoner', 'chef', 'ravenkeeper', 'soldier'], { semilla });
      const { partida } = m.juego;
      partida.irANoche();
      await m.noche();
      partida.irANoche();
      await m.noche();
      const orden = m.despertados();
      const desde = orden.lastIndexOf('poisoner');
      const segunda = orden.slice(desde);
      expect(segunda.indexOf('monk')).toBeGreaterThan(0);
      expect(segunda.indexOf('imp')).toBeGreaterThan(segunda.indexOf('monk'));
      // El Empático, si no le ha matado el Imp esta noche (entonces no despierta)
      if (!m.asiento('empath').muerto) expect(segunda.indexOf('empath')).toBeGreaterThan(segunda.indexOf('imp'));
      else expect(segunda).not.toContain('empath');
      expect(partida.fases.actual()).toMatchObject({ momento: 'dia', numero: 2 });
      const muertos = partida.plaza().filter((a) => a.muerto);
      expect(partida.plaza().some((a) => a.muertePendiente)).toBe(false);
      const frase = m.frases[m.frases.length - 1];
      if (muertos.length === 0) expect(frase).toBe('Buenos días a todo el mundo, nadie nos ha dejado esta noche.');
      else for (const a of muertos) expect(frase).toContain(`el asiento ${partida.plaza().findIndex((b) => b.id === a.id) + 1}`);
    }
  });

  describe('el final', () => {
    it('sin demonio vivo gana el bueno; con dos vivos, el malvado', async () => {
      const m = plazaVirtual(['imp', 'poisoner', 'chef', 'empath', 'monk', 'soldier', 'mayor']);
      const { partida } = m.juego;
      expect(await comprobarFinal(m.ctx)).toBeNull();
      partida.grimorio.cambiarVida(m.asiento('imp').id, true);
      expect(await comprobarFinal(m.ctx)).toBe('bueno');
      const otra = plazaVirtual(['imp', 'poisoner', 'chef', 'empath', 'monk', 'soldier', 'mayor']);
      for (const p of ['chef', 'empath', 'monk', 'soldier', 'mayor']) otra.juego.partida.grimorio.cambiarVida(otra.asiento(p).id, true);
      expect(await comprobarFinal(otra.ctx)).toBe('malvado');
    });

    it('ejecutar al Santo hace ganar al malvado (salvo droison)', async () => {
      const m = plazaVirtual(['imp', 'poisoner', 'saint', 'empath', 'monk', 'soldier', 'mayor']);
      const { partida } = m.juego;
      partida.grimorio.cambiarVida(m.asiento('saint').id, true);
      expect(await comprobarFinal(m.ctx, { ejecutado: m.asiento('saint').id })).toBe('malvado');
      // Envenenado, no: sigue
      const indice = partida.guion.personaje('poisoner')!.recordatorios.indexOf('Poisoned');
      partida.grimorio.ponerRecordatorio(m.asiento('saint').id, { personaje: 'poisoner', indice, texto: 'Poisoned' });
      expect(await comprobarFinal(m.ctx, { ejecutado: m.asiento('saint').id })).toBeNull();
      // Muerto de otra forma (no ejecutado), tampoco
      expect(await comprobarFinal(m.ctx)).toBeNull();
    });

    it('con tres vivos, el Alcalde vivo y sin ejecución, gana el bueno', async () => {
      const m = plazaVirtual(['imp', 'poisoner', 'chef', 'empath', 'monk', 'soldier', 'mayor']);
      const { partida } = m.juego;
      for (const p of ['chef', 'empath', 'monk', 'soldier']) partida.grimorio.cambiarVida(m.asiento(p).id, true);
      expect(await comprobarFinal(m.ctx)).toBeNull();
      expect(await comprobarFinal(m.ctx, { sinEjecucion: true })).toBe('bueno');
      // Sin el Alcalde vivo, no
      const sin = plazaVirtual(['imp', 'poisoner', 'chef', 'empath', 'monk', 'soldier', 'mayor']);
      for (const p of ['empath', 'monk', 'soldier', 'mayor']) sin.juego.partida.grimorio.cambiarVida(sin.asiento(p).id, true);
      expect(await comprobarFinal(sin.ctx, { sinEjecucion: true })).toBeNull();
    });

    it('el Exterminador solo mata al demonio (o a la Reclusa si registra como tal); al Santo, no', async () => {
      /** Una plaza de día con alguien sentado en el asiento de `tirador`; dispara a `objetivo`. */
      const dispara = async (tirador: string, objetivo: string, semilla = 1) => {
        const m = plazaVirtual(['slayer', 'imp', 'saint', 'recluse', 'chef', 'empath', 'poisoner'], { semilla });
        const { sala, partida } = m.juego;
        const { id } = sala.participantes.conectar('s-t', 'c-t', invitado('Tiradora'), () => true);
        sala.sentar(id, m.asiento(tirador).id);
        partida.irANoche();
        partida.amanecer();
        const muere = await exterminar(m.ctx, id, m.asiento(objetivo).id);
        // La muerte se pone al contarlo
        const ganador = await contarDisparo(m.ctx, id, m.asiento(objetivo).id, muere);
        return { muere: muere !== null, muerto: m.asiento(objetivo).muerto, ganador, m };
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
      const m = plazaVirtual(['slayer', 'imp', 'scarletwoman', 'chef', 'empath', 'monk', 'mayor']);
      const { sala, partida } = m.juego;
      const { id } = sala.participantes.conectar('s-t', 'c-t', invitado('Tiradora'), () => true);
      sala.sentar(id, m.asiento('slayer').id);
      partida.irANoche();
      partida.amanecer();
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
      expect(await contarDisparo(m.ctx, id, chef, null)).toBeNull();
      expect(m.frases.slice(-2)).toEqual([expect.stringMatching(/ y…$/), 'La partida continúa.']);
      expect(m.asiento('chef').muerto).toBe(false);
    });

    it('la Mujer Escarlata hereda el demonio con cinco vivos o más (contando al que muere)', async () => {
      const m = plazaVirtual(['imp', 'scarletwoman', 'chef', 'empath', 'monk', 'soldier', 'mayor']);
      const { partida } = m.juego;
      partida.grimorio.cambiarVida(m.asiento('imp').id, true);
      expect(await comprobarFinal(m.ctx)).toBeNull();
      expect(m.textos('scarletwoman')).toEqual(['Is The Demon']);
      // Con pocos vivos, no: gana el bueno
      const pocos = plazaVirtual(['imp', 'scarletwoman', 'chef', 'empath', 'monk', 'soldier', 'mayor']);
      for (const p of ['empath', 'monk', 'soldier', 'imp']) pocos.juego.partida.grimorio.cambiarVida(pocos.asiento(p).id, true);
      expect(await comprobarFinal(pocos.ctx)).toBe('bueno');
    });

    it('la Mujer Escarlata que hereda pasa a ser el Imp esa noche: se le dice y despierta como el Imp', async () => {
      const m = plazaVirtual(['imp', 'scarletwoman', 'chef', 'empath', 'monk', 'soldier', 'mayor']);
      const { partida } = m.juego;
      partida.irANoche();
      await m.noche();
      partida.amanecer();
      // De día, muere el Imp: hereda
      partida.grimorio.cambiarVida(m.asiento('imp').id, true);
      expect(await comprobarFinal(m.ctx)).toBeNull();
      const escarlata = m.asiento('scarletwoman').id;
      partida.irANoche();
      await m.noche();
      const jugador = partida.plaza().find((a) => a.id === escarlata)!;
      expect(identidadDe(jugador)).toBe('imp');
      expect(m.ctx.recuerdos.cronica.antes.get(escarlata)).toBe('scarletwoman');
      // Se le dijo «Tú eres el Imp» y luego despertó como el Imp (a elegir)
      const despertados = m.despertados();
      expect(despertados.indexOf('imp')).toBeGreaterThan(despertados.indexOf('scarletwoman'));
      expect(m.hechas).toContainEqual({ accion: 'narrador:cambiarPersonaje', datos: { jugadorId: escarlata, personajeId: 'imp' } });
    });

    it('si acaba antes de esa noche, al revelar la Mujer Escarlata que ha heredado ya es el Imp', async () => {
      const m = plazaVirtual(['imp', 'scarletwoman', 'chef', 'empath', 'monk', 'soldier', 'mayor']);
      const { partida } = m.juego;
      partida.irANoche();
      partida.amanecer();
      partida.grimorio.cambiarVida(m.asiento('imp').id, true);
      expect(await comprobarFinal(m.ctx)).toBeNull();
      const escarlata = m.asiento('scarletwoman').id;
      await new Revelando('malvado').alEntrar(m.ctx);
      expect(identidadDe(partida.plaza().find((a) => a.id === escarlata)!)).toBe('imp');
      const limite = Date.now() + 3000;
      while (!m.frases.some((f) => / pasó a ser el demonio/.test(f)) && Date.now() < limite) await new Promise((r) => setTimeout(r, 5));
      // El demonio, sin su nombre
      expect(m.frases.find((f) => / pasó a ser el demonio/.test(f))).toMatch(/^.+ era scarletwoman y pasó a ser el demonio/);
    });

    it('revela el grimorio ficha a ficha, con el demonio el último', async () => {
      const m = plazaVirtual(['imp', 'poisoner', 'chef', 'empath', 'monk', 'soldier', 'mayor']);
      const { partida } = m.juego;
      partida.irANoche();
      partida.amanecer();
      await new Revelando('bueno').alEntrar(m.ctx);
      expect(partida.revelacion.revelacion()?.ganador).toBe('bueno');
      const limite = Date.now() + 3000;
      while (m.hechas.filter((h) => h.accion === 'revelacion:revelarFicha').length < 7 && Date.now() < limite) await new Promise((r) => setTimeout(r, 5));
      const orden = m.hechas.filter((h) => h.accion === 'revelacion:revelarFicha').map((h) => (h.datos as { jugadorId: string }).jugadorId);
      expect(orden).toHaveLength(7);
      expect(orden[6]).toBe(m.asiento('imp').id);
      expect(m.frases).toContain('Revelamos el grimorio.');
      // Y, revelado todo, quién gana
      while (!/buenos/.test(m.frases[m.frases.length - 1] ?? '') && Date.now() < limite) await new Promise((r) => setTimeout(r, 5));
      expect(m.frases[m.frases.length - 1]).toMatch(/buenos/);
    });

    it('el Violinista: sin demonio que conteste, elige su estrategia; todos señalan y se revela', async () => {
      const m = plazaVirtual(['imp', 'poisoner', 'chef', 'empath', 'monk', 'soldier', 'mayor']);
      const { partida } = m.juego;
      partida.irANoche();
      partida.amanecer();
      let siguiente: string | null = null;
      const ctx = { ...m.ctx, pasarA: async (e: { id: string }) => void (siguiente = e.id) };
      await new Violinista().alEntrar(ctx as typeof m.ctx);
      const limite = Date.now() + 3000;
      while (!siguiente && Date.now() < limite) await new Promise((r) => setTimeout(r, 5));
      expect(siguiente).toBe('revelando');
      const senalamiento = m.hechas.find((h) => h.accion === 'senalamiento:empezar')?.datos as { objetivos: string[] };
      expect(senalamiento.objetivos[0]).toBe(m.asiento('imp').id);
      expect(partida.grimorio.alineamiento(partida.plaza().find((a) => a.id === senalamiento.objetivos[1])!)).toBe('bueno');
    });
  });
});

describe('los privados del narrador virtual', () => {
  it('duran medio minuto por cada jugador vivo', () => {
    const m = plazaVirtual(['empath', 'imp', 'chef', 'washerwoman', 'monk', 'soldier', 'mayor']);
    const { partida } = m.juego;
    expect(duracionPrivados(m.juego)).toBe(7 * 30_000);
    partida.grimorio.cambiarVida(m.asiento('chef').id, true);
    partida.grimorio.cambiarVida(m.asiento('monk').id, true);
    expect(duracionPrivados(m.juego)).toBe(5 * 30_000);
  });

  it('el primer día dice el tiempo en minutos y medios', () => {
    expect(FRASES.primerDia(210)).toMatch(/tenéis 3 minutos y medio\.$/);
    expect(FRASES.primerDia(240)).toMatch(/tenéis 4 minutos\.$/);
    expect(FRASES.primerDia(90)).toMatch(/tenéis 1 minuto y medio\.$/);
    expect(FRASES.primerDia(30)).toMatch(/tenéis medio minuto\.$/);
  });

  it('al acabar suena el gong y, unos segundos después, se cierran', async () => {
    const m = plazaVirtual(['empath', 'imp', 'chef', 'washerwoman', 'monk', 'soldier', 'mayor']);
    const { partida } = m.juego;
    const programados: { ms: number; hacer: () => void }[] = [];
    const ctx = { ...m.ctx, temporizador: { programar: (ms: number, hacer: () => void) => (programados.push({ ms, hacer }), () => {}) } };
    await new PuestaEnComun().alEntrar(ctx);
    const acciones = () => m.hechas.map((h) => h.accion);
    expect(acciones()).toContain('reloj:sonarGong');
    expect(partida.configuracion.privadosPermitidos()).toBe(true);
    programados.find((p) => p.ms === TRAS_GONG_MS)!.hacer();
    await new Promise((r) => setTimeout(r, 0));
    expect(partida.configuracion.privadosPermitidos()).toBe(false);
    expect(acciones().indexOf('narrador:privados')).toBeGreaterThan(acciones().indexOf('reloj:sonarGong'));
  });
});

describe('droison con criterio', () => {
  const plaza = () => plazaVirtual(['empath', 'imp', 'chef', 'washerwoman', 'poisoner', 'soldier', 'mayor']);

  it('la verdad que no le cuesta nada al mal se dice más a menudo que la que lo señala', () => {
    const m = plaza();
    const empatico = m.asiento('empath').id;
    const inofensiva = probabilidadVerdad(m.juego, empatico, 'empath', numero(0), recuerdosNuevos());
    const destapa = probabilidadVerdad(m.juego, empatico, 'empath', numero(1), recuerdosNuevos());
    expect(inofensiva).toBeGreaterThanOrEqual(0.3);
    expect(destapa).toBeLessThanOrEqual(0.1);
    expect(inofensiva).toBeGreaterThan(destapa);
  });

  it('a lo mismo que otra noche, lo mismo: repite la mentira', () => {
    const m = plaza();
    const empatico = m.asiento('empath').id;
    const recuerdos = recuerdosNuevos();
    recordarDroison(recuerdos, empatico, 'empath', numero(1), numero(2));
    expect(probabilidadVerdad(m.juego, empatico, 'empath', numero(1), recuerdos)).toBeLessThanOrEqual(0.05);
    const opciones = opcionesFalsas(m.juego, empatico, 'empath', numero(1), [numero(0), numero(2)], recuerdos);
    const pesos = Object.fromEntries(opciones.map((o) => [o.valor.ficha, o.peso ?? 1]));
    expect(pesos.dos).toBeGreaterThan(pesos.cero * 5);
    // Y si entonces dijo la verdad, la vuelve a decir
    recordarDroison(recuerdos, empatico, 'empath', numero(1), numero(1));
    expect(probabilidadVerdad(m.juego, empatico, 'empath', numero(1), recuerdos)).toBeGreaterThanOrEqual(0.9);
  });

  it('las mentiras que confirman el farol que usa un malvado pesan más', () => {
    const m = plaza();
    const { partida } = m.juego;
    const envenenador = m.asiento('poisoner').id;
    partida.faroles.ponerFarolAsiento(envenenador, 0, 'monk');
    expect(partida.faroles.usarFarol(envenenador, 'monk')).toBeNull();
    const jugadores = [m.asiento('soldier').id, envenenador];
    const verdadera = tarjeta('esteJugadorEs', { jugadores, personajes: ['soldier'] });
    const falsas = ['monk', 'chef'].map((p) => tarjeta('esteJugadorEs', { jugadores, personajes: [p] }));
    const [monje, chef] = opcionesFalsas(m.juego, m.asiento('washerwoman').id, 'washerwoman', verdadera, falsas, recuerdosNuevos());
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
    const m = plazaVirtual(['empath', 'imp', 'chef', 'washerwoman', 'monk', 'soldier', 'mayor']);
    const { partida } = m.juego;
    const { decidir, preguntas } = laPrimera();
    const bolsa = (await elegirBolsa(partida.guion.actual()!.personajes, partida.bolsa.distribucion(), partida.bolsa, decidir, { azar: conSemilla(1) }))!;
    const tipos = bolsa.personajes.map((p) => partida.guion.personaje(p)?.tipo);
    expect(tipos.filter((t) => t === 'demon')).toHaveLength(1);
    expect(tipos.filter((t) => t === 'minion')).toHaveLength(1);
    expect(bolsa.personajes).toHaveLength(7);
    expect(preguntas.every((p) => p.motivo === 'bolsa')).toBe(true);
    // Lo ya elegido va en la pregunta siguiente
    expect(preguntas[1].pregunta).toMatch(/Ya en la bolsa: imp./);
  });

  it('sin grimorio: a cada hueco, los personajes del guion y las decisiones anteriores', async () => {
    const m = plazaVirtual(['empath', 'imp', 'chef', 'washerwoman', 'monk', 'soldier', 'mayor']);
    const { partida } = m.juego;
    const personajes = partida.guion.actual()!.personajes;
    const { decidir, preguntas } = laPrimera();
    await elegirBolsa(personajes, partida.bolsa.distribucion(), partida.bolsa, decidir, { azar: conSemilla(1) });
    const [primera, segunda] = preguntas;
    expect(primera.sinGrimorio).toMatchObject({ decisionesAnteriores: [] });
    expect((primera.sinGrimorio!.guion as unknown[]).length).toBe(personajes.length);
    expect(segunda.sinGrimorio!.decisionesAnteriores).toEqual([
      { pregunta: primera.pregunta, elegido: { id: 'imp', nombre: expect.any(String), tipo: 'demon' } },
    ]);
    expect(preguntas[preguntas.length - 1].sinGrimorio!.decisionesAnteriores).toHaveLength(preguntas.length - 1);
  });
});

