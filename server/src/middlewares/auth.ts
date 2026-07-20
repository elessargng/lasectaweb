import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
  };
}

export const authenticateJWT = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1];
    const JWT_SECRET = process.env.JWT_SECRET || 'secret';

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        res.status(403).json({ error: 'Tu sesión ha expirado o el token es inválido. Por favor, vuelve a iniciar sesión.' });
        return;
      }

      req.user = user as any;
      next();
    });
  } else {
    res.status(401).json({ error: 'No autorizado. Token no proporcionado.' });
  }
};
