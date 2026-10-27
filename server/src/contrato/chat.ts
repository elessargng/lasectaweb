/**
 * Mensajes de texto de la sala de juego (parte del contrato con el cliente: ver sala.ts).
 *
 * Canales:
 * - «general»: jugadores y narradores.
 * - «visitantes»: visitantes y narradores.
 * - privados, entre dos participantes («privado:<id>:<id>», los ids en orden).
 */

export const CANAL_GENERAL = 'general';
export const CANAL_VISITANTES = 'visitantes';
export const PREFIJO_PRIVADO = 'privado:';

/** El canal privado entre dos participantes (el mismo en los dos sentidos). */
export const canalPrivado = (a: string, b: string) => `${PREFIJO_PRIVADO}${[a, b].sort().join(':')}`;

/** Los dos participantes de un canal privado, o null si no lo es. */
export function participantesDePrivado(canal: string): [string, string] | null {
  if (!canal.startsWith(PREFIJO_PRIVADO)) return null;
  const ids = canal.slice(PREFIJO_PRIVADO.length).split(':');
  return ids.length === 2 ? [ids[0], ids[1]] : null;
}

/**
 * Mensajes privados entre jugadores (lo fija el narrador): ninguno, solo con los
 * vecinos de mesa, o con todos. Con un narrador siempre se puede.
 */
export type SalaMensajesPrivados = 'ninguno' | 'vecinos' | 'todos';
export const MENSAJES_PRIVADOS: SalaMensajesPrivados[] = ['ninguno', 'vecinos', 'todos'];

/** Lo más largo que puede ser un mensaje. */
export const LARGO_MAXIMO_MENSAJE = 500;

export interface SalaMensaje {
  id: string;
  canal: string;
  /** id del participante que lo escribe. */
  autor: string;
  /** Su nombre al escribirlo (por si luego cambia o se va). */
  autorNombre: string;
  texto: string;
  /** Cuándo (ms). */
  hora: number;
}

/**
 * Un mensaje privado entre dos jugadores sentados: todos ven que se han dicho
 * algo (unas ondas de un asiento al otro), no qué. La intensidad crece con el largo.
 */
export interface SalaSusurro {
  /** Asientos de quien escribe y de quien lo recibe. */
  desde: string;
  hasta: string;
  intensidad: 1 | 2 | 3;
}
