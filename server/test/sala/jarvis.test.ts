import { afterEach, describe, expect, it } from 'vitest';
import { ConRespaldo, FALLOS_PARA_RENDIRSE } from '../../src/models/narradorVirtual/estrategias/ConRespaldo';
import type { Decision, EstrategiaNarrador } from '../../src/models/narradorVirtual/estrategias/EstrategiaNarrador';
import { Jarvis } from '../../src/models/narradorVirtual/estrategias/Jarvis';
import type { Grimorio } from '../../src/models/narradorVirtual/grimorio';
import type { NarradorIARepository } from '../../src/repositories/NarradorIARepository';
import { NarradorIAService } from '../../src/services/narradorVirtual/NarradorIAService';
import { Arnes, type Cliente } from './arnes';
import { conSemilla, guionTroubleBrewing } from './guionDePrueba';

const GRIMORIO: Grimorio = { guion: 'troublebrewing', fase: { momento: 'noche', numero: 1 }, asientos: [], personajes: [], farolesDemonio: [], votaciones: [] };

const DECISION: Decision<string> = {
  motivo: 'redHerring',
  pregunta: 'El Red Herring.',
  opciones: [
    { clave: 'a1', descripcion: 'Asiento 1', valor: 'uno' },
    { clave: 'a2', descripcion: 'Asiento 2', valor: 'dos', rasgos: ['verosimil'] },
  ],
};

interface Llamada {
  contexto: unknown;
  instrucciones: string;
  opciones?: Record<string, string>;
}

/**
 * Un modelo falso: elige lo que diga `elegir` (por defecto, la primera opción) y
 * contesta `siONo` (por defecto, que no); con `falla`, no contesta. Apunta lo que le preguntan.
 */
function modeloFalso({ elegir = (o) => Object.keys(o)[0], siONo = 0, falla = false }: { elegir?: (opciones: Record<string, string>) => string; siONo?: number; falla?: boolean } = {}) {
  const llamadas: Llamada[] = [];
  const contestar = <R,>(r: R) => {
    if (falla) throw new Error('Sin respuesta');
    return r;
  };
  const modelo: NarradorIARepository = {
    elegir: async (contexto, instrucciones, opciones) => {
      llamadas.push({ contexto, instrucciones, opciones });
      return contestar(elegir(opciones));
    },
    siONo: async (contexto, instrucciones) => {
      llamadas.push({ contexto, instrucciones });
      return contestar(siONo);
    },
    comprobar: async () => null,
  };
  return { modelo, llamadas };
}

/** Un reloj que no espera. */
const sinEsperas = { programar: (_ms: number, hacer: () => void) => (setTimeout(hacer, 0), () => undefined) };

describe('Jarvis', () => {
  it('elige la opción que contesta el modelo, con el grimorio en el contexto y los rasgos en la opción', async () => {
    const { modelo, llamadas } = modeloFalso({ elegir: () => 'a2' });
    expect(await new Jarvis(modelo, () => undefined).elegir(DECISION, GRIMORIO)).toBe('dos');
    const [{ contexto, opciones }] = llamadas;
    expect(contexto).toMatchObject({ grimorio: GRIMORIO, decision: { motivo: 'redHerring' } });
    expect(opciones).toEqual({ a1: 'Asiento 1', a2: 'Asiento 2 [creíble]' });
  });

  it('una opción que no existe es un fallo; con una sola opción, no pregunta', async () => {
    const { modelo, llamadas } = modeloFalso({ elegir: () => 'a9' });
    await expect(new Jarvis(modelo, () => undefined).elegir(DECISION, GRIMORIO)).rejects.toThrow();
    expect(await new Jarvis(modelo, () => undefined).elegir({ ...DECISION, opciones: DECISION.opciones.slice(0, 1) }, GRIMORIO)).toBe('uno');
    expect(llamadas).toHaveLength(1);
  });

  it('sin grimorio (la bolsa): manda lo que trae la decisión en su lugar', async () => {
    const { modelo, llamadas } = modeloFalso();
    const sinGrimorio = { guion: [{ id: 'imp', nombre: 'Imp', tipo: 'demon' }], decisionesAnteriores: [] };
    await new Jarvis(modelo, () => undefined).elegir({ ...DECISION, motivo: 'bolsa', sinGrimorio }, GRIMORIO);
    const [{ contexto }] = llamadas;
    expect(contexto).not.toHaveProperty('grimorio');
    expect(contexto).toMatchObject({ decision: { motivo: 'bolsa' }, ...sinGrimorio });
  });

  it('por NarradorIAService queda en el log la petición, la respuesta del modelo y lo que elige', async () => {
    const apuntes: string[] = [];
    const { modelo } = modeloFalso({ elegir: () => 'a2' });
    const apuntar = (t: string) => apuntes.push(t);
    await new Jarvis(new NarradorIAService(modelo, apuntar), apuntar).elegir(DECISION, GRIMORIO);
    expect(apuntes).toHaveLength(3);
    expect(apuntes[0]).toMatch(/^\[JARVIS\] Petición \(elegir\):\n/);
    expect(JSON.parse(apuntes[0].slice(apuntes[0].indexOf('\n') + 1))).toMatchObject({
      contexto: { grimorio: GRIMORIO },
      opciones: { a1: 'Asiento 1', a2: 'Asiento 2 [creíble]' },
    });
    expect(apuntes[1]).toBe('[JARVIS] Respuesta (elegir): "a2"');
    expect(apuntes[2]).toBe('[JARVIS] Elige «redHerring»: a2 (Asiento 2).');
  });

  it('sí o no: sí con más de la mitad de probabilidad', async () => {
    const pregunta = { motivo: 'droisonVerdad' as const, pregunta: '¿Verdad?', si: 'Sí', no: 'No', probabilidad: 0.1 };
    expect(await new Jarvis(modeloFalso({ siONo: 0.8 }).modelo, () => undefined).siONo(pregunta, GRIMORIO)).toBe(true);
    expect(await new Jarvis(modeloFalso({ siONo: 0.2 }).modelo, () => undefined).siONo(pregunta, GRIMORIO)).toBe(false);
  });
});

describe('NarradorIAService', () => {
  it('sin modelo, o si no responde, dice por qué; si responde, se usa', async () => {
    expect(await NarradorIAService.para(null)).toBe('Jarvis no está disponible en este servidor.');
    const { modelo } = modeloFalso();
    expect(await NarradorIAService.para({ ...modelo, comprobar: async () => 'La key no es válida.' })).toBe(
      'El modelo de Jarvis no responde: La key no es válida.',
    );
    expect(await NarradorIAService.para(modelo, () => undefined)).toBeInstanceOf(NarradorIAService);
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
  /** Una sala con Jarvis: el modelo de la cuenta «ana» (si `conModelo`), si responde, y si falla; con `semilla`, la bolsa sale siempre igual. */
  const sala = (opciones: { conModelo?: boolean; comprobar?: string | null; falla?: boolean; semilla?: number }) =>
    Arnes.crear({
      azar: opciones.semilla === undefined ? Math.random : conSemilla(opciones.semilla),
      guiones: { guionPredeterminado: async () => tb(), importar: async () => tb() },
      relojNarradorVirtual: { programar: (ms, hacer) => ((t) => () => clearTimeout(t))(setTimeout(hacer, ms / 1000)) },
      modelosIA: async (userId) =>
        opciones.conModelo !== false && userId === 'ana'
          ? { ...modeloFalso({ falla: opciones.falla }).modelo, comprobar: async () => opciones.comprobar ?? null }
          : null,
    });

  it('un invitado no puede: necesita una cuenta', async () => {
    arnes = await sala({});
    const vera = await arnes.entrar('Vera');
    expect(await arnes.pedir(vera, 'narradorVirtual:anadir', JARVIS)).toEqual({ ok: false, error: 'Para añadir un narrador virtual necesitas una cuenta.' });
  });

  it('sin su modelo, o si no responde, no se añade', async () => {
    arnes = await sala({ conModelo: false });
    const ana = await arnes.entrar('Ana', { cuenta: 'ana' });
    expect((await arnes.pedir(ana, 'narradorVirtual:anadir', JARVIS)).ok).toBe(false);
    await arnes.cerrar();
    arnes = await sala({ comprobar: 'La key no es válida.' });
    const otra = await arnes.entrar('Ana', { cuenta: 'ana' });
    expect(await arnes.pedir(otra, 'narradorVirtual:anadir', JARVIS)).toEqual({
      ok: false,
      error: 'El modelo de Jarvis no responde: La key no es válida.',
    });
  });

  it('con su modelo, Jarvis prepara la partida eligiendo la bolsa', async () => {
    arnes = await sala({});
    const ana = await arnes.entrar('Ana', { cuenta: 'ana' });
    await arnes.hacer(ana, 'narradorVirtual:anadir', JARVIS);
    await ana.esperarQue((e) => e.narradorVirtual?.etapa === 'esperandoJugadores');
    expect(ana.estado.narradorVirtual?.id).toBe('jarvis');
    expect(ana.estado.participantes.find((p) => p.persona.tipo === 'virtual')?.nombre).toBe('Jarvis');
  });

  it('si el modelo deja de responder del todo, Jarvis se va y sigue «Tonto y tú»', async () => {
    arnes = await sala({ falla: true, semilla: 2 });
    const ana: Cliente = await arnes.entrar('Ana', { cuenta: 'ana' });
    const voces: string[] = [];
    ana.socket.on('sala:voz', ({ texto }: { texto: string }) => voces.push(texto));
    // Al preparar la bolsa ya decide 7 veces, pero las de una sola opción no se le preguntan (y cuentan como
    // acierto): con esta semilla le pregunta al menos 5 seguidas, y a la quinta se rinde
    await arnes.hacer(ana, 'narradorVirtual:anadir', JARVIS);
    await ana.esperarQue((e) => e.narradorVirtual?.id === 'tontoYTu');
    expect(ana.estado.participantes.find((p) => p.persona.tipo === 'virtual')).toMatchObject({ nombre: 'Tonto y tú', avatar: '/narradores/tonto-y-tu.webp' });
    expect(voces).toContain('Jarvis tiene que irse; os dejo con Tonto y tú, que seguirá la partida.');
    // Y la partida sigue: la bolsa está llena
    await ana.esperarQue((e) => e.narradorVirtual?.etapa === 'esperandoJugadores');
  });
});
