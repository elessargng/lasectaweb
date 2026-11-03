import type { Participante } from '../../../models/sala/Participantes';
import type { SalaDeJuego } from '../../../models/SalaDeJuego';
import type { DependenciasAcciones } from '../puertos';
import type { Accion, SalaEfecto } from './Accion';
import { ACCIONES_PARTICIPANTES } from './participantes';

export type { SalaEfecto } from './Accion';

/**
 * Todo lo que se puede pedir a la sala, con quién puede pedirlo. Las del
 * narrador van con el prefijo `narrador:`.
 *
 * Se comprueba `puede` antes de `hacer`, y a cada participante se le manda la
 * lista de las que puede usar en ese momento: el cliente pinta sus botones a
 * partir de ella, sin decidir permisos por su cuenta. Para añadir una acción
 * basta con añadirla en su archivo (y su botón en el cliente).
 */
export const SALA_ACCIONES: Record<string, Accion> = {
  ...ACCIONES_PARTICIPANTES,
};

/** Las acciones que este participante puede usar ahora mismo. */
export function accionesPermitidas(juego: SalaDeJuego, yo: Participante): string[] {
  return Object.entries(SALA_ACCIONES)
    .filter(([, accion]) => accion.puede(juego, yo))
    .map(([nombre]) => nombre);
}

/** Ejecuta una acción si existe y quien la pide tiene permiso. */
export async function ejecutarAccion(
  juego: SalaDeJuego,
  yo: Participante | undefined,
  nombre: string,
  datos: unknown,
  deps: DependenciasAcciones,
): Promise<SalaEfecto> {
  const accion = Object.prototype.hasOwnProperty.call(SALA_ACCIONES, nombre) ? SALA_ACCIONES[nombre] : undefined;
  if (!accion) return { ok: false, error: 'Acción desconocida.' };
  if (!yo) return { ok: false, error: 'No estás en la sala.' };
  if (!accion.puede(juego, yo)) {
    return { ok: false, error: typeof accion.noPuede === 'function' ? accion.noPuede(juego, yo) : accion.noPuede };
  }
  return accion.hacer(juego, yo, datos, deps);
}
