import type { ModeloNarrador } from '../models/narradorVirtual/puertos';

/**
 * Un modelo de IA con el que puede decidir Jarvis (hoy, JEV: ver
 * NarradorJevRepository). Lo usa NarradorIAService: el resto no sabe cuál es.
 */
export interface NarradorIARepository extends ModeloNarrador {
  /** Que responde de verdad: el error en palabras, o null si responde. */
  comprobar(): Promise<string | null>;
}
