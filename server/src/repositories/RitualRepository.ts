import { DatabaseRepository } from './DatabaseRepository';
import { Ritual, RitualInput } from '../types/rituals';

const SELECT_RITUAL = `
  SELECT r.*, st.username AS storytellerUsername, cb.username AS createdByUsername
    FROM rituals r
    LEFT JOIN users st ON r.storytellerId = st.id
    LEFT JOIN users cb ON r.createdBy = cb.id
`;

export class RitualRepository {
  /**
   * Rituales que pueden caer en el intervalo [from, to): los que empiezan
   * dentro, las jornadas de varios días que empezaron antes y siguen abiertas,
   * y las series periódicas que ya empezaron y no han terminado. Las
   * repeticiones concretas las calcula quien las muestra.
   */
  async listBetween(from: string, to: string): Promise<Ritual[]> {
    const db = await DatabaseRepository.getInstance();
    const rows = await db.all<any[]>(
      `${SELECT_RITUAL}
        WHERE r.startsAt < ?
          AND (
            (r.recurrenceDays IS NULL AND r.recurrenceMonths IS NULL AND COALESCE(r.endsAt, r.startsAt) >= ?)
            OR ((r.recurrenceDays IS NOT NULL OR r.recurrenceMonths IS NOT NULL)
                AND (r.recurrenceUntil IS NULL OR r.recurrenceUntil >= ?))
          )
        ORDER BY r.startsAt ASC`,
      [to, from, from]
    );
    return rows.map((row) => this.mapRow(row));
  }

  async findById(id: string): Promise<Ritual | undefined> {
    const db = await DatabaseRepository.getInstance();
    const row = await db.get<any>(`${SELECT_RITUAL} WHERE r.id = ?`, [id]);
    return row ? this.mapRow(row) : undefined;
  }

  async create(
    id: string,
    createdBy: string,
    input: RitualInput,
    villacuervos?: { playId: number; slug: string }
  ): Promise<void> {
    const db = await DatabaseRepository.getInstance();
    await db.run(
      `INSERT INTO rituals
         (id, type, managedBy, title, description, startsAt, endsAt, location, link,
          scriptName, maxPlayers, storytellerId, recurrenceDays, recurrenceMonths, recurrenceUntil,
          villacuervosPlayId, villacuervosSlug, status, createdBy, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.type,
        input.managedBy ?? null,
        input.title,
        input.description ?? null,
        input.startsAt,
        input.endsAt ?? null,
        input.location ?? null,
        input.link ?? null,
        input.scriptName ?? null,
        input.maxPlayers ?? null,
        input.storytellerId ?? null,
        input.recurrenceDays ?? null,
        input.recurrenceMonths ?? null,
        input.recurrenceUntil ?? null,
        villacuervos?.playId ?? null,
        villacuervos?.slug ?? null,
        input.status ?? 'programado',
        createdBy,
        new Date().toISOString()
      ]
    );
  }

  async update(id: string, input: RitualInput): Promise<void> {
    const db = await DatabaseRepository.getInstance();
    await db.run(
      `UPDATE rituals
          SET type = ?, managedBy = ?, title = ?, description = ?, startsAt = ?, endsAt = ?,
              location = ?, link = ?, scriptName = ?, maxPlayers = ?, storytellerId = ?,
              recurrenceDays = ?, recurrenceMonths = ?, recurrenceUntil = ?, status = ?, updatedAt = ?
        WHERE id = ?`,
      [
        input.type,
        input.managedBy ?? null,
        input.title,
        input.description ?? null,
        input.startsAt,
        input.endsAt ?? null,
        input.location ?? null,
        input.link ?? null,
        input.scriptName ?? null,
        input.maxPlayers ?? null,
        input.storytellerId ?? null,
        input.recurrenceDays ?? null,
        input.recurrenceMonths ?? null,
        input.recurrenceUntil ?? null,
        input.status ?? 'programado',
        new Date().toISOString(),
        id
      ]
    );
  }

  async delete(id: string): Promise<void> {
    const db = await DatabaseRepository.getInstance();
    await db.run('DELETE FROM rituals WHERE id = ?', [id]);
  }

  private mapRow(row: any): Ritual {
    return {
      id: row.id,
      type: row.type,
      managedBy: row.managedBy ?? undefined,
      title: row.title,
      description: row.description ?? undefined,
      startsAt: row.startsAt,
      endsAt: row.endsAt ?? undefined,
      location: row.location ?? undefined,
      link: row.link ?? undefined,
      scriptName: row.scriptName ?? undefined,
      maxPlayers: row.maxPlayers ?? undefined,
      storytellerId: row.storytellerId ?? undefined,
      storytellerUsername: row.storytellerUsername ?? undefined,
      recurrenceDays: row.recurrenceDays ?? undefined,
      recurrenceMonths: row.recurrenceMonths ?? undefined,
      recurrenceUntil: row.recurrenceUntil ?? undefined,
      villacuervosPlayId: row.villacuervosPlayId ?? undefined,
      villacuervosSlug: row.villacuervosSlug ?? undefined,
      status: row.status,
      createdBy: row.createdBy,
      createdByUsername: row.createdByUsername ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt ?? undefined,
      source: 'secta'
    };
  }
}
