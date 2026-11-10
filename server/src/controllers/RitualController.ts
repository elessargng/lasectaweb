import { Request, Response } from 'express';
import { RitualService } from '../services/RitualService';
import { FotosRitual } from '../services/FotosRitual';
import { AuthRequest } from './middlewares/auth';

function ritualId(req: Request | AuthRequest): string {
  const raw = (req.params as Record<string, string | string[]>).id;
  return Array.isArray(raw) ? raw[0] : raw;
}

function photoId(req: Request): string {
  const raw = (req.params as Record<string, string | string[]>).photoId;
  return Array.isArray(raw) ? raw[0] : raw;
}

function errorStatus(message: string): number {
  if (message.includes('Acceso denegado')) return 403;
  if (message.includes('no existe')) return 404;
  return 400;
}

export class RitualController {
  constructor(
    private ritualService: RitualService,
    private fotos: FotosRitual
  ) {}

  /** Con sesión o sin ella: con sesión llegan también las fotos privadas propias. */
  list = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const from = typeof req.query.from === 'string' ? req.query.from : '';
      const to = typeof req.query.to === 'string' ? req.query.to : '';
      res.json(await this.ritualService.listBetween(from, to, req.user?.id));
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

  /** Las fotos de los eventos, en una línea de tiempo: las públicas y las privadas de quien la pide. */
  photoTimeline = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      res.json(await this.fotos.lineaDeTiempo(req.user?.id));
    } catch (error: any) {
      res.status(500).json({ error: error.message ?? 'No se pudieron cargar las fotos.' });
    }
  };

  /** Cualquier persona registrada sube fotos a un evento. */
  uploadPhotos = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autorizado.' });
        return;
      }
      await this.fotos.subir(req.user.id, ritualId(req), req.body?.photos);
      res.status(201).json(await this.ritualService.getById(ritualId(req), req.user.id));
    } catch (error: any) {
      res.status(errorStatus(error.message)).json({ error: error.message });
    }
  };

  /** Quien subió una foto la hace pública o privada. */
  updatePhoto = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autorizado.' });
        return;
      }
      await this.fotos.cambiarVisibilidad(req.user.id, ritualId(req), photoId(req), req.body?.public);
      res.json(await this.ritualService.getById(ritualId(req), req.user.id));
    } catch (error: any) {
      res.status(errorStatus(error.message)).json({ error: error.message });
    }
  };

  /** Quien subió una foto la borra (o un narrador o administrador). */
  deletePhoto = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autorizado.' });
        return;
      }
      await this.fotos.borrar(req.user.id, ritualId(req), photoId(req));
      res.json(await this.ritualService.getById(ritualId(req), req.user.id));
    } catch (error: any) {
      res.status(errorStatus(error.message)).json({ error: error.message });
    }
  };

  get = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const ritual = await this.ritualService.getById(ritualId(req), req.user?.id);
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
