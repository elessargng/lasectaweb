import { ReglaDjinn } from '../../types/guiones';

/**
 * De dónde salen las reglas del Djinn. La sincronización solo conoce esta
 * interfaz: cambiar de fuente (u otra para pruebas) no la toca.
 */
export interface FuenteDjinn {
  /** Todas las reglas de la fuente, ya en nuestro modelo. */
  obtenerReglas(): Promise<ReglaDjinn[]>;
}
