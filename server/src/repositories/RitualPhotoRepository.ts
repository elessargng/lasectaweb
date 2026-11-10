import { DatabaseRepository } from './DatabaseRepository';
import { RitualPhoto } from '../models/rituals';

/** Una foto con el evento al que pertenece. */
export type RitualPhotoEn = RitualPhoto & { ritualId: string };

const SELECT_PHOTO = `
  SELECT p.*, u.username AS uploadedByUsername
    FROM ritual_photos p
    LEFT JOIN users u ON u.id = p.uploadedBy
`;

export class RitualPhotoRepository {
  /** Las fotos de esos eventos, en el orden en que se subieron. */
  async listForRituals(ritualIds: string[]): Promise<Map<string, RitualPhoto[]>> {
    const byRitual = new Map<string, RitualPhoto[]>();
    if (ritualIds.length === 0) return byRitual;

    const db = await DatabaseRepository.getInstance();
    const rows = await db.all<any[]>(
      `${SELECT_PHOTO} WHERE p.ritualId IN (${ritualIds.map(() => '?').join(', ')}) ORDER BY p.createdAt ASC, p.id ASC`,
      ritualIds
    );
    for (const row of rows) {
      if (!byRitual.has(row.ritualId)) byRitual.set(row.ritualId, []);
      byRitual.get(row.ritualId)!.push(this.mapRow(row));
    }
    return byRitual;
  }

  async findById(id: string): Promise<RitualPhotoEn | undefined> {
    const db = await DatabaseRepository.getInstance();
    const row = await db.get<any>(`${SELECT_PHOTO} WHERE p.id = ?`, [id]);
    return row ? { ...this.mapRow(row), ritualId: row.ritualId } : undefined;
  }

  /** Cuántas ha subido alguien a un evento. */
  async countByUser(ritualId: string, userId: string): Promise<number> {
    const db = await DatabaseRepository.getInstance();
    const row = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM ritual_photos WHERE ritualId = ? AND uploadedBy = ?', [ritualId, userId]);
    return row?.n ?? 0;
  }

  async add(ritualId: string, photos: RitualPhoto[]): Promise<void> {
    const db = await DatabaseRepository.getInstance();
    await db.exec('BEGIN TRANSACTION;');
    try {
      for (const p of photos) {
        await db.run(
          'INSERT INTO ritual_photos (id, ritualId, src, alt, public, uploadedBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [p.id, ritualId, p.src, p.alt, p.public ? 1 : 0, p.uploadedBy, p.uploadedAt]
        );
      }
      await db.exec('COMMIT;');
    } catch (error) {
      await db.exec('ROLLBACK;');
      throw error;
    }
  }

  async setPublic(id: string, isPublic: boolean): Promise<void> {
    const db = await DatabaseRepository.getInstance();
    await db.run('UPDATE ritual_photos SET public = ? WHERE id = ?', [isPublic ? 1 : 0, id]);
  }

  async delete(id: string): Promise<void> {
    const db = await DatabaseRepository.getInstance();
    await db.run('DELETE FROM ritual_photos WHERE id = ?', [id]);
  }

  private mapRow(row: any): RitualPhoto {
    return {
      id: row.id,
      src: row.src,
      alt: row.alt,
      public: !!row.public,
      uploadedBy: row.uploadedBy,
      uploadedByUsername: row.uploadedByUsername ?? undefined,
      uploadedAt: row.createdAt
    };
  }
}
