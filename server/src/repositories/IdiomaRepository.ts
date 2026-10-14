import { DatabaseRepository } from './DatabaseRepository';
import { Idioma } from '../types/guiones';

const COLUMNAS = 'id, nombre, codigo, tieneGeneros';
const aModelo = (f: any): Idioma => ({ id: f.id, nombre: f.nombre, codigo: f.codigo, tieneGeneros: !!f.tieneGeneros });

/** Los idiomas (paquetes de traducción) de los personajes (tabla idiomas). Solo guarda y lee. */
export class IdiomaRepository {
  async listar(): Promise<Idioma[]> {
    const db = await DatabaseRepository.getInstance();
    const filas = await db.all<any[]>(`SELECT ${COLUMNAS} FROM idiomas ORDER BY nombre COLLATE NOCASE`);
    return filas.map(aModelo);
  }

  async buscar(id: string): Promise<Idioma | undefined> {
    const db = await DatabaseRepository.getInstance();
    const fila = await db.get<any>(`SELECT ${COLUMNAS} FROM idiomas WHERE id = ?`, [id]);
    return fila ? aModelo(fila) : undefined;
  }

  /**
   * Cuándo se sincronizó por última vez (el más reciente), o null si no hay
   * ninguno. Para forzar que se vuelva a sincronizar, se marcan todos como caducados.
   */
  async ultimaSincronizacion(): Promise<Date | null> {
    const db = await DatabaseRepository.getInstance();
    const fila = await db.get<{ ultima: string | null }>('SELECT MAX(sincronizadoEn) AS ultima FROM idiomas');
    return fila?.ultima ? new Date(fila.ultima) : null;
  }

  async guardar(idioma: Idioma, sincronizadoEn: string): Promise<void> {
    const db = await DatabaseRepository.getInstance();
    await db.run(
      `INSERT INTO idiomas (id, nombre, codigo, tieneGeneros, sincronizadoEn) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET nombre = excluded.nombre, codigo = excluded.codigo,
         tieneGeneros = excluded.tieneGeneros, sincronizadoEn = excluded.sincronizadoEn`,
      [idioma.id, idioma.nombre, idioma.codigo, idioma.tieneGeneros ? 1 : 0, sincronizadoEn],
    );
  }
}
