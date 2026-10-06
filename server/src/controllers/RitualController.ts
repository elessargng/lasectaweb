import { Request, Response } from 'express';
import { RitualService } from '../services/RitualService';
import { AuthRequest } from '../middlewares/auth';

function ritualId(req: Request | AuthRequest): string {
  const raw = (req.params as Record<string, string | string[]>).id;
  return Array.isArray(raw) ? raw[0] : raw;
}

function errorStatus(message: string): number {
  if (message.includes('Acceso denegado')) return 403;
  if (message.includes('no existe')) return 404;
  return 400;
}

export class RitualController {
  constructor(private ritualService: RitualService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    try {
      const from = typeof req.query.from === 'string' ? req.query.from : '';
      const to = typeof req.query.to === 'string' ? req.query.to : '';
      res.json(await this.ritualService.listBetween(from, to));
    } catch (error: any) {
      res.status(400).json({ error: error.message ?? 'No se pudo cargar la agenda.' });
    }
  };

  listStorytellers = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autorizado.' });
        return;
      }
      res.json(await this.ritualService.listStorytellers(req.user.id));
    } catch (error: any) {
      res.status(errorStatus(error.message)).json({ error: error.message });
    }
  };

  get = async (req: Request, res: Response): Promise<void> => {
    try {
      const ritual = await this.ritualService.getById(ritualId(req));
      if (!ritual) {
        res.status(404).json({ error: 'El ritual no existe.' });
        return;
      }
      res.json(ritual);
    } catch (error: any) {
      res.status(500).json({ error: error.message ?? 'No se pudo obtener el ritual.' });
    }
  };

  create = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autorizado.' });
        return;
      }
      res.status(201).json(await this.ritualService.create(req.user.id, req.body));
    } catch (error: any) {
      res.status(errorStatus(error.message)).json({ error: error.message });
    }
  };

  update = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autorizado.' });
        return;
      }
      res.json(await this.ritualService.update(req.user.id, ritualId(req), req.body));
    } catch (error: any) {
      res.status(errorStatus(error.message)).json({ error: error.message });
    }
  };

  /** Cualquier persona registrada puede apuntarse a una partida de La Secta. */
  signUp = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autorizado.' });
        return;
      }
      res.status(201).json(await this.ritualService.signUp(req.user.id, ritualId(req), req.body?.occurrence));
    } catch (error: any) {
      res.status(errorStatus(error.message)).json({ error: error.message });
    }
  };

  leave = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autorizado.' });
        return;
      }
      res.json(await this.ritualService.leave(req.user.id, ritualId(req), req.query.occurrence));
    } catch (error: any) {
      res.status(errorStatus(error.message)).json({ error: error.message });
    }
  };

  delete = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autorizado.' });
        return;
      }
      await this.ritualService.delete(req.user.id, ritualId(req));
      res.status(204).end();
    } catch (error: any) {
      res.status(errorStatus(error.message)).json({ error: error.message });
    }
  };
}
