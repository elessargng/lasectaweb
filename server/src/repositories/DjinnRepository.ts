import { DatabaseRepository } from './DatabaseRepository';
import { ReglaDjinn } from '../types/guiones';

/**
 * Las reglas del Djinn (tabla reglas_djinn), copia local de las de la fuente.
 * Solo guarda y lee: no sabe de dónde vienen ni cómo se sincronizan.
 */
export class DjinnRepository {
  /** Las reglas entre dos de estos personajes (las dos mitades del par, entre los ids). */
  async entrePersonajes(ids: string[]): Promise<ReglaDjinn[]> {
    if (ids.length < 2) return [];
    const db = await DatabaseRepository.getInstance();
    const marcas = ids.map(() => '?').join(', ');
    const filas = await db.all<any[]>(
      `SELECT * FROM reglas_djinn WHERE personajeA IN (${marcas}) AND personajeB IN (${marcas})
       ORDER BY personajeA, personajeB`,
      [...ids, ...ids],
    );
    return filas.map((f) => ({ personajes: [f.personajeA, f.personajeB], texto: f.texto }));
  }

  /** Cuándo se sincronizó por última vez, o null si no hay ninguna regla. */
  async ultimaSincronizacion(): Promise<Date | null> {
    const db = await DatabaseRepository.getInstance();
    const fila = await db.get<{ ultima: string | null }>('SELECT MAX(sincronizadoEn) AS ultima FROM reglas_djinn');
    return fila?.ultima ? new Date(fila.ultima) : null;
  }

  /**
   * Sustituye todas las reglas por estas, de una vez (si algo falla a medias, se
   * quedan las anteriores). Un par repetido se queda con la primera.
   */
  async reemplazarTodas(reglas: ReglaDjinn[], sincronizadoEn: string): Promise<void> {
    const db = await DatabaseRepository.getInstance();
    await db.exec('BEGIN TRANSACTION;');
    try {
      await db.run('DELETE FROM reglas_djinn');
      for (const r of reglas) {
        await db.run(
          `INSERT INTO reglas_djinn (personajeA, personajeB, texto, sincronizadoEn) VALUES (?, ?, ?, ?)
           ON CONFLICT(personajeA, personajeB) DO NOTHING`,
          [r.personajes[0], r.personajes[1], r.texto, sincronizadoEn],
        );
      }
      await db.exec('COMMIT;');
    } catch (e) {
      await db.exec('ROLLBACK;');
      throw e;
    }
  }
}
