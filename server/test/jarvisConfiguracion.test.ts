import type { Response } from 'express';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { JarvisConfiguracionController } from '../src/controllers/JarvisConfiguracionController';
import type { AuthRequest } from '../src/middlewares/auth';
import type { ConfiguracionJarvis, JarvisConfiguracionRepository } from '../src/repositories/JarvisConfiguracionRepository';
import { cifrar, descifrar } from '../src/utils/cifrado';

const ANTES = process.env.JARVIS_CIFRADO_KEY;
beforeEach(() => {
  process.env.JARVIS_CIFRADO_KEY = 'clave de pruebas';
});
afterEach(() => {
  process.env.JARVIS_CIFRADO_KEY = ANTES;
});

describe('el cifrado de las keys', () => {
  it('se descifra con la misma clave, no con otra, y no se lee en claro', () => {
    const cifrado = cifrar('ts-secreta-1234');
    expect(cifrado).not.toContain('secreta');
    expect(descifrar(cifrado)).toBe('ts-secreta-1234');
    process.env.JARVIS_CIFRADO_KEY = 'otra clave';
    expect(descifrar(cifrado)).toBeNull();
  });

  it('sin clave en el entorno, no se cifra', () => {
    delete process.env.JARVIS_CIFRADO_KEY;
    expect(() => cifrar('algo')).toThrow();
  });
});

describe('la configuración de Jarvis', () => {
  /** Un repositorio en memoria (sin cifrar: eso es cosa del de verdad). */
  const repo = () => {
    const filas = new Map<string, ConfiguracionJarvis>();
    return {
      get: async (u: string) => filas.get(u) ?? null,
      set: async (u: string, c: Omit<ConfiguracionJarvis, 'comprobadoEn'>) => void filas.set(u, { ...c, comprobadoEn: null }),
      marcarComprobado: async (u: string, f: string | null) => {
        const c = filas.get(u);
        if (c) filas.set(u, { ...c, comprobadoEn: f });
      },
      borrar: async (u: string) => void filas.delete(u),
    } as unknown as JarvisConfiguracionRepository;
  };

  /** Llama a una ruta del controlador y devuelve lo que responde. */
  const llamar = async (ruta: (req: AuthRequest, res: Response) => Promise<void>, body: unknown = {}) => {
    let estado = 200;
    let cuerpo: unknown;
    const res = {
      status(s: number) {
        estado = s;
        return this;
      },
      json(c: unknown) {
        cuerpo = c;
        return this;
      },
      end() {
        return this;
      },
    } as unknown as Response;
    await ruta({ user: { id: 'ana' }, body } as unknown as AuthRequest, res);
    return { estado, cuerpo: cuerpo as Record<string, unknown> };
  };

  it('guarda y comprueba; nunca devuelve la key, solo en qué termina', async () => {
    const c = new JarvisConfiguracionController(repo(), () => ({ comprobar: async () => null }));
    const guardado = await llamar(c.guardar, { endpoint: 'https://api.typesafe.ai', modelo: 'jev-latest', apiKey: 'ts-secreta-1234' });
    expect(guardado.estado).toBe(200);
    expect(guardado.cuerpo).toMatchObject({ tieneKey: true, ultimos4: '1234', error: null });
    expect(guardado.cuerpo.comprobadoEn).toEqual(expect.any(String));
    const leido = await llamar(c.get);
    expect(JSON.stringify(leido.cuerpo)).not.toContain('secreta');
  });

  it('si no responde, se guarda sin comprobar y dice por qué; sin key nueva, se queda la de antes', async () => {
    let respuesta: string | null = null;
    const c = new JarvisConfiguracionController(repo(), () => ({ comprobar: async () => respuesta }));
    await llamar(c.guardar, { apiKey: 'ts-secreta-1234' });
    respuesta = 'La key no es válida.';
    const otra = await llamar(c.guardar, { modelo: 'jev-preview' });
    expect(otra.cuerpo).toMatchObject({ modelo: 'jev-preview', ultimos4: '1234', comprobadoEn: null, error: 'La key no es válida.' });
  });

  it('el endpoint tiene que ser https', async () => {
    const c = new JarvisConfiguracionController(repo(), () => ({ comprobar: async () => null }));
    const r = await llamar(c.guardar, { endpoint: 'http://api.typesafe.ai', apiKey: 'x' });
    expect(r.estado).toBe(400);
    expect(r.cuerpo.campo).toBe('endpoint');
  });
});

describe('el endpoint de JEV', () => {
  it('vale la base o la dirección entera de la ruta', async () => {
    const { baseJev } = await import('../src/services/narradorVirtual/jev/ClienteJevHttp');
    for (const e of ['https://api.typesafe.ai', 'https://api.typesafe.ai/', 'https://api.typesafe.ai/v1', 'https://api.typesafe.ai/v1/systemone']) {
      expect(baseJev(e)).toBe('https://api.typesafe.ai');
    }
  });
});
