import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
  };
  file?: any;
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
