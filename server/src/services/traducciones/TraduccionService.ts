import { IdiomaRepository } from '../../repositories/IdiomaRepository';
import { TraduccionRepository } from '../../repositories/TraduccionRepository';
import { Genero, IDIOMA_ORIGINAL, Idioma, TraduccionPersonaje } from '../../types/guiones';

/** Las traducciones de un idioma (en un género, si los distingue). */
export interface TraduccionesDeIdioma {
  idioma: Idioma;
  traducciones: TraduccionPersonaje[];
}

/** Los idiomas en los que se pueden ver los personajes y sus traducciones (de la copia local). */
export class TraduccionService {
  constructor(
    private idiomas: IdiomaRepository,
    private traducciones: TraduccionRepository,
  ) {}

  /** El original (English) y después los demás, por nombre. */
  async disponibles(): Promise<Idioma[]> {
    return [IDIOMA_ORIGINAL, ...(await this.idiomas.listar())];
  }

  /** Las traducciones de un idioma (ninguna para el original); null si no existe. */
  async deIdioma(id: string, genero: Genero): Promise<TraduccionesDeIdioma | null> {
    if (id === IDIOMA_ORIGINAL.id) return { idioma: IDIOMA_ORIGINAL, traducciones: [] };
    const idioma = await this.idiomas.buscar(id);
    if (!idioma) return null;
    return { idioma, traducciones: await this.traducciones.deIdioma(id, genero) };
  }
}
