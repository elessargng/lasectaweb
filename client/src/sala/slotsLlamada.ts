import type { SalaEstado, SalaInvitacion } from './useSala';

/**
 * Las llamadas entrantes y las teclas rápidas para cogerlas. Cada llamada (una
 * invitación recibida o una petición para unirse a la propia conversación) ocupa
 * un «slot» (0, 1, 2, 3) que fija qué tecla la coge. Se asignan por orden de
 * llegada al slot libre más bajo; cada llamada conserva el suyo mientras está, y
 * al desaparecer una, su slot queda libre para la siguiente llamada nueva.
 */

/** Las llamadas que esperan mi respuesta (igual que PanelInvitaciones), en orden de llegada. */
export function recibidasDe(estado: SalaEstado): SalaInvitacion[] {
  const yo = estado.yo;
  return estado.invitaciones.filter((i) => (i.conversacion ? i.de !== yo : i.para === yo));
}

/**
 * Pone al día el mapa `invitación -> slot`: suelta los slots de las llamadas que
 * ya no están y da a cada llamada nueva el slot libre más bajo (0..n-1), por
 * orden. Muta `mapa` y devuelve las llamadas nuevas (con su slot, o sin tecla si
 * ya no quedaban slots).
 */
export function reconciliarSlots(
  mapa: Map<string, number>,
  recibidas: SalaInvitacion[],
  n: number,
): { invitacion: SalaInvitacion; slot: number | null }[] {
  const ids = new Set(recibidas.map((i) => i.id));
  for (const id of [...mapa.keys()]) if (!ids.has(id)) mapa.delete(id);
  const ocupados = new Set(mapa.values());
  const nuevas: { invitacion: SalaInvitacion; slot: number | null }[] = [];
  for (const invitacion of recibidas) {
    if (mapa.has(invitacion.id)) continue;
    let slot: number | null = null;
    for (let s = 0; s < n; s++) {
      if (!ocupados.has(s)) {
        slot = s;
        break;
      }
    }
    if (slot !== null) {
      mapa.set(invitacion.id, slot);
      ocupados.add(slot);
    }
    nuevas.push({ invitacion, slot });
  }
  return nuevas;
}
