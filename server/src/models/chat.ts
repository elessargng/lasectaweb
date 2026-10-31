/**
 * Los mensajes de texto de la sala (los canales y sus límites, en
 * compartido/chat, porque los usa también el cliente).
 */

/** Un mensaje de texto escrito en un canal. */
export interface MensajeChat {
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
 * Un mensaje privado entre dos jugadores sentados, visto desde fuera: todos saben
 * que se han dicho algo (de un jugador al otro), no qué. La intensidad crece con el largo.
 */
export interface Susurro {
  /** Los jugadores de quien escribe y de quien lo recibe. */
  desde: string;
  hasta: string;
  intensidad: 1 | 2 | 3;
}
