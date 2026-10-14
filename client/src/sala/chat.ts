import type { SalaEstado, SalaParticipante } from './useSala';

/**
 * Mensajes de texto de la sala, en el cliente. Las reglas las aplica el
 * servidor (ChatService); aquí solo se copian para enseñar los botones que se
 * pueden usar.
 */

export const CANAL_GENERAL = 'general';
export const CANAL_VISITANTES = 'visitantes';
const PREFIJO_PRIVADO = 'privado:';

export type SalaMensajesPrivados = 'ninguno' | 'vecinos' | 'todos';

export interface SalaMensaje {
  id: string;
  canal: string;
  autor: string;
  autorNombre: string;
  texto: string;
  hora: number;
}

/** Las ondas de un mensaje privado entre dos jugadores sentados (de asiento a asiento). */
export interface SalaSusurro {
  desde: string;
  hasta: string;
  intensidad: 1 | 2 | 3;
}

export const LARGO_MAXIMO_MENSAJE = 500;

export const canalPrivado = (a: string, b: string) => `${PREFIJO_PRIVADO}${[a, b].sort().join(':')}`;
export const esPrivado = (canal: string) => canal.startsWith(PREFIJO_PRIVADO);

/** En un canal privado, el otro participante (el que no es `yo`). */
export function otroDelPrivado(canal: string, yo: string): string | null {
  if (!esPrivado(canal)) return null;
  const ids = canal.slice(PREFIJO_PRIVADO.length).split(':');
  return ids.find((id) => id !== yo) ?? null;
}

/** Los canales comunes que tiene alguien según su papel. */
export function canalesComunes(yo: SalaParticipante): string[] {
  if (yo.rol === 'narrador') return [CANAL_GENERAL, CANAL_VISITANTES];
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
  const modo = estado.configuracion.mensajes;
  if (modo === 'todos') return true;
  if (modo === 'vecinos') return vecinos(estado, yo.id).includes(otro.id);
  return false;
}

/** Cómo se llama un canal: «General», «Visitantes» o el nombre del otro. */
export function nombreCanal(canal: string, yo: string, participantes: SalaParticipante[], mensajes: SalaMensaje[]): string {
  if (canal === CANAL_GENERAL) return 'General';
  if (canal === CANAL_VISITANTES) return 'Visitantes';
  const otro = otroDelPrivado(canal, yo);
  return (
    participantes.find((p) => p.id === otro)?.nombre ??
    // Si ya no está en la sala, el nombre con el que escribió
    mensajes.find((m) => m.canal === canal && m.autor === otro)?.autorNombre ??
    'Alguien que ya no está'
  );
}
