import { cifrar, descifrar } from '../utils/cifrado';
import { DatabaseRepository } from './DatabaseRepository';

/** Cómo engancha un usuario el modelo JEV que guía a Jarvis (la key, ya descifrada). */
export interface ConfiguracionJarvis {
  endpoint: string;
  modelo: string;
  apiKey: string;
  /** Cuándo se comprobó que respondía (ISO), o null. */
  comprobadoEn: string | null;
}

interface Fila {
  endpoint: string;
  modelo: string;
  apiKey: string;
  comprobadoEn: string | null;
}

/** La configuración de Jarvis de cada usuario. La key se guarda cifrada (ver utils/cifrado). */
export class JarvisConfiguracionRepository {
  /** La suya, o null si no tiene (o su key no se puede descifrar). */
  async get(userId: string): Promise<ConfiguracionJarvis | null> {
    const db = await DatabaseRepository.getInstance();
    const fila = await db.get<Fila>('SELECT endpoint, modelo, apiKey, comprobadoEn FROM jarvis_configuracion WHERE userId = ?', [userId]);
    if (!fila) return null;
    const apiKey = descifrar(fila.apiKey);
    return apiKey === null ? null : { ...fila, apiKey };
  }

  /** La guarda (con la key en claro: se cifra aquí); sin comprobar. */
  async set(userId: string, { endpoint, modelo, apiKey }: Omit<ConfiguracionJarvis, 'comprobadoEn'>): Promise<void> {
    const db = await DatabaseRepository.getInstance();
    await db.run(
      `INSERT INTO jarvis_configuracion (userId, endpoint, modelo, apiKey, comprobadoEn, actualizadoEn) VALUES (?, ?, ?, ?, NULL, ?)
       ON CONFLICT(userId) DO UPDATE SET endpoint = excluded.endpoint, modelo = excluded.modelo, apiKey = excluded.apiKey,
         comprobadoEn = NULL, actualizadoEn = excluded.actualizadoEn`,
      [userId, endpoint, modelo, cifrar(apiKey), new Date().toISOString()],
    );
  }

  /** Apunta si ha respondido al comprobarla (null: no). */
  async marcarComprobado(userId: string, comprobadoEn: string | null): Promise<void> {
    const db = await DatabaseRepository.getInstance();
    await db.run('UPDATE jarvis_configuracion SET comprobadoEn = ? WHERE userId = ?', [comprobadoEn, userId]);
  }

  async borrar(userId: string): Promise<void> {
    const db = await DatabaseRepository.getInstance();
    await db.run('DELETE FROM jarvis_configuracion WHERE userId = ?', [userId]);
  }
}
