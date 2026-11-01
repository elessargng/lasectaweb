import { baseJev, type ConfigJev } from '../config/jev';
import type { NarradorIARepository } from './NarradorIARepository';

/** Lo que espera una respuesta del modelo (ms). */
export const TOPE_JEV_MS = 15_000;

/** Una pregunta al modelo JEV: elegir una de las opciones (`choice`) o sí o no (`noul`). */
type PreguntaJev =
  | { type: 'choice'; instructions: string; criteria: Record<string, string> }
  | { type: 'noul'; instructions: string; criteria: { true: string; false: string } };

/** Lo que contesta a una pregunta: la opción (con lo seguro que está) o la probabilidad de sí. */
type RespuestaJev = { type: 'choice'; choice: string; confidence?: number } | { type: 'noul'; noul: number };

/** Un error de la API en palabras para el usuario. */
export class ErrorJev extends Error {}

const NO_SE_ENTIENDE = 'El modelo ha contestado algo que no se entiende.';

/** Lo que explica la API en un error (`detail`: un texto o una lista con `msg`). */
function detalle(cuerpo: unknown): string | null {
  const d = (cuerpo as { detail?: unknown } | null)?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map((x) => (x as { msg?: string }).msg).filter(Boolean).join('; ') || null;
  return null;
}

/**
 * El modelo JEV de TypeSafe por su API (docs.typesafe.ai/api): `POST /v1/systemone`
 * con `{ model, state, questions }` y la key como Bearer; responde `{ answers }`
 * con lo de cada pregunta. Cada llamada tiene un tope de tiempo: si no contesta
 * a tiempo, falla (quien la usa reintenta o decide de otra forma).
 */
export class NarradorJevRepository implements NarradorIARepository {
  constructor(
    private readonly config: ConfigJev,
    private readonly hacerFetch: typeof fetch = fetch,
  ) {}

  async elegir(contexto: unknown, instrucciones: string, opciones: Record<string, string>): Promise<string> {
    const r = await this.preguntar(contexto, { type: 'choice', instructions: instrucciones, criteria: opciones });
    if (r?.type !== 'choice' || typeof r.choice !== 'string') throw new ErrorJev(NO_SE_ENTIENDE);
    return r.choice;
  }

  async siONo(contexto: unknown, instrucciones: string, si: string, no: string): Promise<number> {
    const r = await this.preguntar(contexto, { type: 'noul', instructions: instrucciones, criteria: { true: si, false: no } });
    if (r?.type !== 'noul' || typeof r.noul !== 'number') throw new ErrorJev(NO_SE_ENTIENDE);
    return r.noul;
  }

  /** Que responde de verdad: una pregunta mínima de sí o no. */
  async comprobar(): Promise<string | null> {
    try {
      await this.siONo('Comprobación de La Secta: ¿respondes?', 'Contesta que sí.', 'Sí', 'No');
      return null;
    } catch (e) {
      return e instanceof ErrorJev ? e.message : 'No se ha podido comprobar el modelo.';
    }
  }

  /** Una sola pregunta (`decision`): lo que contesta a ella. */
  private async preguntar(state: unknown, pregunta: PreguntaJev): Promise<RespuestaJev | undefined> {
    const abortar = new AbortController();
    const tope = setTimeout(() => abortar.abort(), TOPE_JEV_MS);
    let res: Response;
    try {
      res = await this.hacerFetch(`${baseJev(this.config.endpoint)}/v1/systemone`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.config.modelo, state, questions: { decision: pregunta } }),
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
    if (!answers || typeof answers !== 'object') throw new ErrorJev(NO_SE_ENTIENDE);
    return (answers as Record<string, RespuestaJev>).decision;
  }
}
