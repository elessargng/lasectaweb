import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
  };
  file?: any;
}

/** El usuario de un token de la web, o null si está caducado o es falso. */
export function usuarioDelToken(token: string): { id: string; username: string } | null {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    if (typeof payload === 'object' && typeof payload.username === 'string' && typeof payload.id === 'string') {
      return { id: payload.id, username: payload.username };
    }
  } catch {
    // Token caducado o falso.
  }
  return null;
}

export const authenticateJWT =(req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1];
    const JWT_SECRET = process.env.JWT_SECRET || 'secret';

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        // 401 (no 403) y un código propio: el cliente lo usa para dar la sesión por
        // cerrada, y no confundirlo con un «no tienes permisos».
        res.status(401).json({ error: 'Tu sesión ha caducado. Vuelve a iniciar sesión.', code: 'SESSION_EXPIRED' });
        return;
      }

      req.user = user as any;
      next();
    });
  } else {
    res.status(401).json({ error: 'Necesitas iniciar sesión para hacer esto.', code: 'NO_SESSION' });
  }
};

export const optionalAuthenticateJWT = (req: AuthRequest, res: Response, next: NextFunction): void => {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token as string;
  }

  if (token) {
    const JWT_SECRET = process.env.JWT_SECRET || 'secret';
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (!err && user) {
        req.user = user as any;
      }
      next();
    });
  } else {
    next();
  }
};
