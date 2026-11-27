/**
 * Los mensajes de texto y los susurros tal como se envían.
 * Lo que se envía al cliente (alias @views): solo tipos, sin Node ni servicios.
 */

/** Los canales: el general, el de los visitantes y los privados (uno por pareja, el mismo en los dos sentidos). */
export const CANAL_GENERAL = 'general';

export const CANAL_VISITANTES = 'visitantes';

export const PREFIJO_PRIVADO = 'privado:';

/** El id del canal privado entre dos participantes. */
export const canalPrivado = (a: string, b: string) => `${PREFIJO_PRIVADO}${[a, b].sort().join(':')}`;

/** Mensajes privados entre jugadores (lo fija el narrador): ninguno, solo con los vecinos de plaza, o con todos. */
export type MensajesPrivados = 'ninguno' | 'vecinos' | 'todos';

/** Lo más largo que puede ser un mensaje. */
export const LARGO_MAXIMO_MENSAJE = 500;

export interface MensajeChatDto {
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
export interface SusurroDto {
  /** Asientos de quien escribe y de quien lo recibe. */
  desde: string;
  hasta: string;
  intensidad: 1 | 2 | 3;
}
