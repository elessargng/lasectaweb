import { Genero, Idioma, TraduccionPersonaje } from '../../types/guiones';

/**
 * De dónde salen las traducciones de los personajes. La sincronización solo
 * conoce esta interfaz: cambiar de fuente (u otra para pruebas) no la toca.
 */
export interface FuenteTraducciones {
  /** Los idiomas (paquetes de traducción) que ofrece la fuente, ya en nuestro modelo. */
  obtenerIdiomas(): Promise<Idioma[]>;
  /**
   * Las traducciones de un idioma, ya en nuestro modelo: en un género, o null
   * para los idiomas que no los distinguen.
   */
  obtenerTraducciones(idiomaId: string, genero: Genero | null): Promise<TraduccionPersonaje[]>;
}
