import { afterEach, describe, expect, it } from 'vitest';
import { ConRespaldo, FALLOS_PARA_RENDIRSE } from '../../src/services/narradorVirtual/estrategias/ConRespaldo';
import type { Decision, EstrategiaNarrador } from '../../src/services/narradorVirtual/estrategias/EstrategiaNarrador';
import { Jarvis } from '../../src/services/narradorVirtual/estrategias/Jarvis';
import type { Grimorio } from '../../src/services/narradorVirtual/grimorio';
import type { ClienteJev, PreguntaJev, RespuestaJev } from '../../src/services/narradorVirtual/puertos';
import { Arnes, type Cliente } from './arnes';
import { guionTroubleBrewing } from './guionDePrueba';

const GRIMORIO: Grimorio = { guion: 'troublebrewing', fase: { momento: 'noche', numero: 1 }, asientos: [], personajes: [], farolesDemonio: [], votaciones: [] };

const DECISION: Decision<string> = {
  motivo: 'redHerring',
  pregunta: 'El Red Herring.',
  opciones: [
    { clave: 'a1', descripcion: 'Asiento 1', valor: 'uno' },
    { clave: 'a2', descripcion: 'Asiento 2', valor: 'dos', rasgos: ['verosimil'] },
  ],
};

/** Un modelo falso: contesta lo que diga `responder` y apunta lo que le preguntan. */
function modeloFalso(responder: (questions: Record<string, PreguntaJev>) => Record<string, RespuestaJev> | Error) {
  const llamadas: { state: unknown; questions: Record<string, PreguntaJev> }[] = [];
  const cliente: ClienteJev & { comprobar(): Promise<string | null> } = {
    decidir: async (state, questions) => {
      llamadas.push({ state, questions });
      const r = responder(questions);
      if (r instanceof Error) throw r;
      return r;
    },
    comprobar: async () => null,
  };
  return { cliente, llamadas };
}

/** Un reloj que no espera. */
const sinEsperas = { programar: (_ms: number, hacer: () => void) => (setTimeout(hacer, 0), () => undefined) };

describe('Jarvis', () => {
  it('elige la opción que contesta el modelo, con el grimorio en el estado y los rasgos en la opción', async () => {
    const { cliente, llamadas } = modeloFalso(() => ({ decision: { type: 'choice', choice: 'a2' } }));
    expect(await new Jarvis(cliente).elegir(DECISION, GRIMORIO)).toBe('dos');
    const [{ state, questions }] = llamadas;
    expect(state).toMatchObject({ grimorio: GRIMORIO, decision: { motivo: 'redHerring' } });
    expect(questions.decision).toMatchObject({ type: 'choice', criteria: { a1: 'Asiento 1', a2: 'Asiento 2 [creíble]' } });
  });

  it('una opción que no existe es un fallo; con una sola opción, no pregunta', async () => {
    const { cliente, llamadas } = modeloFalso(() => ({ decision: { type: 'choice', choice: 'a9' } }));
    await expect(new Jarvis(cliente).elegir(DECISION, GRIMORIO)).rejects.toThrow();
    expect(await new Jarvis(cliente).elegir({ ...DECISION, opciones: DECISION.opciones.slice(0, 1) }, GRIMORIO)).toBe('uno');
    expect(llamadas).toHaveLength(1);
  });

  it('sin grimorio (la bolsa): manda lo que trae la decisión en su lugar', async () => {
    const { cliente, llamadas } = modeloFalso(() => ({ decision: { type: 'choice', choice: 'a1' } }));
    const sinGrimorio = { guion: [{ id: 'imp', nombre: 'Imp', tipo: 'demon' }], decisionesAnteriores: [] };
    await new Jarvis(cliente, () => undefined).elegir({ ...DECISION, motivo: 'bolsa', sinGrimorio }, GRIMORIO);
    const [{ state }] = llamadas;
    expect(state).not.toHaveProperty('grimorio');
    expect(state).toMatchObject({ decision: { motivo: 'bolsa' }, ...sinGrimorio });
  });

  it('apunta en el log la petición, la respuesta del modelo y lo que elige', async () => {
    const apuntes: string[] = [];
    const { cliente } = modeloFalso(() => ({ decision: { type: 'choice', choice: 'a2' } }));
    await new Jarvis(cliente, (t) => apuntes.push(t)).elegir(DECISION, GRIMORIO);
    expect(apuntes).toHaveLength(3);
    expect(apuntes[0]).toMatch(/^\[JARVIS\] Petición «redHerring»:\n/);
    expect(JSON.parse(apuntes[0].slice(apuntes[0].indexOf('\n') + 1))).toMatchObject({ state: { grimorio: GRIMORIO }, questions: { decision: { type: 'choice' } } });
    expect(apuntes[1]).toMatch(/^\[JARVIS\] Respuesta «redHerring»:\n/);
    expect(apuntes[1]).toContain('"choice": "a2"');
    expect(apuntes[2]).toBe('[JARVIS] Elige «redHerring»: a2 (Asiento 2).');
  });

  it('sí o no: sí con más de la mitad de probabilidad', async () => {
    const pregunta = { motivo: 'droisonVerdad' as const, pregunta: '¿Verdad?', si: 'Sí', no: 'No', probabilidad: 0.1 };
    expect(await new Jarvis(modeloFalso(() => ({ decision: { type: 'noul', noul: 0.8 } })).cliente).siONo(pregunta, GRIMORIO)).toBe(true);
    expect(await new Jarvis(modeloFalso(() => ({ decision: { type: 'noul', noul: 0.2 } })).cliente).siONo(pregunta, GRIMORIO)).toBe(false);
  });
});

describe('Jarvis con respaldo', () => {
  /** Una estrategia que elige siempre `valor` y cuenta las veces. */
  const fija = (valor: string) => {
    const e = { veces: 0 } as EstrategiaNarrador & { veces: number };
    e.elegir = async <T,>() => {
      e.veces++;
      return valor as T;
    };
    e.siONo = async () => {
      e.veces++;
      return false;
    };
    return e;
  };
  /** Una principal que falla las primeras `n` veces. */
  const fallaPrimero = (n: number) => {
    let veces = 0;
    const e = fija('principal');
    const elegir = e.elegir.bind(e);
    e.elegir = async <T,>(d: Decision<T>, g: Grimorio) => {
      if (veces++ < n) throw new Error('No contesta');
      return elegir(d, g) as Promise<T>;
    };
    return e;
  };

  it('si falla, lo reintenta; si el reintento sale bien, decide ella', async () => {
    const respaldo = fija('respaldo');
    const apuntes: string[] = [];
    const conRespaldo = new ConRespaldo(fallaPrimero(1), respaldo, sinEsperas, () => undefined, (t) => apuntes.push(t));
    expect(await conRespaldo.elegir(DECISION, GRIMORIO)).toBe('principal');
    expect(respaldo.veces).toBe(0);
    expect(apuntes).toHaveLength(1);
  });

  it('si falla dos veces, decide el respaldo; con 5 seguidas se rinde (una vez) y ya no le pregunta', async () => {
    const respaldo = fija('respaldo');
    const principal = fallaPrimero(1000);
    let rendida = 0;
    const conRespaldo = new ConRespaldo(principal, respaldo, sinEsperas, () => rendida++, () => undefined);
    for (let i = 0; i < FALLOS_PARA_RENDIRSE - 1; i++) expect(await conRespaldo.elegir(DECISION, GRIMORIO)).toBe('respaldo');
    expect(rendida).toBe(0);
    expect(await conRespaldo.elegir(DECISION, GRIMORIO)).toBe('respaldo');
    expect(rendida).toBe(1);
    expect(principal.veces).toBe(0);
    await conRespaldo.elegir(DECISION, GRIMORIO);
    expect(rendida).toBe(1);
  });

  it('un acierto entre medias vuelve a contar de cero', async () => {
    let falla = true;
    const principal = fija('principal');
    const elegir = principal.elegir.bind(principal);
    principal.elegir = async <T,>(d: Decision<T>, g: Grimorio) => {
      if (falla) throw new Error('No contesta');
      return elegir(d, g) as Promise<T>;
    };
    let rendida = 0;
    const conRespaldo = new ConRespaldo(principal, fija('respaldo'), sinEsperas, () => rendida++, () => undefined);
    for (let i = 0; i < FALLOS_PARA_RENDIRSE - 1; i++) await conRespaldo.elegir(DECISION, GRIMORIO);
    falla = false;
    await conRespaldo.elegir(DECISION, GRIMORIO);
    falla = true;
    for (let i = 0; i < FALLOS_PARA_RENDIRSE - 1; i++) await conRespaldo.elegir(DECISION, GRIMORIO);
    expect(rendida).toBe(0);
  });
});

describe('añadir a Jarvis', () => {
  let arnes: Arnes;
  afterEach(() => arnes?.cerrar());

  const tb = () => ({ ...guionTroubleBrewing(), primeraNoche: [], otrasNoches: [] });
  const JARVIS = { narrador: 'jarvis', guion: 'troublebrewing', jugadores: 7 };
  const DATOS = { endpoint: 'https://api.typesafe.ai', modelo: 'jev-latest', apiKey: 'clave' };

  /** Una sala con Jarvis: el modelo de la cuenta «ana» (si `conModelo`) y lo que conteste. */
  const sala = (opciones: { conModelo?: boolean; comprobar?: string | null; responder?: () => Record<string, RespuestaJev> | Error }) =>
    Arnes.crear({
      guiones: { guionPredeterminado: async () => tb(), importar: async () => tb() },
      relojNarradorVirtual: { programar: (ms, hacer) => ((t) => () => clearTimeout(t))(setTimeout(hacer, ms / 1000)) },
      modeloJarvisDe: async (userId) => (opciones.conModelo !== false && userId === 'ana' ? DATOS : null),
      clienteJev: () => ({
        ...modeloFalso(
          opciones.responder ??
            ((q) => {
              // Siempre la primera opción
              const p = q.decision;
              return { decision: p.type === 'choice' ? { type: 'choice', choice: Object.keys(p.criteria)[0] } : { type: 'noul', noul: 0 } };
            }),
        ).cliente,
        comprobar: async () => opciones.comprobar ?? null,
      }),
    });

  it('un invitado no puede: necesita una cuenta', async () => {
    arnes = await sala({});
    const vera = await arnes.entrar('Vera');
    expect(await arnes.intentar(vera, 'sala:anadirNarradorVirtual', JARVIS)).toEqual({ ok: false, error: 'Para añadir un narrador virtual necesitas una cuenta.' });
  });

  it('sin su modelo, o si no responde, no se añade', async () => {
    arnes = await sala({ conModelo: false });
    const ana = await arnes.entrar('Ana', { cuenta: 'ana' });
    expect((await arnes.intentar(ana, 'sala:anadirNarradorVirtual', JARVIS)).ok).toBe(false);
    await arnes.cerrar();
    arnes = await sala({ comprobar: 'La key no es válida.' });
    const otra = await arnes.entrar('Ana', { cuenta: 'ana' });
    expect(await arnes.intentar(otra, 'sala:anadirNarradorVirtual', JARVIS)).toEqual({
      ok: false,
      error: 'El modelo de Jarvis no responde: La key no es válida.',
    });
  });

  it('con su modelo, Jarvis prepara la partida eligiendo la bolsa', async () => {
    arnes = await sala({});
    const ana = await arnes.entrar('Ana', { cuenta: 'ana' });
    await arnes.accion(ana, 'sala:anadirNarradorVirtual', JARVIS);
    await ana.esperarQue((e) => e.narradorVirtual?.etapa === 'esperandoJugadores');
    expect(ana.estado.narradorVirtual?.id).toBe('jarvis');
    expect(ana.estado.participantes.find((p) => p.virtual)?.nombre).toBe('Jarvis');
  });

  it('si el modelo deja de responder del todo, Jarvis se va y sigue «Tonto y tú»', async () => {
    arnes = await sala({ responder: () => new Error('Sin respuesta') });
    const ana: Cliente = await arnes.entrar('Ana', { cuenta: 'ana' });
    const voces: string[] = [];
    ana.socket.on('sala:voz', ({ texto }: { texto: string }) => voces.push(texto));
    // Al preparar la bolsa ya decide 7 veces: a la quinta, se rinde
    await arnes.accion(ana, 'sala:anadirNarradorVirtual', JARVIS);
    await ana.esperarQue((e) => e.narradorVirtual?.id === 'tontoYTu');
    expect(ana.estado.participantes.find((p) => p.virtual)?.nombre).toBe('Tonto y tú');
    expect(voces).toContain('Jarvis tiene que irse; os dejo con Tonto y tú, que seguirá la partida.');
    // Y la partida sigue: la bolsa está llena
    await ana.esperarQue((e) => e.narradorVirtual?.etapa === 'esperandoJugadores');
  });
});
