import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { SalaConfiguracionRepository } from '../repositories/SalaConfiguracionRepository';

/** Tope de lo que ocupa una configuración (preferencias, avisos y atajos caben de sobra). */
const MAX_BYTES = 16 * 1024;
const MAX_PERFILES = 20;
const NOMBRE_MAX = 40;
/** Comunicaciones (cámara y micrófono) e imagen de perfil no se guardan nunca. */
const CLAVES_EXCLUIDAS = ['idCamara', 'idMicrofono', 'avatar'];

/** Los datos como JSON listos para guardar, o un error si no valen. */
function serializar(datos: unknown): string | { error: string } {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return { error: 'La configuración no es válida.' };
  const limpios = JSON.parse(JSON.stringify(datos)) as Record<string, unknown>;
  for (const clave of CLAVES_EXCLUIDAS) delete limpios[clave];
  const preferencias = limpios.preferencias as Record<string, unknown> | undefined;
  if (preferencias && typeof preferencias === 'object') {
    for (const clave of CLAVES_EXCLUIDAS) delete preferencias[clave];
  }
  const texto = JSON.stringify(limpios);
  if (Buffer.byteLength(texto) > MAX_BYTES) return { error: 'La configuración es demasiado grande.' };
  return texto;
}

export class SalaConfiguracionController {
  constructor(private repo: SalaConfiguracionRepository) {}

  /** La configuración actual y los perfiles del usuario. */
  get = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const [actual, perfiles] = await Promise.all([this.repo.getActual(userId), this.repo.listPerfiles(userId)]);
      res.json({ actual, perfiles });
    } catch {
      res.status(500).json({ error: 'No se pudo cargar tu configuración.' });
    }
  };

  guardarActual = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const datos = serializar(req.body?.datos);
      if (typeof datos !== 'string') {
        res.status(400).json(datos);
        return;
      }
      await this.repo.setActual(req.user!.id, datos);
      res.status(204).end();
    } catch {
      res.status(500).json({ error: 'No se pudo guardar tu configuración.' });
    }
  };

  guardarPerfil = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.replace(/\s+/g, ' ').trim() : '';
      if (!nombre || nombre.length > NOMBRE_MAX) {
        res.status(400).json({ error: `El nombre del perfil debe tener entre 1 y ${NOMBRE_MAX} caracteres.` });
        return;
      }
      const datos = serializar(req.body?.datos);
      if (typeof datos !== 'string') {
        res.status(400).json(datos);
        return;
      }
      if (!(await this.repo.existePerfil(userId, nombre)) && (await this.repo.contarPerfiles(userId)) >= MAX_PERFILES) {
        res.status(400).json({ error: `Puedes tener como mucho ${MAX_PERFILES} perfiles. Borra alguno antes.` });
        return;
      }
      await this.repo.guardarPerfil(userId, nombre, datos);
      res.json({ perfiles: await this.repo.listPerfiles(userId) });
    } catch {
      res.status(500).json({ error: 'No se pudo guardar el perfil.' });
    }
  };

  borrarPerfil = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || !(await this.repo.borrarPerfil(userId, id))) {
        res.status(404).json({ error: 'Ese perfil no existe.' });
        return;
      }
      res.json({ perfiles: await this.repo.listPerfiles(userId) });
    } catch {
      res.status(500).json({ error: 'No se pudo borrar el perfil.' });
    }
  };
}
