import crypto from 'crypto';
import { DatabaseRepository } from './DatabaseRepository';
import {
  computeHash,
  computeProposalContentHash,
  GENESIS_HASH,
  hashToken
} from '../utils/ledger';
import { ProposalTarget } from '../types/codice';
import {
  Proposal,
  ProposalComment,
  LedgerEntry,
  VoteChoice,
  CloseReason,
  LedgerKind,
  ProposalStatus
} from '../types/plaza';

/**
 * Acceso a datos de La Plaza.
 *
 * Regla que no se debe romper al tocar este fichero: plaza_ledger y
 * plaza_participation nunca se consultan juntas en una misma query. La
 * participación responde "¿ya votó esta persona?" y el registro responde "¿qué
 * se votó?"; cruzarlas revelaría el voto de cada cual, que es precisamente lo
 * que el diseño evita.
 */
export class PlazaRepository {
  // ---------------------------------------------------------------- Propuestas

  async createProposal(proposal: Proposal, target?: ProposalTarget): Promise<Proposal> {
    const db = await DatabaseRepository.getInstance();

    // La apertura es la primera entrada de la cadena y ancla TODO lo que se
    // somete a votación: el modo, la clase y el contenido (título, descripción
    // y texto propuesto). Editar cualquiera de esas cosas después de convocar
    // rompe la cadena desde el primer eslabón, así que el enunciado de una
    // propuesta es inmutable en cuanto se abre la votación.
    const contentHash = computeProposalContentHash({
      title: proposal.title,
      description: proposal.description,
      kind: proposal.kind,
      mode: proposal.mode,
      targetAction: target?.targetAction,
      targetRuleId: target?.targetRuleId,
      proposedBody: target?.proposedBody,
      proposedBullets: target?.proposedBullets,
      proposedSectionId: target?.proposedSectionId
    });

    const openingId = crypto.randomUUID();
    const opening = {
      id: openingId,
      proposalId: proposal.id,
      sequence: 1,
      kind: 'apertura' as LedgerKind,
      // El modo y la clase viajan en el campo choice de la apertura: es la
      // forma de meterlos en la huella sin añadir columnas que solo usaría
      // esta entrada.
      choice: `${proposal.kind}:${proposal.mode}` as any,
      contentHash,
      createdAt: proposal.createdAt,
      prevHash: GENESIS_HASH
    };
    const openingHash = computeHash(opening);

    await db.exec('BEGIN TRANSACTION;');
    try {
      await db.run(
        `INSERT INTO plaza_proposals
           (id, authorId, title, description, kind, mode, status, createdAt, deadlineAt, fastTrackBlocked,
            targetRuleId, targetAction, proposedBody, proposedBullets, proposedSectionId)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
        [
          proposal.id,
          proposal.authorId,
          proposal.title,
          proposal.description,
          proposal.kind,
          proposal.mode,
          proposal.status,
          proposal.createdAt.toISOString(),
          proposal.deadlineAt.toISOString(),
          target?.targetRuleId ?? null,
          target?.targetAction ?? null,
          target?.proposedBody ?? null,
          target?.proposedBullets ? JSON.stringify(target.proposedBullets) : null,
          target?.proposedSectionId ?? null
        ]
      );

      await db.run(
        `INSERT INTO plaza_ledger
           (id, proposalId, sequence, kind, choice, isRevote, contentHash, createdAt, prevHash, hash)
         VALUES (?, ?, 1, 'apertura', ?, 0, ?, ?, ?, ?)`,
        [
          openingId,
          proposal.id,
          opening.choice,
          contentHash,
          proposal.createdAt.toISOString(),
          GENESIS_HASH,
          openingHash
        ]
      );

      await db.exec('COMMIT;');
    } catch (err) {
      await db.exec('ROLLBACK;');
      throw err;
    }

    return proposal;
  }

  async findProposalById(id: string): Promise<Proposal | undefined> {
    const db = await DatabaseRepository.getInstance();
    const row = await db.get<any>('SELECT * FROM plaza_proposals WHERE id = ?', [id]);
    return row ? this.mapProposal(row) : undefined;
  }

  async listProposals(
    status?: string
  ): Promise<
    Array<
      Proposal & {
        authorUsername: string;
        commentCount: number;
        /** Qué hace con el Códice, para distinguirlo en el listado. */
        targetAction?: string;
        targetReference?: string;
      }
    >
  > {
    const db = await DatabaseRepository.getInstance();
    const rows = await db.all<any[]>(
      `SELECT p.*, u.username AS authorUsername,
              (SELECT COUNT(*) FROM plaza_comments c WHERE c.proposalId = p.id) AS commentCount,
              r.reference AS targetReference
       FROM plaza_proposals p
       JOIN users u ON p.authorId = u.id
       LEFT JOIN codice_rules r ON p.targetRuleId = r.id
       ${status ? 'WHERE p.status = ?' : ''}
       ORDER BY p.createdAt DESC`,
      status ? [status] : []
    );
    return rows.map((row) => ({
      ...this.mapProposal(row),
      authorUsername: row.authorUsername,
      commentCount: row.commentCount ?? 0,
      targetAction: row.targetAction ?? undefined,
      targetReference: row.targetReference ?? undefined
    }));
  }

  /** Propuestas abiertas cuyo plazo ordinario ya ha vencido. */
  async listExpiredOpenProposals(now: Date): Promise<Proposal[]> {
    const db = await DatabaseRepository.getInstance();
    const rows = await db.all<any[]>(
      `SELECT * FROM plaza_proposals WHERE status = 'abierta' AND deadlineAt <= ?`,
      [now.toISOString()]
    );
    return rows.map((row) => this.mapProposal(row));
  }

  async listOpenProposalIds(): Promise<string[]> {
    const db = await DatabaseRepository.getInstance();
    const rows = await db.all<any[]>(`SELECT id FROM plaza_proposals WHERE status = 'abierta'`);
    return rows.map((r) => r.id);
  }

  async listAllProposalIds(): Promise<string[]> {
    const db = await DatabaseRepository.getInstance();
    const rows = await db.all<any[]>('SELECT id FROM plaza_proposals');
    return rows.map((r) => r.id);
  }

  async markFastTrackBlocked(proposalId: string): Promise<void> {
    const db = await DatabaseRepository.getInstance();
    await db.run('UPDATE plaza_proposals SET fastTrackBlocked = 1 WHERE id = ?', [proposalId]);
  }

  // ------------------------------------------------------------------ Registro

  async getLedger(proposalId: string): Promise<LedgerEntry[]> {
    const db = await DatabaseRepository.getInstance();
    const rows = await db.all<any[]>(
      'SELECT * FROM plaza_ledger WHERE proposalId = ? ORDER BY sequence ASC',
      [proposalId]
    );
    return rows.map((row) => this.mapLedgerEntry(row));
  }

  async hasParticipated(proposalId: string, userId: string): Promise<boolean> {
    const db = await DatabaseRepository.getInstance();
    const row = await db.get<any>(
      'SELECT 1 FROM plaza_participation WHERE proposalId = ? AND userId = ?',
      [proposalId, userId]
    );
    return !!row;
  }

  /** ¿Tiene esta persona su voto anulado y pendiente de reemplazar? */
  async hasPendingRevote(proposalId: string, userId: string): Promise<boolean> {
    const db = await DatabaseRepository.getInstance();
    const row = await db.get<any>(
      'SELECT voteAnnulled FROM plaza_participation WHERE proposalId = ? AND userId = ?',
      [proposalId, userId]
    );
    return row?.voteAnnulled === 1;
  }

  /**
   * Rehabilita en el CENSO a quien presente su token de censo.
   *
   * Esta es la segunda mitad de la anulación, y va deliberadamente por separado:
   * solo toca plaza_participation, no sabe qué voto se destruyó en la urna, y
   * únicamente puede marcar la fila cuya huella coincide con el token. Por eso
   * un sello ajeno permite destruir un voto pero no apropiarse del turno.
   *
   * Devuelve false si el token no corresponde a ninguna participación.
   */
  async releaseCensoTurn(proposalId: string, censoToken: string): Promise<boolean> {
    const db = await DatabaseRepository.getInstance();
    const result = await db.run(
      `UPDATE plaza_participation
          SET voteAnnulled = 1
        WHERE proposalId = ? AND censoTokenHash = ?`,
      [proposalId, hashToken(censoToken)]
    );
    return (result.changes ?? 0) > 0;
  }

  /**
   * Registra un voto: añade la entrada a la cadena y deja constancia de la
   * participación, en una sola transacción.
   *
   * `isRevote` indica que sustituye a un voto anulado de la misma persona; en
   * ese caso la participación ya existe y no se vuelve a insertar.
   *
   * Devuelve el sello para mostrarlo en pantalla. No se envía por correo a
   * propósito: un sello guardado en una bandeja de entrada es una copia que la
   * persona no controla.
   */
  async recordVote(
    proposalId: string,
    userId: string,
    choice: VoteChoice,
    isRevote: boolean,
    tokens: { urnaHash: string; censoHash: string }
  ): Promise<{ entryId: string }> {
    const db = await DatabaseRepository.getInstance();

    await db.exec('BEGIN TRANSACTION;');
    try {
      const tail = await db.get<any>(
        'SELECT sequence, hash FROM plaza_ledger WHERE proposalId = ? ORDER BY sequence DESC LIMIT 1',
        [proposalId]
      );
      if (!tail) throw new Error(`La propuesta ${proposalId} no tiene entrada de apertura.`);

      const entryId = crypto.randomUUID();
      const createdAt = new Date();
      const draft = {
        id: entryId,
        proposalId,
        sequence: tail.sequence + 1,
        kind: 'voto' as LedgerKind,
        choice,
        isRevote,
        createdAt,
        prevHash: tail.hash
      };
      const hash = computeHash(draft);

      // Solo se guarda la huella del token de urna. El sello en claro nunca
      // llega al servidor: lo genera y lo guarda quien vota.
      await db.run(
        `INSERT INTO plaza_ledger
           (id, proposalId, sequence, kind, choice, isRevote, urnaTokenHash, createdAt, prevHash, hash)
         VALUES (?, ?, ?, 'voto', ?, ?, ?, ?, ?, ?)`,
        [
          entryId,
          proposalId,
          draft.sequence,
          choice,
          isRevote ? 1 : 0,
          tokens.urnaHash,
          createdAt.toISOString(),
          tail.hash,
          hash
        ]
      );

      if (isRevote) {
        // El voto vuelve a estar vigente y el sello es nuevo: se sustituye la
        // huella de censo y se limpia la marca de anulación.
        await db.run(
          `UPDATE plaza_participation
              SET censoTokenHash = ?, voteAnnulled = 0
            WHERE proposalId = ? AND userId = ?`,
          [tokens.censoHash, proposalId, userId]
        );
      } else {
        // La fecha de participación se guarda truncada al día. Con la hora
        // exacta, el orden de participación podría correlacionarse con el de
        // las entradas del registro y se rompería el secreto del voto.
        const day = new Date(createdAt);
        day.setUTCHours(0, 0, 0, 0);
        await db.run(
          `INSERT INTO plaza_participation (proposalId, userId, votedAt, censoTokenHash)
           VALUES (?, ?, ?, ?)`,
          [proposalId, userId, day.toISOString(), tokens.censoHash]
        );
      }

      await db.exec('COMMIT;');
      return { entryId };
    } catch (err) {
      await db.exec('ROLLBACK;');
      throw err;
    }
  }

  /**
   * Busca en la URNA el voto que corresponde a un token.
   *
   * Solo consulta plaza_ledger: no sabe ni puede saber de quién es el voto.
   */
  async findVoteByUrnaToken(
    proposalId: string,
    urnaToken: string
  ): Promise<{ entry: LedgerEntry; annulled: boolean } | undefined> {
    const db = await DatabaseRepository.getInstance();

    const row = await db.get<any>(
      'SELECT * FROM plaza_ledger WHERE proposalId = ? AND urnaTokenHash = ?',
      [proposalId, hashToken(urnaToken)]
    );
    if (!row) return undefined;

    const annulment = await db.get<any>(
      `SELECT 1 FROM plaza_ledger WHERE proposalId = ? AND kind = 'anulacion' AND refId = ?`,
      [proposalId, row.id]
    );

    return { entry: this.mapLedgerEntry(row), annulled: !!annulment };
  }

  /**
   * Añade una anulación a la cadena. El voto original no se borra.
   *
   * Solo toca la urna. Devolver el turno de voto es una operación distinta
   * (releaseCensoTurn) que se hace contra el censo y con otro token, para que el
   * servidor no pueda relacionar ambas.
   */
  async recordAnnulment(proposalId: string, voteEntryId: string): Promise<void> {
    const db = await DatabaseRepository.getInstance();

    await db.exec('BEGIN TRANSACTION;');
    try {
      const tail = await db.get<any>(
        'SELECT sequence, hash FROM plaza_ledger WHERE proposalId = ? ORDER BY sequence DESC LIMIT 1',
        [proposalId]
      );
      if (!tail) throw new Error(`La propuesta ${proposalId} no tiene entrada de apertura.`);

      const id = crypto.randomUUID();
      const createdAt = new Date();
      const draft = {
        id,
        proposalId,
        sequence: tail.sequence + 1,
        kind: 'anulacion' as LedgerKind,
        refId: voteEntryId,
        createdAt,
        prevHash: tail.hash
      };
      const hash = computeHash(draft);

      await db.run(
        `INSERT INTO plaza_ledger
           (id, proposalId, sequence, kind, refId, isRevote, createdAt, prevHash, hash)
         VALUES (?, ?, ?, 'anulacion', ?, 0, ?, ?, ?)`,
        [id, proposalId, draft.sequence, voteEntryId, createdAt.toISOString(), tail.hash, hash]
      );

      await db.exec('COMMIT;');
    } catch (err) {
      await db.exec('ROLLBACK;');
      throw err;
    }
  }

  /**
   * Cierra la votación: añade la entrada de cierre a la cadena y guarda su
   * huella como huella final. El motivo del cierre entra en la huella, para que
   * el archivo público refleje por qué se cerró cuando se cerró.
   */
  async closeProposal(
    proposalId: string,
    reason: CloseReason,
    approved: boolean
  ): Promise<string> {
    const db = await DatabaseRepository.getInstance();

    await db.exec('BEGIN TRANSACTION;');
    try {
      const tail = await db.get<any>(
        'SELECT sequence, hash FROM plaza_ledger WHERE proposalId = ? ORDER BY sequence DESC LIMIT 1',
        [proposalId]
      );
      if (!tail) throw new Error(`La propuesta ${proposalId} no tiene entrada de apertura.`);

      const id = crypto.randomUUID();
      const createdAt = new Date();
      const outcome: ProposalStatus = approved ? 'aprobada' : 'rechazada';
      const draft = {
        id,
        proposalId,
        sequence: tail.sequence + 1,
        kind: 'cierre' as LedgerKind,
        // El resultado viaja en el campo choice del cierre, igual que el modo
        // en la apertura: así entra en la huella. Sin esto, el estado de la
        // propuesta sería una columna suelta y bastaría un UPDATE para dar por
        // aprobada una votación rechazada.
        choice: outcome as any,
        closeReason: reason,
        createdAt,
        prevHash: tail.hash
      };
      const hash = computeHash(draft);

      await db.run(
        `INSERT INTO plaza_ledger
           (id, proposalId, sequence, kind, choice, closeReason, isRevote, createdAt, prevHash, hash)
         VALUES (?, ?, ?, 'cierre', ?, ?, 0, ?, ?, ?)`,
        [id, proposalId, draft.sequence, outcome, reason, createdAt.toISOString(), tail.hash, hash]
      );

      await db.run(
        `UPDATE plaza_proposals
            SET status = ?, closedAt = ?, closeReason = ?, finalHash = ?
          WHERE id = ?`,
        [outcome, createdAt.toISOString(), reason, hash, proposalId]
      );

      await db.exec('COMMIT;');
      return hash;
    } catch (err) {
      await db.exec('ROLLBACK;');
      throw err;
    }
  }

  // -------------------------------------------------------------- Participación

  async countParticipants(proposalId: string): Promise<number> {
    const db = await DatabaseRepository.getInstance();
    const row = await db.get<any>(
      'SELECT COUNT(*) AS count FROM plaza_participation WHERE proposalId = ?',
      [proposalId]
    );
    return row?.count ?? 0;
  }

  /**
   * Lista de votantes para publicar al cerrar.
   *
   * Se ordena por nombre y NO se devuelve la fecha: ordenar por fecha daría un
   * orden de participación correlacionable con el de las entradas del registro.
   */
  async listVoters(proposalId: string): Promise<string[]> {
    const db = await DatabaseRepository.getInstance();
    const rows = await db.all<any[]>(
      `SELECT u.username
         FROM plaza_participation p
         JOIN users u ON p.userId = u.id
        WHERE p.proposalId = ?
        ORDER BY u.username COLLATE NOCASE ASC`,
      [proposalId]
    );
    return rows.map((r) => r.username);
  }

  // ------------------------------------------------------- Vínculo con el Códice

  /** Qué pretende cambiar esta propuesta en el Códice, si es que cambia algo. */
  async getProposalTarget(proposalId: string): Promise<ProposalTarget> {
    const db = await DatabaseRepository.getInstance();
    const row = await db.get<any>(
      `SELECT targetRuleId, targetAction, proposedBody, proposedBullets, proposedSectionId, appliedAt
         FROM plaza_proposals WHERE id = ?`,
      [proposalId]
    );
    if (!row) return {};

    let bullets: string[] | undefined;
    if (row.proposedBullets) {
      try {
        const parsed = JSON.parse(row.proposedBullets);
        bullets = Array.isArray(parsed) ? parsed : undefined;
      } catch {
        bullets = undefined;
      }
    }

    return {
      targetRuleId: row.targetRuleId ?? undefined,
      targetAction: row.targetAction ?? undefined,
      proposedBody: row.proposedBody ?? undefined,
      proposedBullets: bullets,
      proposedSectionId: row.proposedSectionId ?? undefined,
      appliedAt: row.appliedAt ? new Date(row.appliedAt) : undefined
    };
  }

  async markProposalApplied(proposalId: string): Promise<void> {
    const db = await DatabaseRepository.getInstance();
    await db.run('UPDATE plaza_proposals SET appliedAt = ? WHERE id = ?', [
      new Date().toISOString(),
      proposalId
    ]);
  }

  /**
   * Votaciones aprobadas que cambian el Códice y todavía no se han aplicado.
   * El vigilante las procesa, para que ningún cierre quede sin efecto.
   */
  async listApprovedUnappliedProposals(): Promise<string[]> {
    const db = await DatabaseRepository.getInstance();
    const rows = await db.all<any[]>(
      `SELECT id FROM plaza_proposals
        WHERE status = 'aprobada' AND targetAction IS NOT NULL AND appliedAt IS NULL
        ORDER BY closedAt ASC`
    );
    return rows.map((r) => r.id);
  }

  /**
   * Votaciones aprobadas que ya se aplicaron al Códice. La verificación del
   * Códice comprueba que cada una dejó su rastro: si alguien borrara la versión
   * que aprobó una votación, la norma volvería al texto anterior sin romper su
   * cadena, y solo este cruce lo delata.
   */
  async listAppliedProposalIds(): Promise<string[]> {
    const db = await DatabaseRepository.getInstance();
    const rows = await db.all<any[]>(
      `SELECT id FROM plaza_proposals
        WHERE targetAction IS NOT NULL AND appliedAt IS NOT NULL
        ORDER BY closedAt ASC`
    );
    return rows.map((r) => r.id);
  }

  // ----------------------------------------------------------------- Anuncios

  /**
   * Reserva el anuncio del resultado de una votación cerrada. Devuelve false si
   * ya estaba anunciada o reservada, para que el correo no salga dos veces
   * aunque el cierre y el vigilante coincidan.
   */
  async claimAnnouncement(proposalId: string): Promise<boolean> {
    const db = await DatabaseRepository.getInstance();
    const result = await db.run(
      `UPDATE plaza_proposals SET announcedAt = ?
        WHERE id = ? AND announcedAt IS NULL AND status != 'abierta'`,
      [new Date().toISOString(), proposalId]
    );
    return (result.changes ?? 0) > 0;
  }

  /** Deshace la reserva si el envío falló, para que se reintente. */
  async releaseAnnouncement(proposalId: string): Promise<void> {
    const db = await DatabaseRepository.getInstance();
    await db.run('UPDATE plaza_proposals SET announcedAt = NULL WHERE id = ?', [proposalId]);
  }

  async listUnannouncedClosedProposalIds(): Promise<string[]> {
    const db = await DatabaseRepository.getInstance();
    const rows = await db.all<any[]>(
      `SELECT id FROM plaza_proposals
        WHERE status != 'abierta' AND announcedAt IS NULL
        ORDER BY closedAt ASC`
    );
    return rows.map((r) => r.id);
  }

  // ---------------------------------------------------------------- Comentarios

  async addComment(comment: ProposalComment): Promise<ProposalComment> {
    const db = await DatabaseRepository.getInstance();
    await db.run(
      'INSERT INTO plaza_comments (id, proposalId, userId, body, createdAt) VALUES (?, ?, ?, ?, ?)',
      [
        comment.id,
        comment.proposalId,
        comment.userId,
        comment.body,
        comment.createdAt.toISOString()
      ]
    );
    return comment;
  }

  async listComments(proposalId: string): Promise<ProposalComment[]> {
    const db = await DatabaseRepository.getInstance();
    const rows = await db.all<any[]>(
      `SELECT c.*, u.username
         FROM plaza_comments c
         JOIN users u ON c.userId = u.id
        WHERE c.proposalId = ?
        ORDER BY c.createdAt ASC`,
      [proposalId]
    );
    return rows.map((row) => ({
      id: row.id,
      proposalId: row.proposalId,
      userId: row.userId,
      username: row.username,
      body: row.body,
      createdAt: new Date(row.createdAt)
    }));
  }

  // -------------------------------------------------------------------- Mapeo

  private mapProposal(row: any): Proposal {
    return {
      id: row.id,
      authorId: row.authorId,
      title: row.title,
      description: row.description,
      kind: row.kind,
      mode: row.mode,
      status: row.status,
      createdAt: new Date(row.createdAt),
      deadlineAt: new Date(row.deadlineAt),
      closedAt: row.closedAt ? new Date(row.closedAt) : undefined,
      closeReason: row.closeReason ?? undefined,
      finalHash: row.finalHash ?? undefined,
      fastTrackBlocked: !!row.fastTrackBlocked
    };
  }

  private mapLedgerEntry(row: any): LedgerEntry {
    return {
      id: row.id,
      proposalId: row.proposalId,
      sequence: row.sequence,
      kind: row.kind,
      choice: row.choice ?? undefined,
      refId: row.refId ?? undefined,
      closeReason: row.closeReason ?? undefined,
      isRevote: !!row.isRevote,
      urnaTokenHash: row.urnaTokenHash ?? undefined,
      contentHash: row.contentHash ?? undefined,
      createdAt: new Date(row.createdAt),
      prevHash: row.prevHash,
      hash: row.hash
    };
  }
}
