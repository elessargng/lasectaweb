import { DatabaseRepository } from './DatabaseRepository';
import { RitualAttendee } from '../types/rituals';

export class RitualSignupRepository {
  /** La gente apuntada a esos rituales, en el orden en que se apuntó. */
  async listForRituals(ritualIds: string[]): Promise<Map<string, RitualAttendee[]>> {
    const byRitual = new Map<string, RitualAttendee[]>();
    if (ritualIds.length === 0) return byRitual;

    const db = await DatabaseRepository.getInstance();
    const rows = await db.all<any[]>(
      `SELECT s.ritualId, s.occurrence, s.userId, s.createdAt, u.username, u.profilePicture
         FROM ritual_signups s
         JOIN users u ON u.id = s.userId
        WHERE s.ritualId IN (${ritualIds.map(() => '?').join(', ')})
        ORDER BY s.id ASC`,
      ritualIds
    );
    for (const row of rows) {
      if (!byRitual.has(row.ritualId)) byRitual.set(row.ritualId, []);
      byRitual.get(row.ritualId)!.push({
        occurrence: row.occurrence,
        userId: row.userId,
        username: row.username,
        profilePicture: row.profilePicture ?? undefined,
        signedUpAt: row.createdAt
      });
    }
    return byRitual;
  }

  /** Apunta a alguien. Devuelve false si ya estaba apuntado. */
  async add(ritualId: string, occurrence: string, userId: string): Promise<boolean> {
    const db = await DatabaseRepository.getInstance();
    const result = await db.run(
      `INSERT OR IGNORE INTO ritual_signups (ritualId, occurrence, userId, createdAt) VALUES (?, ?, ?, ?)`,
      [ritualId, occurrence, userId, new Date().toISOString()]
    );
    return (result.changes ?? 0) > 0;
  }

  /** Desapunta a alguien. Devuelve false si no estaba apuntado. */
  async remove(ritualId: string, occurrence: string, userId: string): Promise<boolean> {
    const db = await DatabaseRepository.getInstance();
    const result = await db.run(
      'DELETE FROM ritual_signups WHERE ritualId = ? AND occurrence = ? AND userId = ?',
      [ritualId, occurrence, userId]
    );
    return (result.changes ?? 0) > 0;
  }
}
