import type { ClienteJev, DatosJev, PreguntaJev, RespuestaJev } from '../puertos';

export type { DatosJev };

/**
 * El modelo JEV de TypeSafe por su API (docs.typesafe.ai/api): `POST /v1/systemone`
 * con `{ model, state, questions }` y la key como Bearer; responde `{ answers }`
 * con lo de cada pregunta. Cada llamada tiene un tope de tiempo: si no contesta
 * a tiempo, falla (quien la usa reintenta o decide de otra forma).
 */

/** Lo que espera una respuesta del modelo (ms). */
export const TOPE_JEV_MS = 15_000;

export const ENDPOINT_JEV = 'https://api.typesafe.ai';
export const MODELO_JEV = 'jev-latest';

/** Un error de la API en palabras para el usuario. */
export class ErrorJev extends Error {}

/**
 * La base de la API a partir de lo que haya puesto el usuario: vale la base
 * (`https://api.typesafe.ai`) o la dirección entera de una ruta (`…/v1/systemone`).
 */
export const baseJev = (endpoint: string) =>
  endpoint
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/v1(\/(systemone|models))?$/, '');

/** Lo que explica la API en un error (`detail`: un texto o una lista con `msg`). */
function detalle(cuerpo: unknown): string | null {
  const d = (cuerpo as { detail?: unknown } | null)?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map((x) => (x as { msg?: string }).msg).filter(Boolean).join('; ') || null;
  return null;
}

export class ClienteJevHttp implements ClienteJev {
  constructor(
    private readonly datos: DatosJev,
    private readonly hacerFetch: typeof fetch = fetch,
  ) {}

  async decidir(state: unknown, questions: Record<string, PreguntaJev>): Promise<Record<string, RespuestaJev>> {
    const abortar = new AbortController();
    const tope = setTimeout(() => abortar.abort(), TOPE_JEV_MS);
    let res: Response;
    try {
      res = await this.hacerFetch(`${baseJev(this.datos.endpoint)}/v1/systemone`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.datos.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.datos.modelo, state, questions }),
        signal: abortar.signal,
      });
    } catch (e) {
      throw new ErrorJev(abortar.signal.aborted ? 'El modelo no ha contestado a tiempo.' : `No se puede llegar al modelo: ${(e as Error).message}`);
    } finally {
      clearTimeout(tope);
    }
    const cuerpo: unknown = await res.json().catch(() => null);
    if (res.status === 401 || res.status === 403) throw new ErrorJev('La key no es válida.');
    if (res.status === 404) throw new ErrorJev('No se encuentra la API en ese endpoint (404): revisa la dirección.');
    if (!res.ok) throw new ErrorJev(`El modelo ha contestado con un error (${res.status})${detalle(cuerpo) ? `: ${detalle(cuerpo)}` : ''}.`);
    const answers = (cuerpo as { answers?: unknown } | null)?.answers;
    if (!answers || typeof answers !== 'object') throw new ErrorJev('El modelo ha contestado algo que no se entiende.');
    return answers as Record<string, RespuestaJev>;
  }

  /** Que responde de verdad: una pregunta mínima de sí o no. Devuelve el error en palabras, o null si responde. */
  async comprobar(): Promise<string | null> {
    try {
      const r = await this.decidir('Comprobación de La Secta: ¿respondes?', {
        responde: { type: 'noul', instructions: 'Contesta que sí.', criteria: { true: 'Sí', false: 'No' } },
      });
      return typeof r.responde?.type === 'string' ? null : 'El modelo ha contestado algo que no se entiende.';
    } catch (e) {
      return e instanceof ErrorJev ? e.message : 'No se ha podido comprobar el modelo.';
    }
  }
}
