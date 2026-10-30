import { afterEach, describe, expect, it, vi } from 'vitest';
import { FRASES } from '../../src/services/narradorVirtual/frases';
import { Arnes, type Cliente } from './arnes';
import { guionTroubleBrewing } from './guionDePrueba';

/** Trouble Brewing con su hoja de noche de verdad. */
const tb = () => ({
  ...guionTroubleBrewing(),
  primeraNoche: ['poisoner', 'spy', 'washerwoman', 'librarian', 'investigator', 'chef', 'empath', 'fortuneteller', 'butler'],
  otrasNoches: ['poisoner', 'monk', 'scarletwoman', 'imp', 'ravenkeeper', 'undertaker', 'empath', 'fortuneteller', 'butler', 'spy'],
});

/** El reloj del narrador virtual, mil veces más rápido (un minuto, 60 ms; las esperas de la noche, casi nada). */
const sinEsperas = {
  programar: (ms: number, hacer: () => void) => {
    const t = setTimeout(hacer, ms / 1000);
    return () => clearTimeout(t);
  },
};

const conTroubleBrewing = () =>
  Arnes.crear({ guiones: { guionPredeterminado: async () => tb(), importar: async () => tb() }, relojNarradorVirtual: sinEsperas });

const TONTO = { narrador: 'tontoYTu', guion: 'troublebrewing', jugadores: 7 };

describe('narrador virtual', () => {
  let arnes: Arnes;
  afterEach(() => arnes?.cerrar());

  /** Entran `n` usuarios con cuenta (Jugador1, Jugador2…). */
  const entran = async (n: number): Promise<Cliente[]> => {
    const clientes: Cliente[] = [];
    for (let i = 1; i <= n; i++) clientes.push(await arnes.entrar(`Jugador${i}`, { cuenta: `jugador${i}` }));
    return clientes;
  };

  it('quien no es narrador lo añade: prepara los asientos, el guion, el grimorio de los jugadores y la bolsa', async () => {
    arnes = await conTroubleBrewing();
    const [ana] = await entran(1);
    expect(ana.estado.acciones).toContain('sala:anadirNarradorVirtual');
    await arnes.accion(ana, 'sala:anadirNarradorVirtual', TONTO);
    await ana.esperarQue((e) => e.narradorVirtual?.etapa === 'esperandoJugadores');
    const { narradorVirtual, participantes, asientos, configuracion } = ana.estado;
    expect(narradorVirtual).toMatchObject({ id: 'tontoYTu', creador: ana.id, jugadores: 7, guion: 'troublebrewing' });
    expect(participantes.find((p) => p.id === narradorVirtual!.participante)).toMatchObject({ rol: 'narrador', virtual: 'tontoYTu', nombre: 'Tonto y tú', avatar: '/narradores/tonto-y-tu.webp', conectado: true });
    expect(asientos).toHaveLength(7);
    expect(configuracion.grimorioJugadores).toBe(true);
    // Ya hay narrador: nadie más puede hacerse narrador ni añadir otro
    expect(ana.estado.acciones).not.toContain('sala:hacerseNarrador');
    expect(ana.estado.acciones).not.toContain('sala:anadirNarradorVirtual');
  });

  it('un invitado no puede añadirlo: necesita una cuenta', async () => {
    arnes = await conTroubleBrewing();
    const vera = await arnes.entrar('Vera');
    expect(vera.estado.acciones).not.toContain('sala:anadirNarradorVirtual');
    expect(await arnes.intentar(vera, 'sala:anadirNarradorVirtual', TONTO)).toEqual({ ok: false, error: 'Para añadir un narrador virtual necesitas una cuenta.' });
  });

  it('no deja elegir a Jarvis ni un número de jugadores fuera de 7 a 15', async () => {
    arnes = await conTroubleBrewing();
    const [ana] = await entran(1);
    expect((await arnes.intentar(ana, 'sala:anadirNarradorVirtual', { ...TONTO, narrador: 'jarvis' })).ok).toBe(false);
    expect((await arnes.intentar(ana, 'sala:anadirNarradorVirtual', { ...TONTO, jugadores: 6 })).ok).toBe(false);
    expect((await arnes.intentar(ana, 'sala:anadirNarradorVirtual', { ...TONTO, jugadores: 16 })).ok).toBe(false);
    expect((await arnes.intentar(ana, 'sala:anadirNarradorVirtual', { ...TONTO, guion: 'badmoonrising' })).ok).toBe(false);
  });

  it('solo quien lo añadió puede quitarlo', async () => {
    arnes = await conTroubleBrewing();
    const [ana, bea] = await entran(2);
    await arnes.accion(ana, 'sala:anadirNarradorVirtual', TONTO);
    await bea.esperarQue((e) => !!e.narradorVirtual);
    expect(bea.estado.acciones).not.toContain('sala:quitarNarradorVirtual');
    expect((await arnes.intentar(bea, 'sala:quitarNarradorVirtual')).ok).toBe(false);
    await arnes.accion(ana, 'sala:quitarNarradorVirtual');
    expect(ana.estado.narradorVirtual).toBeNull();
    expect(ana.estado.participantes.some((p) => p.virtual)).toBe(false);
    expect(ana.estado.acciones).toContain('sala:hacerseNarrador');
  });

  it('a un visitante que pide ver el grimorio se lo concede al momento', async () => {
    arnes = await conTroubleBrewing();
    const [ana, vera] = await entran(2);
    await arnes.accion(ana, 'sala:anadirNarradorVirtual', TONTO);
    await vera.esperarQue((e) => e.acciones.includes('sala:solicitarGrimorio'));
    await arnes.accion(vera, 'sala:solicitarGrimorio');
    await vera.esperarQue((e) => e.participantes.find((p) => p.id === vera.id)?.accesoGrimorio === 'concedido');
    expect(vera.estado.acciones).not.toContain('sala:sentarse');
  });

  it('con narrador virtual no se puede quitar el grimorio de los jugadores', async () => {
    arnes = await conTroubleBrewing();
    const [ana] = await entran(1);
    await arnes.accion(ana, 'sala:anadirNarradorVirtual', TONTO);
    await ana.esperarQue((e) => e.configuracion.grimorioJugadores);
    expect(ana.estado.acciones).not.toContain('narrador:configurarPartida');
  });

  it('al añadirlo saluda con una de sus frases de saludo', async () => {
    arnes = await conTroubleBrewing();
    const [ana] = await entran(1);
    const voces: string[] = [];
    ana.socket.on('sala:voz', ({ texto }: { texto: string }) => voces.push(texto));
    await arnes.accion(ana, 'sala:anadirNarradorVirtual', TONTO);
    await ana.esperarQue((e) => e.narradorVirtual?.etapa === 'esperandoJugadores' && !!e.narradorVirtual.frase);
    const frase = ana.estado.narradorVirtual!.frase!;
    expect(Array.from({ length: 6 }, (_, i) => FRASES.saludo(() => i / 6))).toContain(frase);
    await vi.waitFor(() => expect(voces).toContain(frase));
  });

  it('al llenarse la mesa reparte los personajes y empieza la primera noche', async () => {
    arnes = await conTroubleBrewing();
    const jugadores = await entran(7);
    const [ana] = jugadores;
    const voces: string[] = [];
    ana.socket.on('sala:voz', ({ texto }: { texto: string }) => voces.push(texto));
    await arnes.accion(ana, 'sala:anadirNarradorVirtual', TONTO);
    await ana.esperarQue((e) => e.narradorVirtual?.etapa === 'esperandoJugadores');
    for (const [i, c] of jugadores.entries()) {
      await arnes.accion(c, 'sala:sentarse', { asientoId: c.estado.asientos[i].id });
    }
    await ana.esperarQue((e) => e.narradorVirtual?.etapa === 'noche');
    expect(ana.estado.fase).toMatchObject({ momento: 'noche', numero: 1 });
    expect(ana.estado.narradorVirtual?.frase).toBe('Noche uno, nos vamos a dormir.');
    expect(voces).toContain('Noche uno, nos vamos a dormir.');
    // Cada uno sabe su personaje (el grimorio de los jugadores, con su ficha)
    for (const c of jugadores) await c.esperarQue((e) => !!e.asientos.find((a) => a.ocupante === e.yo)?.personaje);
  });

  it('la primera noche, cada jugador elige lo suyo y amanece con los buenos días', async () => {
    arnes = await conTroubleBrewing();
    const jugadores = await entran(7);
    const [ana] = jugadores;
    await arnes.accion(ana, 'sala:anadirNarradorVirtual', TONTO);
    await ana.esperarQue((e) => e.narradorVirtual?.etapa === 'esperandoJugadores');
    for (const [i, c] of jugadores.entries()) await arnes.accion(c, 'sala:sentarse', { asientoId: c.estado.asientos[i].id });
    // Cada uno contesta, cuando se le pide, con quien le deja su habilidad
    let amanecido = false;
    // Lo que le ha mandado el narrador a cada uno (de día, los despertares ya no se ven)
    const recibido = new Map<Cliente, { tarjeta: string | null; personajes: string[]; jugadores: string[] }[]>();
    const contestar = async (c: Cliente) => {
      while (!amanecido) {
        const mensajes = c.estado.despertares[0]?.mensajes.filter((m) => m.autor === 'narrador') ?? [];
        if (mensajes.length) recibido.set(c, mensajes);
        const ultimo = c.estado.despertares[0]?.mensajes.slice(-1)[0];
        if (ultimo?.autor === 'narrador' && ultimo.eleccion) {
          const { cantidad, puedeElegirse } = ultimo.eleccion;
          const jugadoresElegidos = c.estado.asientos.filter((a) => puedeElegirse || a.ocupante !== c.id).slice(0, cantidad).map((a) => a.id);
          await arnes.intentar(c, 'despertar:enviar', { ficha: 'jugador', jugadores: jugadoresElegidos });
        } else if (ultimo?.autor === 'narrador') {
          await arnes.intentar(c, 'despertar:enviar', { ficha: 'entendido' });
        }
        await new Promise((r) => setTimeout(r, 20));
      }
    };
    const contestando = jugadores.map(contestar);
    await ana.esperarQue((e) => e.narradorVirtual?.etapa === 'privados', 5000);
    amanecido = true;
    await Promise.all(contestando);
    expect(ana.estado.fase).toMatchObject({ momento: 'dia', numero: 1 });
    expect(ana.estado.narradorVirtual?.frase).toMatch(/^Buenos días plaza/);
    // El demonio supo quiénes son sus esbirros y tres faroles que no están en juego
    const enJuego = new Set(jugadores.map((c) => c.miAsiento?.personaje));
    const demonio = jugadores.find((c) => c.miAsiento?.personaje === 'imp')!;
    const faroles = recibido.get(demonio)?.find((m) => m.tarjeta === 'noEnJuego')?.personajes ?? [];
    expect(faroles).toHaveLength(3);
    for (const f of faroles) expect(enJuego.has(f)).toBe(false);
    // Y el esbirro, quién es el demonio
    const esbirro = jugadores.find((c) => ['poisoner', 'spy', 'scarletwoman'].includes(c.miAsiento?.personaje ?? ''))!;
    expect(recibido.get(esbirro)?.find((m) => m.tarjeta === 'demonio')?.jugadores).toEqual([demonio.miAsiento!.id]);
  });

  it('no amanece hasta que todos los despertados dicen «Entendido»', async () => {
    arnes = await conTroubleBrewing();
    const jugadores = await entran(7);
    const [ana] = jugadores;
    await arnes.accion(ana, 'sala:anadirNarradorVirtual', TONTO);
    await ana.esperarQue((e) => e.narradorVirtual?.etapa === 'esperandoJugadores');
    for (const [i, c] of jugadores.entries()) await arnes.accion(c, 'sala:sentarse', { asientoId: c.estado.asientos[i].id });
    // Solo eligen (nadie dice «Entendido»)
    let seguir = true;
    const elegir = async (c: Cliente) => {
      while (seguir) {
        const ultimo = c.estado.despertares[0]?.mensajes.slice(-1)[0];
        if (ultimo?.autor === 'narrador' && ultimo.eleccion) {
          const { cantidad, puedeElegirse } = ultimo.eleccion;
          const elegidos = c.estado.asientos.filter((a) => puedeElegirse || a.ocupante !== c.id).slice(0, cantidad).map((a) => a.id);
          await arnes.intentar(c, 'despertar:enviar', { ficha: 'jugador', jugadores: elegidos });
        }
        await new Promise((r) => setTimeout(r, 20));
      }
    };
    const eligiendo = jugadores.map(elegir);
    await new Promise((r) => setTimeout(r, 1500));
    expect(ana.estado.fase.momento).toBe('noche');
    // Pasado el minuto, a quien no lo ha dicho se le escribe (y suena el gong); sigue
    // siendo guiado: solo contesta «Entendido» o un texto
    const ultimoDe = (c: Cliente) => c.estado.despertares[0]?.mensajes.slice(-1)[0];
    const recordado = jugadores.find((c) => ultimoDe(c)?.ficha === 'personalizado')!;
    expect(ultimoDe(recordado)).toMatchObject({
      autor: 'narrador',
      texto: 'Envía «Entendido» para saber que has visto el wake de noche.',
      guiado: true,
    });
    expect(ana.estado.gong).not.toBeNull();
    // A quien eligió y el narrador contestó «Entendido» (el Envenenador, el demonio…) no se le pide nada
    for (const c of jugadores) {
      const mensajes = c.estado.despertares[0]?.mensajes ?? [];
      const contestado = mensajes.some((m, i) => m.autor === 'narrador' && m.ficha === 'entendido' && i === mensajes.length - 1);
      if (contestado) expect(mensajes.some((m) => m.texto === 'Envía «Entendido» para saber que has visto el wake de noche.')).toBe(false);
    }
    seguir = false;
    await Promise.all(eligiendo);
    // Al contestar los que faltan, amanece
    const faltan = jugadores.filter((c) => ultimoDe(c)?.autor === 'narrador' && ultimoDe(c)?.ficha !== 'entendido');
    expect(faltan.length).toBeGreaterThan(0);
    // Visto lo primero, a algunos aún les queda (el Envenenador elige; el demonio ve sus
    // faroles): se contesta a todo hasta que amanece
    for (let vuelta = 0; vuelta < 200 && ana.estado.fase.momento === 'noche'; vuelta++) {
      for (const c of jugadores) {
        const ultimo = ultimoDe(c);
        if (ultimo?.autor !== 'narrador' || ultimo.ficha === 'entendido') continue;
        if (ultimo.eleccion) {
          const { cantidad, puedeElegirse } = ultimo.eleccion;
          const elegidos = c.estado.asientos.filter((a) => puedeElegirse || a.ocupante !== c.id).slice(0, cantidad).map((a) => a.id);
          await arnes.intentar(c, 'despertar:enviar', { ficha: 'jugador', jugadores: elegidos });
        } else await arnes.intentar(c, 'despertar:enviar', { ficha: 'entendido' });
      }
      await new Promise((r) => setTimeout(r, 20));
    }
    await ana.esperarQue((e) => e.fase.momento === 'dia', 5000);
  });

  /** Prepara una partida de 7 con narrador virtual y juega la primera noche (cada uno elige lo suyo). Devuelve los jugadores. */
  const hastaElDia = async () => {
    arnes = await conTroubleBrewing();
    const jugadores = await entran(7);
    const [ana] = jugadores;
    await arnes.accion(ana, 'sala:anadirNarradorVirtual', TONTO);
    await ana.esperarQue((e) => e.narradorVirtual?.etapa === 'esperandoJugadores');
    for (const [i, c] of jugadores.entries()) await arnes.accion(c, 'sala:sentarse', { asientoId: c.estado.asientos[i].id });
    let seguir = true;
    const contestar = async (c: Cliente) => {
      while (seguir) {
        const ultimo = c.estado.despertares[0]?.mensajes.slice(-1)[0];
        if (ultimo?.autor === 'narrador' && ultimo.eleccion) {
          const { cantidad, puedeElegirse } = ultimo.eleccion;
          const elegidos = c.estado.asientos.filter((a) => puedeElegirse || a.ocupante !== c.id).slice(0, cantidad).map((a) => a.id);
          await arnes.intentar(c, 'despertar:enviar', { ficha: 'jugador', jugadores: elegidos });
        } else if (ultimo?.autor === 'narrador') {
          await arnes.intentar(c, 'despertar:enviar', { ficha: 'entendido' });
        }
        await new Promise((r) => setTimeout(r, 20));
      }
    };
    const contestando = jugadores.map(contestar);
    // Sin esperas, los privados y la puesta en común pasan enseguida
    await ana.esperarQue((e) => e.narradorVirtual?.etapa === 'nominaciones', 5000);
    seguir = false;
    await Promise.all(contestando);
    return jugadores;
  };

  it('de día: nomina, acusa con la palabra, se defiende, se vota y se marca; todos listos, se ejecuta y anochece', async () => {
    const jugadores = await hastaElDia();
    const [ana] = jugadores;
    // La nominada no es la Virgen (ejecutaría a Ana al momento) ni el Santo (al ejecutarlo
    // se acaba): Bea; y otra más, Carla
    const resto = jugadores.slice(1);
    const bea = resto.find((c) => !['virgin', 'saint'].includes(c.miAsiento?.personaje ?? ''))!;
    const carla = resto.find((c) => c !== bea)!;
    const voces: string[] = [];
    ana.socket.on('sala:voz', ({ texto }: { texto: string }) => voces.push(texto));
    expect(ana.estado.acciones).toContain('jugador:nominar');
    const asientoDe = (c: Cliente) => c.miAsiento!.id;

    await arnes.accion(ana, 'jugador:nominar', { asientoId: asientoDe(bea) });
    await ana.esperarQue((e) => e.narradorVirtual?.turno === 'acusacion');
    expect(ana.estado.palabra).toBe(ana.id);
    expect(voces).toContain(`Jugador1 nomina a ${bea.nombre}, acusación Jugador1.`);
    // Solo quien nomina pasa a la defensa; nadie más nomina mientras tanto
    expect((await arnes.intentar(bea, 'jugador:defensa')).ok).toBe(false);
    expect((await arnes.intentar(carla, 'jugador:nominar', { asientoId: asientoDe(ana) })).ok).toBe(false);
    // Quien ha nominado ya está listo, y no puede volver
    expect(ana.estado.narradorVirtual?.listos).toContain(ana.id);
    expect(ana.estado.acciones).not.toContain('jugador:seguirNominando');

    await arnes.accion(ana, 'jugador:defensa');
    await bea.esperarQue((e) => e.narradorVirtual?.turno === 'defensa');
    expect(bea.estado.palabra).toBe(bea.id);
    await arnes.accion(bea, 'jugador:voto');
    await bea.esperarQue((e) => e.narradorVirtual?.turno === 'votacion');
    expect(bea.estado.palabra).toBeNull();
    expect(voces).toContain(`Hacen falta 4 votos para marcar a ${bea.nombre}.`);
    // Votan todos
    await bea.esperarQue((e) => !!e.nominacion?.votacion, 6000);
    for (const c of jugadores) await arnes.intentar(c, 'sala:levantarMano', { levantada: true });
    await bea.esperarQue((e) => !e.nominacion && !!e.asientos.find((a) => a.id === asientoDe(bea))?.marcado, 15000);

    // A Bea ya no se le puede volver a nominar hoy; los demás dicen que están listos
    expect((await arnes.intentar(carla, 'jugador:nominar', { asientoId: asientoDe(bea) })).ok).toBe(false);
    // Ejecutado el demonio se acaba, salvo que lo herede la Mujer Escarlata
    const eraElDemonio = bea.miAsiento!.personaje === 'imp' && !jugadores.some((c) => c.miAsiento?.personaje === 'scarletwoman');
    for (const c of resto) await arnes.accion(c, 'jugador:listo');
    // Si era el demonio, se acaba la partida y se revela; si no, a la noche
    await ana.esperarQue((e) => e.narradorVirtual?.etapa === (eraElDemonio ? 'revelando' : 'noche'));
    expect(ana.estado.asientos.find((a) => a.id === asientoDe(bea))?.muerto).toBe(true);
    expect(voces).toContain(`${bea.nombre} es ejecutada y muere…`);
    expect(voces).toContain(eraElDemonio ? 'Y revelamos el grimorio.' : 'Y nos vamos a la noche.');
    if (eraElDemonio) expect(ana.estado.revelacion?.ganador).toBe('bueno');
  }, 30_000);

  it('sin nadie marcado, todos listos: nadie es ejecutado y anochece', async () => {
    const jugadores = await hastaElDia();
    const [ana] = jugadores;
    for (const c of jugadores) await arnes.accion(c, 'jugador:listo');
    await ana.esperarQue((e) => e.narradorVirtual?.etapa === 'noche');
    expect(ana.estado.narradorVirtual?.frase).toBe('Y nos vamos a la noche.');
    // «Seguir nominando» deshace el listo (antes de que lo estén todos)
  });

  it('«Seguir nominando» quita el listo; nadie puede disparar dos veces', async () => {
    const jugadores = await hastaElDia();
    const [ana, bea] = jugadores;
    await arnes.accion(ana, 'jugador:listo');
    expect(ana.estado.narradorVirtual?.listos).toContain(ana.id);
    await arnes.accion(ana, 'jugador:seguirNominando');
    expect(ana.estado.narradorVirtual?.listos).not.toContain(ana.id);
    await arnes.accion(ana, 'jugador:exterminar', { asientoId: bea.miAsiento!.id });
    expect(ana.estado.narradorVirtual?.exterminadores).toContain(ana.id);
    // Lo cuenta con pausas y acaba en que la partida continúa o, si era el demonio, en el grimorio
    await ana.esperarQue((e) => e.narradorVirtual?.frase === 'La partida continúa.' || e.narradorVirtual?.etapa === 'revelando', 5000);
    expect((await arnes.intentar(ana, 'jugador:exterminar', { asientoId: bea.miAsiento!.id })).ok).toBe(false);
  });

  it('si alguien se va en plena partida y nadie ocupa su asiento, se acaba (Violinista o, sin demonio, gana el bueno)', async () => {
    const jugadores = await hastaElDia();
    const [ana, bea] = jugadores;
    const seVa = bea.miAsiento!.personaje === 'imp' ? jugadores[2] : bea;
    seVa.socket.disconnect();
    arnes.clientes.splice(arnes.clientes.indexOf(seVa), 1);
    await ana.esperarQue((e) => ['violinista', 'revelando'].includes(e.narradorVirtual?.etapa ?? ''), 5000);
    expect(ana.estado.narradorVirtual?.etapa).toBe('violinista');
  });

  it('se va solo cuando no queda nadie en la sala', async () => {
    arnes = await conTroubleBrewing();
    const [ana, bea] = await entran(2);
    await arnes.accion(ana, 'sala:anadirNarradorVirtual', TONTO);
    await bea.esperarQue((e) => !!e.narradorVirtual);
    ana.socket.disconnect();
    bea.socket.disconnect();
    arnes.clientes.length = 0;
    // Al irse todos, se va: quien entre después ya no lo encuentra
    await new Promise((r) => setTimeout(r, 100));
    const carla = await arnes.entrar('Carla');
    expect(carla.estado.narradorVirtual).toBeNull();
    expect(carla.estado.participantes.some((p) => p.virtual)).toBe(false);
  });
});

describe('narrador virtual: la Virgen', () => {
  it('dice quién nomina a quién al ejecutar a quien nomina a la Virgen', () => {
    expect(FRASES.virgen('Pepa', 'Teresa')).toBe('Pepa nomina a Teresa y es ejecutada…');
  });
});

describe('narrador virtual: lo que cuenta al revelar el grimorio', () => {
  const nadie = { creia: null, noches: [], muerte: null, sinMasInformacion: false };
  /** Una noche: lo que eligió y lo que recibió. */
  const noche = (n: number, { eligio = [] as string[], infos = [] as { que: string; falsa: boolean }[], envenenado = false } = {}) => ({
    noche: n,
    eligio,
    infos,
    envenenado,
  });

  it('quién era, lo que recibió y cómo murió', () => {
    expect(
      FRASES.alRevelar({
        ...nadie,
        nombre: 'Pepe',
        personaje: 'Chef',
        noches: [noche(1, { infos: [{ que: 'un 1', falsa: false }] })],
        muerte: { momento: 'dia', numero: 2, causa: 'ejecucion' },
      }),
    ).toBe('Pepe era Chef, recibió un 1 y murió en la ejecución del segundo día.');
  });

  it('a quien mató el demonio y despertaba cada noche: dejó de recibir su información', () => {
    expect(
      FRASES.alRevelar({
        ...nadie,
        nombre: 'Luis',
        personaje: 'Adivino',
        noches: [noche(1, { infos: [{ que: 'un no', falsa: false }] })],
        muerte: { momento: 'noche', numero: 2, causa: 'demonio' },
        sinMasInformacion: true,
      }),
    ).toBe('Luis era Adivino, recibió un no, murió a manos del demonio la segunda noche y ya no recibió más su información.');
  });

  it('el Borracho: lo que creía ser y, por noches, lo que recibió (y si era mentira)', () => {
    expect(FRASES.alRevelar({ ...nadie, nombre: 'Juan', personaje: 'Borracho', creia: 'Bibliotecario' })).toBe(
      'Juan creía que era Bibliotecario, pero en realidad era Borracho.',
    );
    expect(
      FRASES.alRevelar({
        ...nadie,
        nombre: 'Juan',
        personaje: 'Borracho',
        creia: 'Empático',
        noches: [noche(1, { infos: [{ que: 'un 0', falsa: false }] }), noche(2, { infos: [{ que: 'un 2', falsa: true }] })],
      }),
    ).toBe('Juan creía que era Empático, pero en realidad era Borracho. Recibió un 0 la primera noche y un 2 (era mentira) la segunda noche.');
  });

  it('lo que eligió cada noche y si estaba envenenado (y, si recibió algo, si era verdad)', () => {
    expect(
      FRASES.alRevelar({
        ...nadie,
        nombre: 'Ana',
        personaje: 'Monje',
        noches: [noche(2, { eligio: ['a Bea'] }), noche(3, { eligio: ['a Luis'], envenenado: true })],
      }),
    ).toBe('Ana era Monje, eligió a Bea la segunda noche y a Luis la tercera noche (envenenado).');
    expect(
      FRASES.alRevelar({
        ...nadie,
        nombre: 'Eva',
        personaje: 'Pitonisa',
        noches: [
          noche(1, { eligio: ['a Ana y a Bea'], infos: [{ que: 'un no', falsa: false }] }),
          noche(2, { eligio: ['a Luis y a Ana'], infos: [{ que: 'un sí', falsa: false }], envenenado: true }),
          noche(3, { eligio: ['a Bea y a Luis'], infos: [{ que: 'un sí', falsa: true }], envenenado: true }),
        ],
      }),
    ).toBe(
      'Eva era Pitonisa, eligió a Ana y a Bea y recibió un no la primera noche; eligió a Luis y a Ana y recibió un sí la segunda noche (envenenado, pero era verdad); eligió a Bea y a Luis y recibió un sí (era mentira) la tercera noche (envenenado).',
    );
  });

  it('al acabar, quién gana: varias frases, la favorita la más a menudo', () => {
    const veces = new Map<string, number>();
    for (let i = 0; i < 400; i++) {
      const frase = FRASES.gana('bueno', Math.random);
      veces.set(frase, (veces.get(frase) ?? 0) + 1);
    }
    expect(veces.size).toBeGreaterThan(2);
    expect(Math.max(...veces.values())).toBe(veces.get('Felicidades al equipo de los buenos.'));
    expect(FRASES.gana('malvado', () => 0)).toBe('Felicidades al equipo de los malos.');
    expect(FRASES.gana('malvado', () => 0.99)).toMatch(/malos/);
  });
});
