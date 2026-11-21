import { DatabaseRepository } from './DatabaseRepository';
import { RitualAttendee } from '../models/rituals';

/** Una persona apuntada, con el orden en que se aceptó su inscripción (en un evento gestionado). */
export interface RitualSignupRow extends RitualAttendee {
  acceptedSeq?: number;
}

export class RitualSignupRepository {
  /** La gente apuntada a esos rituales, en el orden en que se apuntó. */
  async listForRituals(ritualIds: string[]): Promise<Map<string, RitualSignupRow[]>> {
    const byRitual = new Map<string, RitualSignupRow[]>();
    if (ritualIds.length === 0) return byRitual;

    const db = await DatabaseRepository.getInstance();
    const rows = await db.all<any[]>(
      `SELECT s.ritualId, s.occurrence, s.userId, s.createdAt, s.acceptedAt, s.acceptedSeq, u.username, u.profilePicture
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
        signedUpAt: row.createdAt,
        acceptedAt: row.acceptedAt ?? undefined,
        acceptedSeq: row.acceptedSeq ?? undefined
      });
    }
    return byRitual;
  }

  /** La inscripción de alguien, si la tiene. */
  async find(ritualId: string, occurrence: string, userId: string): Promise<{ acceptedAt?: string } | undefined> {
    const db = await DatabaseRepository.getInstance();
    const row = await db.get<any>(
      'SELECT acceptedAt FROM ritual_signups WHERE ritualId = ? AND occurrence = ? AND userId = ?',
      [ritualId, occurrence, userId]
    );
    return row ? { acceptedAt: row.acceptedAt ?? undefined } : undefined;
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

  /**
   * Da por aceptada la inscripción de alguien (y la crea si no la había pedido), detrás
   * de las ya aceptadas. Devuelve false si ya estaba aceptada.
   */
  async accept(ritualId: string, occurrence: string, userId: string): Promise<boolean> {
    const db = await DatabaseRepository.getInstance();
    const now = new Date().toISOString();
    // Cada sentencia es atómica por sí misma (y el número de orden se calcula dentro del
    // UPDATE): sin transacción explícita, que en la conexión compartida chocaría con otras.
    await db.run(
      `INSERT OR IGNORE INTO ritual_signups (ritualId, occurrence, userId, createdAt) VALUES (?, ?, ?, ?)`,
      [ritualId, occurrence, userId, now]
    );
    const result = await db.run(
      `UPDATE ritual_signups
          SET acceptedAt = ?,
              acceptedSeq = (SELECT COALESCE(MAX(acceptedSeq), 0) + 1 FROM ritual_signups WHERE ritualId = ? AND occurrence = ?)
        WHERE ritualId = ? AND occurrence = ? AND userId = ? AND acceptedAt IS NULL`,
      [now, ritualId, occurrence, ritualId, occurrence, userId]
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
