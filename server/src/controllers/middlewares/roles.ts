import { NextFunction, Response } from 'express';
import { AuthRequest } from './auth';

/**
 * Deja pasar solo a quien tenga ese rol (va después de authenticateJWT). Los
 * roles se consultan en cada petición: quitar un rol surte efecto al momento.
 */
export const exigirRol =
  (rol: string, buscarRoles: (usuarioId: string) => Promise<string[] | null>) =>
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const roles = req.user ? await buscarRoles(req.user.id) : null;
      if (!roles?.includes(rol)) {
        res.status(403).json({ error: 'No tienes permisos para ver esto.' });
        return;
      }
      next();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
