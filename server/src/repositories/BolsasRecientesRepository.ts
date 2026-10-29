import { DatabaseRepository } from './DatabaseRepository';

/** Las bolsas que se guardan de cada usuario. */
export const BOLSAS_RECIENTES = 5;

/**
 * Las bolsas que ha montado el narrador virtual en las últimas partidas de cada
 * usuario (las BOLSAS_RECIENTES últimas), para que no repita siempre la misma.
 */
export class BolsasRecientesRepository {
  /** Las suyas, la más reciente primero (cada una, sus personajes). */
  async de(userId: string): Promise<string[][]> {
    const db = await DatabaseRepository.getInstance();
    const filas = await db.all<{ personajes: string }[]>(
      'SELECT personajes FROM narrador_bolsas_recientes WHERE userId = ? ORDER BY id DESC LIMIT ?',
      [userId, BOLSAS_RECIENTES],
    );
    return filas.map((f) => JSON.parse(f.personajes) as string[]);
  }

  /** Apunta una y borra las que ya no están entre las últimas. */
  async apuntar(userId: string, personajes: string[]): Promise<void> {
    const db = await DatabaseRepository.getInstance();
    await db.run('INSERT INTO narrador_bolsas_recientes (userId, personajes, creadaEn) VALUES (?, ?, ?)', [
      userId,
      JSON.stringify(personajes),
      new Date().toISOString(),
    ]);
    await db.run(
      `DELETE FROM narrador_bolsas_recientes WHERE userId = ? AND id NOT IN
         (SELECT id FROM narrador_bolsas_recientes WHERE userId = ? ORDER BY id DESC LIMIT ?)`,
      [userId, userId, BOLSAS_RECIENTES],
    );
  }
}
