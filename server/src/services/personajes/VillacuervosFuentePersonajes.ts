import { VillacuervosRepository } from '../../repositories/VillacuervosRepository';
import { PersonajeDeFuente } from '../../types/guiones';
import { FuentePersonajes } from './FuentePersonajes';
import { personajeDesdeVillacuervos } from './PersonajeMapper';

/** Villacuervos como fuente de personajes: pide sus datos y los traduce a nuestro modelo. */
export class VillacuervosFuentePersonajes implements FuentePersonajes {
  constructor(private villacuervos: VillacuervosRepository) {}

  async obtenerPersonajes(): Promise<PersonajeDeFuente[]> {
    const roles = await this.villacuervos.fetchRoles();
    return roles.map(personajeDesdeVillacuervos).filter((p): p is PersonajeDeFuente => p !== null);
  }

  descargarIcono(url: string): Promise<Buffer | null> {
    return this.villacuervos.descargarImagen(url);
  }
}
