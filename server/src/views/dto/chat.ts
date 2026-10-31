/**
 * Los mensajes de texto y los susurros tal como se envían.
 * Lo que se envía al cliente (alias @views): solo tipos, sin Node ni servicios.
 */

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
