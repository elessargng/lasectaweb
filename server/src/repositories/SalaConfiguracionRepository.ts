import { DatabaseRepository } from './DatabaseRepository';

/** Un perfil de configuración de la sala: un nombre y los datos (JSON). */
export interface PerfilSala {
  id: number;
  nombre: string;
  datos: unknown;
  actualizadoEn: string;
}

const leerJson = (texto: string): unknown => {
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
};

export class SalaConfiguracionRepository {
  /** La configuración que tiene puesta el usuario, o null si nunca ha guardado. */
  async getActual(userId: string): Promise<unknown> {
    const db = await DatabaseRepository.getInstance();
    const row = await db.get<{ datos: string }>('SELECT datos FROM sala_configuracion WHERE userId = ?', [userId]);
    return row ? leerJson(row.datos) : null;
  }

  async setActual(userId: string, datos: string): Promise<void> {
    const db = await DatabaseRepository.getInstance();
    await db.run(
      `INSERT INTO sala_configuracion (userId, datos, actualizadoEn) VALUES (?, ?, ?)
       ON CONFLICT(userId) DO UPDATE SET datos = excluded.datos, actualizadoEn = excluded.actualizadoEn`,
      [userId, datos, new Date().toISOString()]
    );
  }

  /** Sus perfiles, por nombre. */
  async listPerfiles(userId: string): Promise<PerfilSala[]> {
    const db = await DatabaseRepository.getInstance();
    const rows = await db.all<{ id: number; nombre: string; datos: string; actualizadoEn: string }[]>(
      'SELECT id, nombre, datos, actualizadoEn FROM sala_perfiles WHERE userId = ? ORDER BY nombre COLLATE NOCASE',
      [userId]
    );
    return rows.map((r) => ({ ...r, datos: leerJson(r.datos) }));
  }

  async contarPerfiles(userId: string): Promise<number> {
    const db = await DatabaseRepository.getInstance();
    const row = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM sala_perfiles WHERE userId = ?', [userId]);
    return row?.n ?? 0;
  }

  async existePerfil(userId: string, nombre: string): Promise<boolean> {
    const db = await DatabaseRepository.getInstance();
    return !!(await db.get('SELECT 1 FROM sala_perfiles WHERE userId = ? AND nombre = ?', [userId, nombre]));
  }

  /** Guarda un perfil; si ya tiene uno con ese nombre (sin distinguir mayúsculas), lo sustituye. */
  async guardarPerfil(userId: string, nombre: string, datos: string): Promise<void> {
    const db = await DatabaseRepository.getInstance();
    await db.run(
      `INSERT INTO sala_perfiles (userId, nombre, datos, actualizadoEn) VALUES (?, ?, ?, ?)
       ON CONFLICT(userId, nombre) DO UPDATE SET nombre = excluded.nombre, datos = excluded.datos,
         actualizadoEn = excluded.actualizadoEn`,
      [userId, nombre, datos, new Date().toISOString()]
    );
  }

  /** Borra uno de sus perfiles. Devuelve false si no era suyo o no existía. */
  async borrarPerfil(userId: string, id: number): Promise<boolean> {
    const db = await DatabaseRepository.getInstance();
    const result = await db.run('DELETE FROM sala_perfiles WHERE id = ? AND userId = ?', [id, userId]);
    return (result.changes ?? 0) > 0;
  }
}
