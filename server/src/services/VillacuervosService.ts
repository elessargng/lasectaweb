import { VillacuervosRepository } from '../repositories/VillacuervosRepository';
import { UserRepository } from '../repositories/UserRepository';
import {
  PublicRoleSchema,
  PublicJinxSchema,
  PublicPackSchema,
  PublicTranslationSchema,
  PublicPlaySchema,
  PublicPlayCreateSchema,
  PublicPlayUpdateSchema
} from '../infra/villacuervos/esquemas';

export class VillacuervosService {
  constructor(
    private villacuervosRepository: VillacuervosRepository,
    private userRepository: UserRepository
  ) {}

  private async checkNarradorPermission(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('Usuario no encontrado.');
    }
    if (!user.roles.includes('narrador')) {
      throw new Error('Acceso denegado. Se requiere el rol de narrador.');
    }
  }

  async getRoles(): Promise<PublicRoleSchema[]> {
    return await this.villacuervosRepository.getRoles();
  }

  async getRoleByKey(key: string): Promise<PublicRoleSchema> {
    return await this.villacuervosRepository.getRoleByKey(key);
  }

  async getJinxes(): Promise<PublicJinxSchema[]> {
    return await this.villacuervosRepository.getJinxes();
  }

  async getTranslationPacks(): Promise<PublicPackSchema[]> {
    return await this.villacuervosRepository.getTranslationPacks();
  }

  async getTranslationsBySlug(
    slug: string,
    genre?: string,
    markedGenres?: boolean
  ): Promise<PublicTranslationSchema[]> {
    return await this.villacuervosRepository.getTranslationsBySlug(slug, genre, markedGenres);
  }

  async getPendingPlays(): Promise<PublicPlaySchema[]> {
    const cultSlug = process.env.VILLACUERVOS_CULT_SLUG;
    if (!cultSlug) {
      throw new Error('La variable VILLACUERVOS_CULT_SLUG no está configurada.');
    }
    return await this.villacuervosRepository.getPendingPlays(cultSlug);
  }

  async createPlay(userId: string, playData: PublicPlayCreateSchema): Promise<PublicPlaySchema> {
    await this.checkNarradorPermission(userId);
    const cultSlug = process.env.VILLACUERVOS_CULT_SLUG;
    if (!cultSlug) {
      throw new Error('La variable VILLACUERVOS_CULT_SLUG no está configurada.');
    }
    return await this.villacuervosRepository.createPlay(cultSlug, playData);
  }

  async updatePlay(
    userId: string,
    playSlug: string,
    playData: PublicPlayUpdateSchema
  ): Promise<PublicPlaySchema> {
    await this.checkNarradorPermission(userId);
    return await this.villacuervosRepository.updatePlay(playSlug, playData);
  }
}
