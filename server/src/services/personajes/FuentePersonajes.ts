import { PersonajeDeFuente } from '../../types/guiones';

/**
 * De dónde salen los personajes del catálogo. La sincronización solo conoce esta
 * interfaz: cambiar de fuente (u otra para pruebas) no la toca.
 */
export interface FuentePersonajes {
  /** Todos los personajes de la fuente, ya en nuestro modelo. */
  obtenerPersonajes(): Promise<PersonajeDeFuente[]>;
  /** Descarga un icono de la fuente; null si no existe (p. ej. no hay versión alternativa). */
  descargarIcono(url: string): Promise<Buffer | null>;
}
