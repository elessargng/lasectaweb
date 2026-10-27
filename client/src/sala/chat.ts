import { CANAL_GENERAL, CANAL_VISITANTES, PREFIJO_PRIVADO, type SalaMensaje } from '@contrato/chat';
import type { SalaEstado, SalaParticipante } from './useSala';

// Los canales, los mensajes y sus límites son del contrato con el servidor (server/src/contrato/chat.ts)
export {
  CANAL_GENERAL,
  CANAL_VISITANTES,
  canalPrivado,
  LARGO_MAXIMO_MENSAJE,
  type SalaMensaje,
  type SalaMensajesPrivados,
  type SalaSusurro,
} from '@contrato/chat';

/**
 * Mensajes de texto de la sala, en el cliente. Las reglas las aplica el
 * servidor (ChatService); aquí solo se copian para enseñar los botones que se
 * pueden usar.
 */

/**
 * Pestaña de los narradores con los mensajes privados entre jugadores (todos
 * juntos, solo para leer). No es un canal del servidor: agrupa los privados
 * ajenos que le llegan.
 */
export const CANAL_SUSURROS = 'susurros';
export const esPrivado = (canal: string) => canal.startsWith(PREFIJO_PRIVADO);

/** Los dos de un canal privado, o null si no lo es. */
export function participantesDelPrivado(canal: string): string[] | null {
  return esPrivado(canal) ? canal.slice(PREFIJO_PRIVADO.length).split(':') : null;
}

/** Un privado entre otros (los narradores leen los de los jugadores). */
export const esAjeno = (canal: string, yo: string) => !!participantesDelPrivado(canal) && !participantesDelPrivado(canal)!.includes(yo);

/** Los mensajes de una pestaña: los de su canal o, en Susurros, todos los privados ajenos. */
export const mensajesDe = (mensajes: SalaMensaje[], canal: string, yo: string) =>
  canal === CANAL_SUSURROS ? mensajes.filter((m) => esAjeno(m.canal, yo)) : mensajes.filter((m) => m.canal === canal);

/** Cuántos mensajes de otros hay en una pestaña después de lo leído (`leidoHasta`, ms por canal). */
export const sinLeerDe = (mensajes: SalaMensaje[], canal: string, yo: string, leidoHasta: Record<string, number>) =>
  mensajesDe(mensajes, canal, yo).filter((m) => m.autor !== yo && m.hora > (leidoHasta[canal] ?? 0)).length;

/** Las pestañas privadas propias: con mensajes (o abiertas) y en las que está `yo`. */
export const privadosPropios = (mensajes: SalaMensaje[], abiertos: string[], yo: string) => [
  ...new Set([...mensajes.map((m) => m.canal).filter((c) => esPrivado(c) && !esAjeno(c, yo)), ...abiertos]),
];

/** En un canal privado, el otro participante (el que no es `yo`). */
export function otroDelPrivado(canal: string, yo: string): string | null {
  if (!esPrivado(canal)) return null;
  const ids = canal.slice(PREFIJO_PRIVADO.length).split(':');
  return ids.find((id) => id !== yo) ?? null;
}

/** Los canales comunes que tiene alguien según su papel. */
export function canalesComunes(yo: SalaParticipante): string[] {
  if (yo.rol === 'narrador') return [CANAL_GENERAL, CANAL_VISITANTES, CANAL_SUSURROS];
  return [yo.rol === 'jugador' ? CANAL_GENERAL : CANAL_VISITANTES];
}

/** Los vecinos de un jugador: el más cercano sentado a cada lado de la mesa. */
function vecinos(estado: SalaEstado, id: string): string[] {
  const mesa = estado.asientos;
  const i = mesa.findIndex((a) => a.ocupante === id);
  if (i < 0) return [];
  const n = mesa.length;
  const cercano = (paso: number) => {
    for (let k = 1; k < n; k++) {
      const ocupante = mesa[(i + paso * k + n) % n].ocupante;
      if (ocupante) return ocupante;
    }
    return null;
  };
  return [cercano(1), cercano(-1)].filter((o): o is string => !!o && o !== id);
}

/** Si `yo` puede escribir en privado a `otro` (como ChatService.puedeEscribirA). */
export function puedeEscribirA(estado: SalaEstado, yo: SalaParticipante, otro: SalaParticipante): boolean {
  if (yo.id === otro.id) return false;
  if (yo.rol === 'narrador' || otro.rol === 'narrador') return true;
  if (yo.rol !== 'jugador' || otro.rol !== 'jugador') return false;
  // Con la Institutriz viva, «todos» se queda en los vecinos (como en el servidor)
  const modo = estado.configuracion.mensajes === 'todos' && estado.institutriz ? 'vecinos' : estado.configuracion.mensajes;
  if (modo === 'todos') return true;
  if (modo === 'vecinos') return vecinos(estado, yo.id).includes(otro.id);
  return false;
}

/** Cómo se llama un canal: «General», «Visitantes», «Susurros» o el nombre del otro. */
export function nombreCanal(canal: string, yo: string, participantes: SalaParticipante[], mensajes: SalaMensaje[]): string {
  if (canal === CANAL_GENERAL) return 'General';
  if (canal === CANAL_VISITANTES) return 'Visitantes';
  if (canal === CANAL_SUSURROS) return 'Susurros';
  const otro = otroDelPrivado(canal, yo);
  return (
    participantes.find((p) => p.id === otro)?.nombre ??
    // Si ya no está en la sala, el nombre con el que escribió
    mensajes.find((m) => m.canal === canal && m.autor === otro)?.autorNombre ??
    'Alguien que ya no está'
  );
}

/** Quién es quién en un privado ajeno: «Ana a Luis» (de quien escribe al otro). */
export function deQuienAQuien(m: SalaMensaje, participantes: SalaParticipante[], mensajes: SalaMensaje[]): string {
  const otro = participantesDelPrivado(m.canal)?.find((id) => id !== m.autor);
  const nombreOtro =
    participantes.find((p) => p.id === otro)?.nombre ??
    mensajes.find((x) => x.canal === m.canal && x.autor === otro)?.autorNombre ??
    'alguien que ya no está';
  return `${m.autorNombre} a ${nombreOtro}`;
}
