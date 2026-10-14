import { DatabaseRepository } from './DatabaseRepository';
import { Genero, TraduccionPersonaje } from '../types/guiones';

/** Las traducciones de un idioma en un género, o sin género (null) si el idioma no los distingue. */
export interface VarianteTraducciones {
  genero: Genero | null;
  traducciones: TraduccionPersonaje[];
}

/**
 * Las traducciones de los personajes, por idioma y género (tabla
 * traducciones_personajes; genero '' en los idiomas que no lo distinguen).
 * Solo guarda y lee.
 */
export class TraduccionRepository {
  /** Las de ese género o, si el idioma no distingue géneros, las únicas que tiene. */
  async deIdioma(idiomaId: string, genero: Genero): Promise<TraduccionPersonaje[]> {
    const db = await DatabaseRepository.getInstance();
    const filas = await db.all<any[]>(
      `SELECT * FROM traducciones_personajes WHERE idiomaId = ? AND genero IN ('', ?) ORDER BY personajeId`,
      [idiomaId, genero],
    );
    return filas.map((f) => ({
      personajeId: f.personajeId,
      nombre: f.nombre,
      habilidad: f.habilidad,
      recordatorios: f.recordatorios,
      recordatoriosGlobales: f.recordatoriosGlobales,
      recordatorioPrimeraNoche: f.primeraNocheRecordatorio,
      recordatorioOtrasNoches: f.otrasNochesRecordatorio,
    }));
  }

  /**
   * Sustituye todas las traducciones de un idioma por estas variantes, de una
   * vez (si algo falla a medias, se quedan las anteriores).
   */
  async reemplazarDeIdioma(idiomaId: string, variantes: VarianteTraducciones[]): Promise<void> {
    const db = await DatabaseRepository.getInstance();
    await db.exec('BEGIN TRANSACTION;');
    try {
      await db.run('DELETE FROM traducciones_personajes WHERE idiomaId = ?', [idiomaId]);
      for (const { genero, traducciones } of variantes) {
        for (const t of traducciones) {
          await db.run(
            `INSERT INTO traducciones_personajes (idiomaId, genero, personajeId, nombre, habilidad, recordatorios,
               recordatoriosGlobales, primeraNocheRecordatorio, otrasNochesRecordatorio)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(idiomaId, genero, personajeId) DO NOTHING`,
            [
              idiomaId,
              genero ?? '',
              t.personajeId,
              t.nombre,
              t.habilidad,
              t.recordatorios,
              t.recordatoriosGlobales,
              t.recordatorioPrimeraNoche,
              t.recordatorioOtrasNoches,
            ],
          );
        }
      }
      await db.exec('COMMIT;');
    } catch (e) {
      await db.exec('ROLLBACK;');
      throw e;
    }
  }
}
