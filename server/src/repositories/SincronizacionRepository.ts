import { DatabaseRepository } from './DatabaseRepository';

/** Cómo fue la última vez que se sincronizó algo con una fuente externa. */
export interface EstadoSincronizacion {
  /** Qué se sincroniza («personajes», «traducciones»). */
  id: string;
  ultimoIntento: string;
  /** La última vez que salió bien; null si nunca. */
  ultimoExito: string | null;
  /** Por qué falló el último intento; null si salió bien. */
  error: string | null;
}

/** El estado de las sincronizaciones (tabla sincronizaciones). Solo guarda y lee. */
export class SincronizacionRepository {
  async listar(): Promise<EstadoSincronizacion[]> {
    const db = await DatabaseRepository.getInstance();
    return db.all<EstadoSincronizacion[]>('SELECT id, ultimoIntento, ultimoExito, error FROM sincronizaciones ORDER BY id');
  }

  async registrarExito(id: string, fecha: string): Promise<void> {
    const db = await DatabaseRepository.getInstance();
    await db.run(
      `INSERT INTO sincronizaciones (id, ultimoIntento, ultimoExito, error) VALUES (?, ?, ?, NULL)
       ON CONFLICT(id) DO UPDATE SET ultimoIntento = excluded.ultimoIntento, ultimoExito = excluded.ultimoExito, error = NULL`,
      [id, fecha, fecha],
    );
  }

  /** Un fallo no toca la fecha del último éxito. */
  async registrarFallo(id: string, fecha: string, error: string): Promise<void> {
    const db = await DatabaseRepository.getInstance();
    await db.run(
      `INSERT INTO sincronizaciones (id, ultimoIntento, ultimoExito, error) VALUES (?, ?, NULL, ?)
       ON CONFLICT(id) DO UPDATE SET ultimoIntento = excluded.ultimoIntento, error = excluded.error`,
      [id, fecha, error],
    );
  }
}
