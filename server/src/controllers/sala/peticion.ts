import type { Responder } from '../../services/sala/SalaService';
import type { Sesion } from './SalaController';

/** Lo que se contesta cuando no se hace: el porqué. */
export type Fallo = { ok: false; error: string };

const FUERA: Fallo = { ok: false, error: 'Ya no estás en la sala.' };

/** Los campos de una petición; si no es un objeto, ninguno. */
export const campos = (peticion: unknown): Record<string, unknown> =>
  typeof peticion === 'object' && peticion !== null ? (peticion as Record<string, unknown>) : {};

/**
 * Lo común a los controladores de la sala (BolsaController, RelojController…): hace
 * falta seguir en la sala (`quienEs`, el del servicio); lo pide como ese
 * participante y contesta.
 */
export function como<R>(
  quienEs: (clave: string) => string | null,
  sesion: Sesion,
  responder: Responder<R | Fallo>,
  hacer: (yoId: string) => R | Fallo,
): void {
  const yoId = quienEs(sesion.clave);
  responder(yoId ? hacer(yoId) : FUERA);
}
