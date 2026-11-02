import { Response } from 'express';
import { AuthRequest } from './middlewares/auth';
import { ConfiguracionError, SalaConfiguracionService } from '../services/SalaConfiguracionService';

/** Si lo pedido no vale, un 400 con el motivo; si falla otra cosa, un 500 con `mensaje`. */
function responderError(res: Response, error: unknown, mensaje: string): void {
  if (error instanceof ConfiguracionError) res.status(400).json({ error: error.message });
  else res.status(500).json({ error: mensaje });
}

export class SalaConfiguracionController {
  constructor(private salaConfiguracionService: SalaConfiguracionService) {}

  /** La configuración actual y los perfiles del usuario. */
  get = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      res.json(await this.salaConfiguracionService.obtener(req.user!.id));
    } catch (error) {
      responderError(res, error, 'No se pudo cargar tu configuración.');
    }
  };

  guardarActual = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      await this.salaConfiguracionService.guardarActual(req.user!.id, req.body?.datos);
      res.status(204).end();
    } catch (error) {
      responderError(res, error, 'No se pudo guardar tu configuración.');
    }
  };

  guardarPerfil = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const perfiles = await this.salaConfiguracionService.guardarPerfil(req.user!.id, req.body?.nombre, req.body?.datos);
      res.json({ perfiles });
    } catch (error) {
      responderError(res, error, 'No se pudo guardar el perfil.');
    }
  };

  borrarPerfil = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const perfiles = await this.salaConfiguracionService.borrarPerfil(req.user!.id, Number(req.params.id));
      if (!perfiles) {
        res.status(404).json({ error: 'Ese perfil no existe.' });
        return;
      }
      res.json({ perfiles });
    } catch (error) {
      responderError(res, error, 'No se pudo borrar el perfil.');
    }
  };
}
