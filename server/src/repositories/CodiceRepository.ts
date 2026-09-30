import crypto from 'crypto';
import { DatabaseRepository } from './DatabaseRepository';
import { computeVersionHash, verifyVersionChain, GENESIS_HASH } from '../utils/ledger';
import {
  CodiceSection,
  CodiceVersion,
  CodiceRule,
  RuleWithCurrent,
  SectionWithRules,
  RuleWithHistory,
  RuleKind,
  VersionOrigin
} from '../types/codice';

export class CodiceRepository {
  // ----------------------------------------------------------------- Secciones

  async listSections(): Promise<CodiceSection[]> {
    const db = await DatabaseRepository.getInstance();
    const rows = await db.all<any[]>(
      'SELECT * FROM codice_sections ORDER BY position ASC, number ASC'
    );
    return rows.map(this.mapSection);
  }

  async createSection(section: Omit<CodiceSection, 'id'>): Promise<CodiceSection> {
    const db = await DatabaseRepository.getInstance();
    const id = crypto.randomUUID();
    await db.run(
      'INSERT INTO codice_sections (id, number, title, icon, position) VALUES (?, ?, ?, ?, ?)',
      [id, section.number, section.title, section.icon ?? null, section.position]
    );
    return { id, ...section };
  }

  async findSectionByNumber(number: number): Promise<CodiceSection | undefined> {
    const db = await DatabaseRepository.getInstance();
    const row = await db.get<any>('SELECT * FROM codice_sections WHERE number = ?', [number]);
    return row ? this.mapSection(row) : undefined;
  }

  // -------------------------------------------------------------------- Normas

  /**
   * El Códice completo: secciones con sus normas vigentes.
   *
   * Las normas derogadas se excluyen por defecto —el Códice muestra lo que está
   * en vigor— pero su histórico sigue accesible por referencia.
   */
  async getCodice(includeRepealed = false): Promise<SectionWithRules[]> {
    const db = await DatabaseRepository.getInstance();
    const sections = await this.listSections();

    const rows = await db.all<any[]>(
      `SELECT r.*,
              v.id AS v_id, v.version AS v_version, v.body AS v_body,
              v.bullets AS v_bullets, v.proposalId AS v_proposalId,
              v.origin AS v_origin, v.changeNote AS v_changeNote,
              v.createdAt AS v_createdAt, v.prevHash AS v_prevHash,
              v.hash AS v_hash, v.proposalFinalHash AS v_proposalFinalHash,
              (SELECT COUNT(*) - 1 FROM codice_versions cv WHERE cv.ruleId = r.id) AS historyCount
         FROM codice_rules r
         LEFT JOIN codice_versions v ON v.id = r.currentVersionId
        ${includeRepealed ? '' : 'WHERE r.repealedAt IS NULL'}
        ORDER BY r.position ASC, r.reference ASC`
    );

    const bySection = new Map<string, RuleWithCurrent[]>();
    for (const row of rows) {
      const rule = this.mapRuleWithCurrent(row);
      const list = bySection.get(row.sectionId) ?? [];
      list.push(rule);
      bySection.set(row.sectionId, list);
    }

    return sections.map((section) => ({
      ...section,
      rules: bySection.get(section.id) ?? []
    }));
  }

  async findRuleById(id: string): Promise<CodiceRule | undefined> {
    const db = await DatabaseRepository.getInstance();
    const row = await db.get<any>('SELECT * FROM codice_rules WHERE id = ?', [id]);
    return row ? this.mapRule(row) : undefined;
  }

  async findRuleByReference(reference: string): Promise<CodiceRule | undefined> {
    const db = await DatabaseRepository.getInstance();
    const row = await db.get<any>('SELECT * FROM codice_rules WHERE reference = ?', [reference]);
    return row ? this.mapRule(row) : undefined;
  }

  /**
   * Una norma con todo su histórico, incluidos los datos de la votación que
   * aprobó cada versión.
   */
  async getRuleWithHistory(ruleId: string): Promise<RuleWithHistory | undefined> {
    const db = await DatabaseRepository.getInstance();

    const ruleRow = await db.get<any>(
      `SELECT r.*, s.number AS sectionNumber, s.title AS sectionTitle
         FROM codice_rules r
         JOIN codice_sections s ON r.sectionId = s.id
        WHERE r.id = ?`,
      [ruleId]
    );
    if (!ruleRow) return undefined;

    const versionRows = await db.all<any[]>(
      `SELECT v.*,
              p.title AS proposalTitle,
              p.closedAt AS proposalClosedAt,
              p.finalHash AS currentProposalHash
         FROM codice_versions v
         LEFT JOIN plaza_proposals p ON v.proposalId = p.id
        WHERE v.ruleId = ?
        ORDER BY v.version DESC`,
      [ruleId]
    );

    return {
      ...this.mapRule(ruleRow),
      sectionNumber: ruleRow.sectionNumber,
      sectionTitle: ruleRow.sectionTitle,
      versions: versionRows.map((row) => ({
        ...this.mapVersion(row),
        proposalTitle: row.proposalTitle ?? undefined,
        proposalClosedAt: row.proposalClosedAt ? new Date(row.proposalClosedAt) : undefined,
        // La huella sellada en la versión, no la que tenga la propuesta ahora:
        // si difirieran, es justo lo que la verificación debe detectar.
        proposalFinalHash: row.proposalFinalHash ?? undefined
      }))
    };
  }

  /**
   * Crea una norma con su primera versión.
   *
   * `origin` distingue las normas fundacionales (anteriores a La Plaza, sin
   * votación) de las aprobadas en votación.
   */
  async createRule(params: {
    sectionId: string;
    reference: string;
    kind: RuleKind;
    position: number;
    body: string;
    bullets: string[];
    origin: VersionOrigin;
    proposalId?: string;
    /** Huella final de la votación, para ligar la versión a su origen. */
    proposalFinalHash?: string;
    changeNote?: string;
  }): Promise<{ rule: CodiceRule; version: CodiceVersion }> {
    const db = await DatabaseRepository.getInstance();
    const ruleId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const now = new Date();

    await db.exec('BEGIN TRANSACTION;');
    try {
      await db.run(
        `INSERT INTO codice_rules (id, sectionId, reference, kind, position, currentVersionId, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [ruleId, params.sectionId, params.reference, params.kind, params.position, versionId, now.toISOString()]
      );

      const bullets = params.bullets ?? [];
      const hash = computeVersionHash({
        ruleId,
        version: 1,
        body: params.body,
        bullets,
        origin: params.origin,
        proposalId: params.proposalId,
        proposalFinalHash: params.proposalFinalHash,
        createdAt: now,
        prevHash: GENESIS_HASH
      });

      await db.run(
        `INSERT INTO codice_versions
           (id, ruleId, version, body, bullets, proposalId, origin, changeNote, createdAt,
            prevHash, hash, proposalFinalHash)
         VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          versionId,
          ruleId,
          params.body,
          JSON.stringify(bullets),
          params.proposalId ?? null,
          params.origin,
          params.changeNote ?? null,
          now.toISOString(),
          GENESIS_HASH,
          hash,
          params.proposalFinalHash ?? null
        ]
      );

      await db.exec('COMMIT;');
    } catch (err) {
      await db.exec('ROLLBACK;');
      throw err;
    }

    const rule = await this.findRuleById(ruleId);
    const version = await this.findVersionById(versionId);
    return { rule: rule!, version: version! };
  }

  /**
   * Añade una versión nueva a una norma y la pone en vigor.
   *
   * La versión anterior no se toca: es lo que permite mostrar el histórico y
   * ver qué decía la norma antes de cada cambio.
   */
  async addVersion(params: {
    ruleId: string;
    body: string;
    bullets: string[];
    proposalId?: string;
    /** Huella final de la votación, para ligar la versión a su origen. */
    proposalFinalHash?: string;
    origin: VersionOrigin;
    changeNote?: string;
  }): Promise<CodiceVersion> {
    const db = await DatabaseRepository.getInstance();
    const versionId = crypto.randomUUID();
    const now = new Date();

    await db.exec('BEGIN TRANSACTION;');
    try {
      const last = await db.get<any>(
        'SELECT MAX(version) AS maxVersion FROM codice_versions WHERE ruleId = ?',
        [params.ruleId]
      );
      const nextVersion = (last?.maxVersion ?? 0) + 1;

      // Se encadena con la versión anterior de esta misma norma: alterar un
      // texto ya publicado rompe la cadena de versiones.
      const previous = await db.get<any>(
        'SELECT hash FROM codice_versions WHERE ruleId = ? ORDER BY version DESC LIMIT 1',
        [params.ruleId]
      );
      const prevHash = previous?.hash ?? GENESIS_HASH;

      const bullets = params.bullets ?? [];
      const hash = computeVersionHash({
        ruleId: params.ruleId,
        version: nextVersion,
        body: params.body,
        bullets,
        origin: params.origin,
        proposalId: params.proposalId,
        proposalFinalHash: params.proposalFinalHash,
        createdAt: now,
        prevHash
      });

      await db.run(
        `INSERT INTO codice_versions
           (id, ruleId, version, body, bullets, proposalId, origin, changeNote, createdAt,
            prevHash, hash, proposalFinalHash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          versionId,
          params.ruleId,
          nextVersion,
          params.body,
          JSON.stringify(bullets),
          params.proposalId ?? null,
          params.origin,
          params.changeNote ?? null,
          now.toISOString(),
          prevHash,
          hash,
          params.proposalFinalHash ?? null
        ]
      );

      await db.run('UPDATE codice_rules SET currentVersionId = ? WHERE id = ?', [
        versionId,
        params.ruleId
      ]);

      await db.exec('COMMIT;');
    } catch (err) {
      await db.exec('ROLLBACK;');
      throw err;
    }

    return (await this.findVersionById(versionId))!;
  }

  /** Deroga una norma. Su histórico se conserva íntegro. */
  async repealRule(ruleId: string, proposalId?: string): Promise<void> {
    const db = await DatabaseRepository.getInstance();
    await db.run(
      'UPDATE codice_rules SET repealedAt = ?, repealedByProposalId = ? WHERE id = ?',
      [new Date().toISOString(), proposalId ?? null, ruleId]
    );
  }

  /**
   * Recorre el histórico de una norma y comprueba que su cadena de versiones
   * encaja: nadie ha editado el texto de una ley por debajo.
   */
  async verifyRuleChain(
    ruleId: string
  ): Promise<{ ok: boolean; problem?: string; brokenAtVersion?: number; versionsChecked: number }> {
    const db = await DatabaseRepository.getInstance();
    const rows = await db.all<any[]>(
      'SELECT * FROM codice_versions WHERE ruleId = ? ORDER BY version ASC',
      [ruleId]
    );

    const versions = rows.map((row) => ({
      ruleId: row.ruleId,
      version: row.version,
      body: row.body,
      bullets: this.parseBullets(row.bullets),
      origin: row.origin,
      proposalId: row.proposalId ?? undefined,
      proposalFinalHash: row.proposalFinalHash ?? undefined,
      createdAt: row.createdAt,
      prevHash: row.prevHash ?? '',
      hash: row.hash ?? ''
    }));

    const result = verifyVersionChain(versions);
    return { ...result, versionsChecked: versions.length };
  }

  async listAllRuleIds(): Promise<string[]> {
    const db = await DatabaseRepository.getInstance();
    const rows = await db.all<any[]>('SELECT id FROM codice_rules');
    return rows.map((r) => r.id);
  }

  async findVersionById(id: string): Promise<CodiceVersion | undefined> {
    const db = await DatabaseRepository.getInstance();
    const row = await db.get<any>('SELECT * FROM codice_versions WHERE id = ?', [id]);
    return row ? this.mapVersion(row) : undefined;
  }

  /** La versión que aprobó una votación, si ya se aplicó. */
  async findVersionByProposalId(proposalId: string): Promise<CodiceVersion | undefined> {
    const db = await DatabaseRepository.getInstance();
    const row = await db.get<any>('SELECT * FROM codice_versions WHERE proposalId = ?', [proposalId]);
    return row ? this.mapVersion(row) : undefined;
  }

  /** Siguiente número libre dentro de una sección, por ejemplo '1.7'. */
  async nextReference(sectionNumber: number): Promise<string> {
    const db = await DatabaseRepository.getInstance();
    const rows = await db.all<any[]>(
      `SELECT r.reference FROM codice_rules r
         JOIN codice_sections s ON r.sectionId = s.id
        WHERE s.number = ?`,
      [sectionNumber]
    );

    let max = 0;
    for (const row of rows) {
      const parts = String(row.reference).split('.');
      const n = parseInt(parts[1] ?? '0', 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
    return `${sectionNumber}.${max + 1}`;
  }

  async countRules(): Promise<number> {
    const db = await DatabaseRepository.getInstance();
    const row = await db.get<any>('SELECT COUNT(*) AS count FROM codice_rules');
    return row?.count ?? 0;
  }

  // --------------------------------------------------------------------- Mapeo

  private mapSection = (row: any): CodiceSection => ({
    id: row.id,
    number: row.number,
    title: row.title,
    icon: row.icon ?? undefined,
    position: row.position ?? 0
  });

  private mapRule = (row: any): CodiceRule => ({
    id: row.id,
    sectionId: row.sectionId,
    reference: row.reference,
    kind: row.kind,
    position: row.position ?? 0,
    currentVersionId: row.currentVersionId ?? undefined,
    repealedAt: row.repealedAt ? new Date(row.repealedAt) : undefined,
    repealedByProposalId: row.repealedByProposalId ?? undefined,
    createdAt: new Date(row.createdAt)
  });

  private mapVersion = (row: any): CodiceVersion => ({
    id: row.id,
    ruleId: row.ruleId,
    version: row.version,
    body: row.body,
    bullets: this.parseBullets(row.bullets),
    proposalId: row.proposalId ?? undefined,
    origin: row.origin,
    changeNote: row.changeNote ?? undefined,
    createdAt: new Date(row.createdAt),
    prevHash: row.prevHash ?? undefined,
    hash: row.hash ?? undefined,
    proposalFinalHash: row.proposalFinalHash ?? undefined
  });

  private mapRuleWithCurrent = (row: any): RuleWithCurrent => ({
    ...this.mapRule(row),
    current: row.v_id
      ? {
          id: row.v_id,
          ruleId: row.id,
          version: row.v_version,
          body: row.v_body,
          bullets: this.parseBullets(row.v_bullets),
          proposalId: row.v_proposalId ?? undefined,
          origin: row.v_origin,
          changeNote: row.v_changeNote ?? undefined,
          createdAt: new Date(row.v_createdAt),
          prevHash: row.v_prevHash ?? undefined,
          hash: row.v_hash ?? undefined,
          proposalFinalHash: row.v_proposalFinalHash ?? undefined
        }
      : undefined,
    historyCount: Math.max(0, row.historyCount ?? 0)
  });

  private parseBullets(raw: any): string[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
