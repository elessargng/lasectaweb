import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import type { ConfiguracionJarvis, JarvisConfiguracionRepository } from '../repositories/JarvisConfiguracionRepository';
import { baseJev, ClienteJevHttp, ENDPOINT_JEV, MODELO_JEV, type DatosJev } from '../services/narradorVirtual/jev/ClienteJevHttp';
import { cifradoDisponible } from '../utils/cifrado';

const MAX_TEXTO = 200;
const MAX_KEY = 500;

/** Lo que ve el usuario de su configuración: nunca la key (solo si la hay y en qué termina). */
const publica = (c: ConfiguracionJarvis | null) => ({
  endpoint: c?.endpoint ?? ENDPOINT_JEV,
  modelo: c?.modelo ?? MODELO_JEV,
  tieneKey: !!c,
  ultimos4: c ? c.apiKey.slice(-4) : null,
  comprobadoEn: c?.comprobadoEn ?? null,
});

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim() : '').slice(0, max + 1);

/**
 * El modelo JEV que engancha cada usuario para que guíe a Jarvis: se guarda (la key
 * cifrada) y se comprueba que responde; solo entonces puede añadir a Jarvis.
 */
export class JarvisConfiguracionController {
  constructor(
    private readonly repo: JarvisConfiguracionRepository,
    /** El cliente del modelo (en los tests, uno falso). */
    private readonly cliente: (datos: DatosJev) => { comprobar(): Promise<string | null> } = (d) => new ClienteJevHttp(d),
  ) {}

  get = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      res.json(publica(await this.repo.get(req.user!.id)));
    } catch {
      res.status(500).json({ error: 'No se pudo cargar la configuración de Jarvis.' });
    }
  };

  /** Guarda (sin key, se queda la que había) y comprueba. Responde la configuración y, si no responde, por qué. */
  guardar = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      if (!cifradoDisponible()) {
        res.status(503).json({ error: 'El servidor no tiene configurada la clave para guardar keys (JARVIS_CIFRADO_KEY).' });
        return;
      }
      // Se guarda la base (si pegan la dirección entera de la ruta, se le quita)
      const endpoint = baseJev(texto(req.body?.endpoint, MAX_TEXTO)) || ENDPOINT_JEV;
      const modelo = texto(req.body?.modelo, MAX_TEXTO) || MODELO_JEV;
      const nueva = texto(req.body?.apiKey, MAX_KEY);
      if (!/^https:\/\/[^\s/]+/.test(endpoint) || endpoint.length > MAX_TEXTO) {
        res.status(400).json({ error: 'El endpoint tiene que ser una dirección https://.', campo: 'endpoint' });
        return;
      }
      if (modelo.length > MAX_TEXTO || /\s/.test(modelo)) {
        res.status(400).json({ error: 'El modelo no es válido.', campo: 'modelo' });
        return;
      }
      if (nueva.length > MAX_KEY) {
        res.status(400).json({ error: 'La key es demasiado larga.', campo: 'apiKey' });
        return;
      }
      const apiKey = nueva || (await this.repo.get(userId))?.apiKey;
      if (!apiKey) {
        res.status(400).json({ error: 'Falta la key.', campo: 'apiKey' });
        return;
      }
      await this.repo.set(userId, { endpoint, modelo, apiKey });
      const error = await this.comprobarYApuntar(userId, { endpoint, modelo, apiKey });
      res.json({ ...publica(await this.repo.get(userId)), error });
    } catch {
      res.status(500).json({ error: 'No se pudo guardar la configuración de Jarvis.' });
    }
  };

  comprobar = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const actual = await this.repo.get(userId);
      if (!actual) {
        res.status(404).json({ error: 'Aún no has configurado el modelo.' });
        return;
      }
      const error = await this.comprobarYApuntar(userId, actual);
      res.json({ ...publica(await this.repo.get(userId)), error });
    } catch {
      res.status(500).json({ error: 'No se pudo comprobar el modelo.' });
    }
  };

  borrar = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      await this.repo.borrar(req.user!.id);
      res.status(204).end();
    } catch {
      res.status(500).json({ error: 'No se pudo quitar la configuración de Jarvis.' });
    }
  };

  private async comprobarYApuntar(userId: string, datos: DatosJev): Promise<string | null> {
    const error = await this.cliente(datos).comprobar();
    await this.repo.marcarComprobado(userId, error ? null : new Date().toISOString());
    return error;
  }
}
