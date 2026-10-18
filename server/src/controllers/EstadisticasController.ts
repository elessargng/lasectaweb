import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { EstadisticasService } from '../services/estadisticas/EstadisticasService';

export class EstadisticasController {
  constructor(private service: EstadisticasService) {}

  /** Las del usuario de la sesión. */
  mias = async (req: AuthRequest, res: Response): Promise<void> => {
    const resumen = await this.service.resumen(req.user!.id, req.user!.id);
    if (!resumen) {
      res.status(404).json({ error: 'No se encuentra tu cuenta.' });
      return;
    }
    res.json(resumen);
  };

  /** Las de otro (si las tiene públicas; las propias, siempre). */
  deUsuario = async (req: AuthRequest, res: Response): Promise<void> => {
    const resumen = await this.service.resumen(String(req.params.userId), req.user?.id ?? null);
    if (!resumen) {
      res.status(404).json({ error: 'Estas estadísticas no existen o son privadas.' });
      return;
    }
    res.json(resumen);
  };

  /** El perfil público de alguien (su nombre, su avatar y si sus estadísticas son públicas). */
  perfil = async (req: AuthRequest, res: Response): Promise<void> => {
    const perfil = await this.service.perfil(String(req.params.userId));
    if (!perfil) {
      res.status(404).json({ error: 'Esa persona no existe.' });
      return;
    }
    res.json(perfil);
  };

  /** Quienes tienen sus estadísticas públicas. */
  publicos = async (_req: AuthRequest, res: Response): Promise<void> => {
    res.json(await this.service.publicos());
  };
}
