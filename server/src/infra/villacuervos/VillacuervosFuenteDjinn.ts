import { VillacuervosRepository } from '../../repositories/VillacuervosRepository';
import { ReglaDjinn } from '../../models/guiones';
import { PublicJinxSchema } from './esquemas';
import { normalizarIdPersonaje } from '../../models/personajes/idPersonaje';
import { FuenteDjinn } from '../../services/djinn/FuenteDjinn';

/**
 * Traduce un «jinx» de Villacuervos a nuestro modelo (con los ids del catálogo);
 * null si le falta algo.
 */
export function reglaDesdeVillacuervos(j: PublicJinxSchema): ReglaDjinn | null {
  const a = normalizarIdPersonaje(j?.first_role ?? '');
  const b = normalizarIdPersonaje(j?.second_role ?? '');
  const texto = (j?.text ?? '').trim();
  if (!a || !b || a === b || !texto) return null;
  return { personajes: [a, b], texto };
}

/** Villacuervos como fuente de las reglas del Djinn. */
export class VillacuervosFuenteDjinn implements FuenteDjinn {
  constructor(private villacuervos: VillacuervosRepository) {}

  async obtenerReglas(): Promise<ReglaDjinn[]> {
    const jinxes = await this.villacuervos.fetchJinxes();
    return jinxes.map(reglaDesdeVillacuervos).filter((r): r is ReglaDjinn => r !== null);
  }
}
