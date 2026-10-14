import { VillacuervosRepository } from '../../repositories/VillacuervosRepository';
import { Genero, Idioma, TraduccionPersonaje } from '../../types/guiones';
import { FuenteTraducciones } from './FuenteTraducciones';
import { idiomaDesdeVillacuervos, traduccionDesdeVillacuervos } from './TraduccionMapper';

const GENEROS_VILLACUERVOS: Record<Genero, string> = { masculino: 'male', femenino: 'female' };

/** Villacuervos como fuente de traducciones: pide sus paquetes y los traduce a nuestro modelo. */
export class VillacuervosFuenteTraducciones implements FuenteTraducciones {
  constructor(private villacuervos: VillacuervosRepository) {}

  async obtenerIdiomas(): Promise<Idioma[]> {
    const paquetes = await this.villacuervos.fetchTranslationPacks();
    return paquetes.map(idiomaDesdeVillacuervos).filter((i): i is Idioma => i !== null);
  }

  async obtenerTraducciones(idiomaId: string, genero: Genero | null): Promise<TraduccionPersonaje[]> {
    // Tal cual lo da Villacuervos en ese género, nombres incluidos (sin
    // marked_genres): «Pitoniso» y «jugadores», o «Pitonisa» y «jugadoras».
    const traducciones = await this.villacuervos.fetchTranslationsBySlug(
      idiomaId,
      GENEROS_VILLACUERVOS[genero ?? 'masculino'],
      false,
    );
    return traducciones.map(traduccionDesdeVillacuervos).filter((t): t is TraduccionPersonaje => t !== null);
  }
}
