/**
 * Los canales de los mensajes de texto de la sala.
 * Dominio que comparten el servidor y el cliente (alias @models): solo tipos y valores puros.
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
 * vecinos de plaza, o con todos. Con un narrador siempre se puede.
 */
export type MensajesPrivados = 'ninguno' | 'vecinos' | 'todos';

export const MENSAJES_PRIVADOS: MensajesPrivados[] = ['ninguno', 'vecinos', 'todos'];

/** Lo más largo que puede ser un mensaje. */
export const LARGO_MAXIMO_MENSAJE = 500;
