import { describe, expect, it } from 'vitest';
import { leerConfigJev } from '../src/config/jev';
import { NarradorJevRepository } from '../src/repositories/NarradorJevRepository';

const CONFIG = { endpoint: 'https://api.typesafe.ai', modelo: 'jev-latest', apiKey: 'clave' };

/** Un fetch falso: contesta con ese estado y cuerpo, y apunta lo que se le pide. */
function fetchFalso(estado: number, cuerpo: unknown) {
  const pedidos: { url: string; init: RequestInit }[] = [];
  const hacerFetch = (async (url: string, init: RequestInit) => {
    pedidos.push({ url, init });
    return new Response(JSON.stringify(cuerpo), { status: estado });
  }) as unknown as typeof fetch;
  return { hacerFetch, pedidos };
}

describe('NarradorJevRepository', () => {
  it('elegir: manda una pregunta «choice» con las opciones como criterios y devuelve la clave', async () => {
    const { hacerFetch, pedidos } = fetchFalso(200, { answers: { decision: { type: 'choice', choice: 'a2', confidence: 0.9 } } });
    const jev = new NarradorJevRepository(CONFIG, hacerFetch);
    expect(await jev.elegir({ grimorio: 'x' }, 'Elige bien.', { a1: 'Uno', a2: 'Dos' })).toBe('a2');
    const [{ url, init }] = pedidos;
    expect(url).toBe('https://api.typesafe.ai/v1/systemone');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer clave' });
    expect(JSON.parse(init.body as string)).toEqual({
      model: 'jev-latest',
      state: { grimorio: 'x' },
      questions: { decision: { type: 'choice', instructions: 'Elige bien.', criteria: { a1: 'Uno', a2: 'Dos' } } },
    });
  });

  it('sí o no: manda una pregunta «noul» y devuelve la probabilidad de sí', async () => {
    const { hacerFetch, pedidos } = fetchFalso(200, { answers: { decision: { type: 'noul', noul: 0.7 } } });
    expect(await new NarradorJevRepository(CONFIG, hacerFetch).siONo({}, '¿Sí?', 'Sí', 'No')).toBe(0.7);
    expect(JSON.parse(pedidos[0].init.body as string).questions.decision).toEqual({ type: 'noul', instructions: '¿Sí?', criteria: { true: 'Sí', false: 'No' } });
  });

  it('los errores, en palabras', async () => {
    const con = (estado: number, cuerpo: unknown) => new NarradorJevRepository(CONFIG, fetchFalso(estado, cuerpo).hacerFetch);
    await expect(con(401, {}).elegir({}, '', { a: 'A' })).rejects.toThrow('La key no es válida.');
    await expect(con(404, {}).elegir({}, '', { a: 'A' })).rejects.toThrow('No se encuentra la API');
    await expect(con(422, { detail: [{ msg: 'falta model' }] }).elegir({}, '', { a: 'A' })).rejects.toThrow('(422): falta model');
    await expect(con(200, {}).elegir({}, '', { a: 'A' })).rejects.toThrow('no se entiende');
    await expect(con(200, { answers: { decision: { type: 'noul', noul: 1 } } }).elegir({}, '', { a: 'A' })).rejects.toThrow('no se entiende');
    const sinRed = new NarradorJevRepository(CONFIG, (async () => Promise.reject(new Error('ECONNREFUSED'))) as unknown as typeof fetch);
    await expect(sinRed.siONo({}, '', 'Sí', 'No')).rejects.toThrow('No se puede llegar al modelo: ECONNREFUSED');
  });

  it('comprobar: null si responde, o el error en palabras', async () => {
    expect(await new NarradorJevRepository(CONFIG, fetchFalso(200, { answers: { decision: { type: 'noul', noul: 1 } } }).hacerFetch).comprobar()).toBeNull();
    expect(await new NarradorJevRepository(CONFIG, fetchFalso(401, {}).hacerFetch).comprobar()).toBe('La key no es válida.');
  });
});

describe('leerConfigJev', () => {
  it('sin key no hay modelo; el endpoint vale con la ruta entera', () => {
    expect(leerConfigJev({})).toBeNull();
    expect(leerConfigJev({ JEV_API_KEY: ' k ', JEV_ENDPOINT: 'https://otro.ai/v1/systemone/' })).toEqual({
      endpoint: 'https://otro.ai',
      modelo: 'jev-latest',
      apiKey: 'k',
    });
  });
});
