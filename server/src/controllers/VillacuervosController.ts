import { Request, Response } from 'express';
import { VillacuervosService } from '../services/VillacuervosService';
import { AuthRequest } from './middlewares/auth';

export class VillacuervosController {
  constructor(private villacuervosService: VillacuervosService) {}

  getRoles = async (req: Request, res: Response): Promise<void> => {
    try {
      const roles = await this.villacuervosService.getRoles();
      res.status(200).json(roles);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  getRoleByKey = async (req: Request, res: Response): Promise<void> => {
    try {
      const { key } = req.params;
      const role = await this.villacuervosService.getRoleByKey(key as string);
      res.status(200).json(role);
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  };

  getJinxes = async (req: Request, res: Response): Promise<void> => {
    try {
      const jinxes = await this.villacuervosService.getJinxes();
      res.status(200).json(jinxes);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  getTranslations = async (req: Request, res: Response): Promise<void> => {
    try {
      const packs = await this.villacuervosService.getTranslationPacks();
      res.status(200).json(packs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  getTranslationPack = async (req: Request, res: Response): Promise<void> => {
    try {
      const { slug } = req.params;
      const genre = req.query.genre as string | undefined;
      const markedGenres = req.query.marked_genres === 'false' ? false : true;

      const translations = await this.villacuervosService.getTranslationsBySlug(
        slug as string,
        genre,
        markedGenres
      );
      res.status(200).json(translations);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  getPendingPlays = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const plays = await this.villacuervosService.getPendingPlays();
      res.status(200).json(plays);
    } catch (error: any) {
      const isForbidden = error.message.includes('Acceso denegado');
      res.status(isForbidden ? 403 : 400).json({ error: error.message });
    }
  };

  createPlay = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autorizado' });
        return;
      }
      const play = await this.villacuervosService.createPlay(req.user.id, req.body);
      res.status(201).json(play);
    } catch (error: any) {
      const isForbidden = error.message.includes('Acceso denegado');
      res.status(isForbidden ? 403 : 400).json({ error: error.message });
    }
  };

  updatePlay = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autorizado' });
        return;
      }
      const { playSlug } = req.params;
      const play = await this.villacuervosService.updatePlay(req.user.id, playSlug as string, req.body);
      res.status(200).json(play);
    } catch (error: any) {
      const isForbidden = error.message.includes('Acceso denegado');
      res.status(isForbidden ? 403 : 400).json({ error: error.message });
    }
  };
}
