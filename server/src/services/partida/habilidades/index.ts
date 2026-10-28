import type { HabilidadNocturna } from './HabilidadNocturna';
import { HABILIDADES_TROUBLE_BREWING } from './troubleBrewing';

/**
 * Las habilidades de noche de cada guion, por edición oficial. Solo Trouble
 * Brewing, de momento: en otros guiones hay personajes que cambian las reglas
 * (el Vortox, la Marioneta…) y se despierta a mano. Un guion nuevo es una entrada más.
 */
const POR_EDICION: Record<string, readonly HabilidadNocturna[]> = {
  troublebrewing: HABILIDADES_TROUBLE_BREWING,
};

/** Las habilidades de noche de un guion (por su edición), por personaje; ninguna si no las tiene. */
export function habilidadesDelGuion(edicion: string | null): ReadonlyMap<string, HabilidadNocturna> {
  return new Map((edicion ? (POR_EDICION[edicion] ?? []) : []).map((h) => [h.personaje, h]));
}
