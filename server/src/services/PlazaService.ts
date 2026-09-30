import crypto from 'crypto';
import { PlazaRepository } from '../repositories/PlazaRepository';
import {
  computeTally,
  verifyChain,
  deriveTokens,
  hashToken,
  computeProposalContentHash
} from '../utils/ledger';
import { ProposalTarget } from '../types/codice';
import type { PlazaResultAnnouncement } from '../utils/mailer';
import {
  Proposal,
  ProposalKind,
  ProposalMode,
  VoteChoice,
  Tally,
  ReceiptLookup,
  VerificationResult,
  ProposalComment,
  LedgerEntry
} from '../types/plaza';

/**
 * Reglas de aprobación acordadas por la comunidad.
 *
 * Plazo ordinario (14 días): más votos positivos que negativos.
 * Vía rápida (antes de 14 días): al menos 15 positivos, como máximo 1 negativo,
 * y al menos 3 días desde la propuesta. Las tres condiciones a la vez.
 */
export const PLAZO_DIAS = 14;
export const VIA_RAPIDA_MIN_POSITIVOS = 15;
export const VIA_RAPIDA_MAX_NEGATIVOS = 1;
export const VIA_RAPIDA_MIN_DIAS = 3;

const DIA_MS = 24 * 60 * 60 * 1000;

export class PlazaService {
  /**
   * El servicio del Códice se inyecta después de construir ambos, porque cada
   * uno necesita al otro: La Plaza aplica los cambios al aprobarse una
   * votación, y el Códice consulta las propuestas para mostrar su histórico.
   */
  private codiceService?: { applyApprovedProposal(id: string): Promise<{ applied: boolean }> };

  /**
   * Lectura del Códice, para poder mostrar junto a una propuesta el texto que
   * la norma tiene ahora mismo y compararlo con el que se propone.
   */
  private codiceReader?: {
    getRuleWithCurrent(ruleId: string): Promise<
      | {
          reference: string;
          current?: { body: string; bullets: string[]; version: number };
        }
      | undefined
    >;
    getSectionById(sectionId: string): Promise<{ number: number; title: string } | undefined>;
  };

  constructor(private plazaRepository: PlazaRepository) {}

  setCodiceService(
    service: {
      applyApprovedProposal(id: string): Promise<{ applied: boolean }>;
    } & NonNullable<PlazaService['codiceReader']>
  ): void {
    this.codiceService = service;
    this.codiceReader = service;
  }

  /**
   * Envío del resultado a la comunidad. Se inyecta en el arranque para no
   * acoplar La Plaza al correo ni a la lista de usuarios.
   */
  private resultNotifier?: (result: PlazaResultAnnouncement) => Promise<void>;

  setResultNotifier(notifier: (result: PlazaResultAnnouncement) => Promise<void>): void {
    this.resultNotifier = notifier;
  }

  // ---------------------------------------------------------------- Propuestas

  /**
   * Crea una propuesta. Cualquier persona registrada puede convocar: La Plaza
   * es horizontal y no hay ningún rol con permiso especial para proponer.
   */
  async createProposal(params: {
    authorId: string;
    title: string;
    description: string;
    kind: ProposalKind;
    mode: ProposalMode;
    /** Qué cambia en el Códice, si cambia algo. */
    target?: ProposalTarget;
  }): Promise<Proposal> {
    const title = params.title?.trim();
    if (!title) throw new Error('La propuesta necesita un título.');
    if (params.kind !== 'edicto' && params.kind !== 'acuerdo') {
      throw new Error('La clase de propuesta debe ser edicto o acuerdo.');
    }
    if (params.mode !== 'normal' && params.mode !== 'secreto') {
      throw new Error('El modo debe ser normal o secreto.');
    }

    const createdAt = new Date();
    const proposal: Proposal = {
      id: crypto.randomUUID(),
      authorId: params.authorId,
      title,
      description: params.description?.trim() ?? '',
      kind: params.kind,
      mode: params.mode,
      status: 'abierta',
      createdAt,
      deadlineAt: new Date(createdAt.getTime() + PLAZO_DIAS * DIA_MS),
      fastTrackBlocked: false
    };

    // La clase y el efecto sobre el Códice no son independientes: un acuerdo es
    // una decisión puntual que no toca las normas, y un edicto existe
    // precisamente para cambiarlas. Cualquier otra combinación es incoherente y
    // se rechaza aquí, no solo en la interfaz.
    const target = params.target;

    if (params.kind === 'acuerdo' && target?.targetAction) {
      throw new Error(
        'Un acuerdo puntual no modifica el Códice. Si quieres cambiar una norma, propón un edicto.'
      );
    }

    if (params.kind === 'edicto' && !target?.targetAction) {
      throw new Error(
        'Un edicto tiene que crear, modificar o derogar una norma del Códice. Si tu propuesta no cambia ninguna norma, es un acuerdo puntual.'
      );
    }

    // Una propuesta que modifica o deroga necesita saber sobre qué norma actúa;
    // una que crea, en qué sección va y con qué texto.
    if (target?.targetAction) {
      const needsRule = target.targetAction === 'modificar' || target.targetAction === 'derogar';
      if (needsRule && !target.targetRuleId) {
        throw new Error('Indica qué norma del Códice quieres cambiar.');
      }
      if (target.targetAction !== 'derogar' && !target.proposedBody?.trim()) {
        throw new Error('Escribe el texto que propones para la norma.');
      }
      if (target.targetAction === 'crear' && !target.proposedSectionId) {
        throw new Error('Indica en qué sección del Códice debe ir la norma nueva.');
      }
    }

    return this.plazaRepository.createProposal(proposal, target);
  }

  async listProposals(status?: string) {
    return this.plazaRepository.listProposals(status);
  }

  /**
   * Detalle de una propuesta. La lista de votantes solo se incluye si está
   * cerrada: verla en vivo invitaría a presionar a quien no ha votado, y no
   * aporta nada a la comprobación.
   */
  async getProposalDetail(proposalId: string, viewerId?: string) {
    const proposal = await this.plazaRepository.findProposalById(proposalId);
    if (!proposal) return undefined;

    const tally = await this.getTally(proposalId);
    const comments = await this.plazaRepository.listComments(proposalId);
    const closed = proposal.status !== 'abierta';

    return {
      proposal,
      tally,
      comments,
      // Qué cambia exactamente en el Códice. Sin esto la gente votaría a ciegas:
      // el título y la explicación dicen qué se pretende, pero no el texto que
      // quedará escrito si se aprueba.
      change: await this.getProposedChange(proposalId),
      voters: closed ? await this.plazaRepository.listVoters(proposalId) : undefined,
      // Cada persona ve su propio estado de participación. Es un dato que solo
      // ve ella, y le permite detectar que consta como votante sin haberlo sido.
      hasVoted: viewerId ? await this.plazaRepository.hasParticipated(proposalId, viewerId) : undefined,
      // Tras anular un voto en modo secreto la persona sigue constando como
      // participante, pero puede —y debe poder— votar de nuevo. Sin este dato
      // la interfaz le ocultaría los botones y se quedaría fuera de la votación.
      canVote: viewerId ? await this.canUserVote(proposalId, viewerId) : undefined
    };
  }

  /**
   * ¿Puede esta persona emitir un voto ahora mismo?
   *
   * Es cierto si nunca ha votado, o si votó y anuló su voto al comprobarlo y la
   * votación sigue abierta. Aplica exactamente el mismo criterio que castVote,
   * para que la interfaz no ofrezca algo que el servidor vaya a rechazar.
   */
  private async canUserVote(proposalId: string, userId: string): Promise<boolean> {
    const proposal = await this.plazaRepository.findProposalById(proposalId);
    if (!proposal || proposal.status !== 'abierta') return false;

    const participated = await this.plazaRepository.hasParticipated(proposalId, userId);
    if (!participated) return true;

    return this.plazaRepository.hasPendingRevote(proposalId, userId);
  }

  /**
   * El cambio que propone una votación, con el texto vigente al lado para poder
   * compararlos.
   *
   * Devuelve undefined si la propuesta no toca el Códice (un acuerdo puntual).
   *
   * El texto vigente se lee en el momento de consultar, no se congela: si la
   * norma cambiara mientras la votación está abierta, la comparación seguiría
   * siendo con lo que dice el Códice de verdad.
   */
  private async getProposedChange(proposalId: string) {
    const target = await this.plazaRepository.getProposalTarget(proposalId);
    if (!target.targetAction) return undefined;

    const base = {
      action: target.targetAction,
      proposedBody: target.proposedBody,
      proposedBullets: target.proposedBullets ?? [],
      appliedAt: target.appliedAt
    };

    if (!this.codiceReader) return base;

    // Norma afectada: la que se modifica o deroga.
    if (target.targetRuleId) {
      const rule = await this.codiceReader.getRuleWithCurrent(target.targetRuleId);
      return {
        ...base,
        reference: rule?.reference,
        currentBody: rule?.current?.body,
        currentBullets: rule?.current?.bullets ?? [],
        currentVersion: rule?.current?.version
      };
    }

    // Norma nueva: en qué sección iría.
    if (target.proposedSectionId) {
      const section = await this.codiceReader.getSectionById(target.proposedSectionId);
      return {
        ...base,
        sectionNumber: section?.number,
        sectionTitle: section?.title
      };
    }

    return base;
  }

  // --------------------------------------------------------------------- Voto

  /**
   * Emite un voto. Si la persona ya participó y su voto sigue vigente, se
   * rechaza; si lo anuló al comprobarlo (modo secreto), el nuevo voto se marca
   * como revoto para que las cuentas sigan cuadrando.
   */
  async castVote(
    proposalId: string,
    userId: string,
    choice: VoteChoice,
    /**
     * Sello generado por el navegador de quien vota. Es obligatorio: el
     * servidor no puede generarlo en su lugar, porque entonces conocería la
     * credencial que permite localizar y anular ese voto.
     */
    seal: string
  ): Promise<{ closed: boolean }> {
    if (choice !== 'si' && choice !== 'no') {
      throw new Error('El voto debe ser sí o no.');
    }
    if (!seal?.trim()) {
      throw new Error('Falta el sello del voto. Prueba a recargar la página.');
    }

    const proposal = await this.plazaRepository.findProposalById(proposalId);
    if (!proposal) throw new Error('La propuesta no existe.');
    if (proposal.status !== 'abierta') throw new Error('Esta votación ya está cerrada.');

    const alreadyParticipated = await this.plazaRepository.hasParticipated(proposalId, userId);

    let isRevote = false;
    if (alreadyParticipated) {
      // Consta como participante: solo puede volver a votar si fue su propio
      // voto el que se anuló. El turno se anota en su participación, no en el
      // registro, porque el registro no tiene identidades y comparar totales
      // permitiría que una persona gastase el turno de otra.
      if (!(await this.plazaRepository.hasPendingRevote(proposalId, userId))) {
        throw new Error('Ya has votado en esta propuesta.');
      }
      isRevote = true;
    }

    const tokens = deriveTokens(seal);

    await this.plazaRepository.recordVote(proposalId, userId, choice, isRevote, {
      urnaHash: hashToken(tokens.urna),
      censoHash: hashToken(tokens.censo)
    });

    // Los umbrales se evalúan en cada voto, no en una pasada diaria: en cuanto
    // se cumplen las condiciones de la vía rápida, la votación se cierra.
    const closed = await this.evaluateThresholds(proposalId);

    return { closed };
  }

  /**
   * PRIMERA FASE: consulta la urna y, en modo secreto, destruye el voto.
   *
   * Recibe únicamente el token de urna derivado del sello, nunca el sello
   * entero. Esta operación no toca el censo y no sabe de quién es el voto: por
   * eso quien presente un sello ajeno puede destruir ese voto, pero no obtiene
   * nada a cambio.
   *
   * Devolver el turno de voto es la segunda fase (releaseTurn), que el cliente
   * hace por separado con el otro token.
   */
  async checkReceipt(proposalId: string, urnaToken: string): Promise<ReceiptLookup> {
    const proposal = await this.plazaRepository.findProposalById(proposalId);
    if (!proposal) throw new Error('La propuesta no existe.');

    const found = await this.plazaRepository.findVoteByUrnaToken(proposalId, urnaToken);
    if (!found || found.entry.kind !== 'voto') {
      return { found: false, annulled: false, canRevote: false };
    }

    const isOpen = proposal.status === 'abierta';

    // Un voto ya anulado no se vuelve a anular: se informa de su estado.
    if (found.annulled) {
      return {
        found: true,
        choice: found.entry.choice,
        sealedAt: found.entry.createdAt,
        annulled: true,
        canRevote: isOpen
      };
    }

    // La anulación solo tiene sentido mientras se pueda volver a votar. Si la
    // votación ya está cerrada, comprobar no destruye nada: el resultado es
    // definitivo y anular solo restaría un voto ya contado.
    const shouldAnnul = proposal.mode === 'secreto' && isOpen;

    if (shouldAnnul) {
      await this.plazaRepository.recordAnnulment(proposalId, found.entry.id);
    }

    return {
      found: true,
      choice: found.entry.choice,
      sealedAt: found.entry.createdAt,
      annulled: shouldAnnul,
      canRevote: shouldAnnul
    };
  }

  /**
   * SEGUNDA FASE: devuelve el turno de voto a quien presente su token de censo.
   *
   * Va contra el censo y solo puede marcar la fila cuya huella coincide con el
   * token, así que únicamente rehabilita a su propietario. No recibe ni consulta
   * nada de la urna: el servidor no puede relacionar esta llamada con el voto
   * que se destruyó en la primera fase.
   *
   * El cliente la invoca tras anular, separada en el tiempo de la primera.
   */
  async releaseTurn(proposalId: string, censoToken: string): Promise<boolean> {
    const proposal = await this.plazaRepository.findProposalById(proposalId);
    if (!proposal) throw new Error('La propuesta no existe.');
    // Con la votación cerrada no hay turno que devolver.
    if (proposal.status !== 'abierta') return false;

    return this.plazaRepository.releaseCensoTurn(proposalId, censoToken);
  }

  // ---------------------------------------------------------------- Recuento

  async getTally(proposalId: string): Promise<Tally> {
    const entries = await this.plazaRepository.getLedger(proposalId);
    const counts = computeTally(entries);
    const participantes = await this.plazaRepository.countParticipants(proposalId);
    return { ...counts, participantes };
  }

  /**
   * Comprueba si la propuesta debe cerrarse y la cierra si procede.
   *
   * Devuelve true si la votación ha quedado cerrada en esta llamada.
   */
  async evaluateThresholds(proposalId: string, now = new Date()): Promise<boolean> {
    const proposal = await this.plazaRepository.findProposalById(proposalId);
    if (!proposal || proposal.status !== 'abierta') return false;

    const tally = await this.getTally(proposalId);

    // Un segundo voto negativo desactiva la vía rápida de forma permanente:
    // la propuesta ha demostrado que hay discusión y espera el plazo completo.
    // Se marca aunque después se anule, para que no se pueda jugar con los
    // tiempos anulando y revotando.
    if (!proposal.fastTrackBlocked && tally.no > VIA_RAPIDA_MAX_NEGATIVOS) {
      await this.plazaRepository.markFastTrackBlocked(proposalId);
      proposal.fastTrackBlocked = true;
    }

    const diasTranscurridos = (now.getTime() - proposal.createdAt.getTime()) / DIA_MS;

    // Vía rápida: las tres condiciones a la vez.
    if (
      !proposal.fastTrackBlocked &&
      tally.si >= VIA_RAPIDA_MIN_POSITIVOS &&
      tally.no <= VIA_RAPIDA_MAX_NEGATIVOS &&
      diasTranscurridos >= VIA_RAPIDA_MIN_DIAS
    ) {
      await this.plazaRepository.closeProposal(proposalId, 'via_rapida', true);
      await this.applyToCodice(proposalId);
      this.announceInBackground(proposalId);
      return true;
    }

    // Plazo ordinario: al vencer, se aprueba si hay más positivos que negativos.
    if (now >= proposal.deadlineAt) {
      const approved = tally.si > tally.no;
      await this.plazaRepository.closeProposal(proposalId, 'plazo', approved);
      if (approved) await this.applyToCodice(proposalId);
      this.announceInBackground(proposalId);
      return true;
    }

    return false;
  }

  /**
   * Traslada al Códice el resultado de una votación aprobada.
   *
   * Si falla, se registra y no se interrumpe el cierre: la votación ya está
   * decidida y el vigilante reintentará aplicar el cambio en su próximo ciclo.
   */
  private async applyToCodice(proposalId: string): Promise<void> {
    if (!this.codiceService) return;
    try {
      await this.codiceService.applyApprovedProposal(proposalId);
    } catch (error) {
      console.error(
        `[PlazaService] No se pudo aplicar la votación ${proposalId} al Códice:`,
        error
      );
    }
  }

  /**
   * El cierre puede ocurrir al emitir un voto: el correo sale sin hacer esperar
   * a quien vota. Si falla, el vigilante lo reintenta.
   */
  private announceInBackground(proposalId: string): void {
    this.announceResult(proposalId).catch((error) =>
      console.error(`[PlazaService] No se pudo anunciar la votación ${proposalId}:`, error)
    );
  }

  /**
   * Anuncia a toda la comunidad el resultado de una votación cerrada, con su
   * huella final y, en los edictos aprobados, el texto que entra en vigor.
   *
   * Cada correo es una copia del resultado fuera del servidor: si alguien
   * alterase o borrase la votación más tarde, los buzones de la comunidad
   * conservarían lo que se decidió.
   *
   * Devuelve true si el correo ha salido en esta llamada.
   */
  async announceResult(proposalId: string): Promise<boolean> {
    if (!this.resultNotifier) return false;
    if (!(await this.plazaRepository.claimAnnouncement(proposalId))) return false;

    try {
      const proposal = await this.plazaRepository.findProposalById(proposalId);
      if (!proposal || proposal.status === 'abierta' || !proposal.finalHash) {
        throw new Error('La votación no está cerrada.');
      }

      const tally = await this.getTally(proposalId);
      // Se anuncia aunque no verifique, pero avisándolo: callarlo sería peor.
      const verification = await this.verifyProposal(proposalId);
      const target = await this.plazaRepository.getProposalTarget(proposalId);

      let change: PlazaResultAnnouncement['change'];
      if (target.targetAction) {
        let where = 'norma';
        if (target.targetRuleId) {
          const rule = await this.codiceReader?.getRuleWithCurrent(target.targetRuleId);
          where = `norma ${rule?.reference ?? target.targetRuleId}`;
        } else if (target.proposedSectionId) {
          const section = await this.codiceReader?.getSectionById(target.proposedSectionId);
          where = section ? `sección ${section.number} · ${section.title}` : 'sección indicada';
        }
        change = {
          action: target.targetAction,
          where,
          body: target.proposedBody,
          bullets: target.proposedBullets
        };
      }

      await this.resultNotifier({
        proposalId,
        title: proposal.title,
        outcome: proposal.status,
        closeReason: proposal.closeReason,
        closedAt: proposal.closedAt ?? new Date(),
        si: tally.si,
        no: tally.no,
        participantes: tally.participantes,
        finalHash: proposal.finalHash,
        verified: verification.ok,
        verificationProblem: verification.problem,
        change
      });
      return true;
    } catch (error) {
      await this.plazaRepository.releaseAnnouncement(proposalId);
      throw error;
    }
  }

  /** Reintenta los anuncios que no llegaron a salir. Lo llama el vigilante. */
  async announcePendingResults(): Promise<string[]> {
    const announced: string[] = [];
    for (const id of await this.plazaRepository.listUnannouncedClosedProposalIds()) {
      try {
        if (await this.announceResult(id)) announced.push(id);
      } catch (error) {
        console.error(`[PlazaService] No se pudo anunciar la votación ${id}:`, error);
      }
    }
    return announced;
  }

  /** Cierra las propuestas cuyo plazo ha vencido. Lo llama el vigilante. */
  async closeExpiredProposals(now = new Date()): Promise<string[]> {
    const expired = await this.plazaRepository.listExpiredOpenProposals(now);
    const closed: string[] = [];
    for (const proposal of expired) {
      const didClose = await this.evaluateThresholds(proposal.id, now);
      if (didClose) closed.push(proposal.id);
    }
    return closed;
  }

  // ------------------------------------------------------------ Verificación

  /**
   * Verifica la integridad de una votación: recorre la cadena y cuadra el
   * número de votos con el de participantes.
   *
   * Es la misma comprobación que puede hacer cualquiera con el archivo público
   * descargado y el script de verificación.
   */
  async verifyProposal(proposalId: string): Promise<VerificationResult> {
    const entries = await this.plazaRepository.getLedger(proposalId);
    const chain = verifyChain(entries);

    const result: VerificationResult = {
      ok: chain.ok,
      proposalId,
      entriesChecked: entries.length,
      problem: chain.problem,
      brokenAtSequence: chain.brokenAtSequence
    };
    if (!chain.ok) return result;

    // El enunciado no se puede haber editado después de convocar: se recalcula
    // la huella del contenido actual y se compara con la sellada en la apertura.
    const contentProblem = await this.verifyProposalContent(proposalId, entries);
    if (contentProblem) {
      return { ...result, ok: false, contentTampered: true, problem: contentProblem };
    }

    const counts = computeTally(entries);

    // El estado de la propuesta (abierta, aprobada, rechazada) tiene que ser el
    // que dicta la cadena, y el resultado sellado el que dan los votos.
    const outcomeProblem = await this.verifyProposalOutcome(proposalId, entries, counts);
    if (outcomeProblem) {
      return { ...result, ok: false, outcomeTampered: true, problem: outcomeProblem };
    }

    // Cuadre: votos vigentes = participantes - anulaciones sin revoto.
    const participantes = await this.plazaRepository.countParticipants(proposalId);
    const esperados = participantes - counts.anulacionesSinRevoto;

    if (counts.total !== esperados) {
      return {
        ...result,
        ok: false,
        countMismatch: true,
        problem:
          `El número de votos no cuadra con el de participantes: ` +
          `${counts.total} votos vigentes frente a ${esperados} esperados ` +
          `(${participantes} participantes menos ${counts.anulacionesSinRevoto} anulaciones sin revoto).`
      };
    }

    return result;
  }

  /**
   * Comprueba que el contenido de la propuesta sigue siendo el que se selló al
   * convocarla.
   *
   * Devuelve el problema si algo no cuadra, o undefined si todo está en orden.
   */
  private async verifyProposalContent(
    proposalId: string,
    entries: LedgerEntry[]
  ): Promise<string | undefined> {
    const opening = entries.find((e) => e.kind === 'apertura');
    if (!opening?.contentHash) {
      return 'La votación no tiene sellado su enunciado.';
    }

    const proposal = await this.plazaRepository.findProposalById(proposalId);
    if (!proposal) return 'La propuesta no existe.';

    const target = await this.plazaRepository.getProposalTarget(proposalId);
    const recomputed = computeProposalContentHash({
      title: proposal.title,
      description: proposal.description,
      kind: proposal.kind,
      mode: proposal.mode,
      targetAction: target.targetAction,
      targetRuleId: target.targetRuleId,
      proposedBody: target.proposedBody,
      proposedBullets: target.proposedBullets,
      proposedSectionId: target.proposedSectionId
    });

    if (recomputed !== opening.contentHash) {
      return 'El enunciado de la votación ha cambiado desde que se convocó: el texto que se está votando no es el que se sometió a votación.';
    }

    return undefined;
  }

  /**
   * Comprueba que el resultado de la votación es el que se selló al cerrarla y
   * que ese resultado se sigue de los votos del registro.
   *
   * Sin esto, el estado sería una columna suelta: bastaría un UPDATE para dar
   * por aprobada una votación rechazada, y el Códice la aplicaría.
   */
  private async verifyProposalOutcome(
    proposalId: string,
    entries: LedgerEntry[],
    counts: { si: number; no: number }
  ): Promise<string | undefined> {
    const proposal = await this.plazaRepository.findProposalById(proposalId);
    if (!proposal) return 'La propuesta no existe.';

    const opening = entries[0];
    const closings = entries.filter((e) => e.kind === 'cierre');
    const closing = closings[0];

    // El plazo se deriva de la apertura, que está sellada: no se puede acortar
    // para cerrar antes de tiempo.
    const expectedDeadline = new Date(opening.createdAt).getTime() + PLAZO_DIAS * DIA_MS;
    if (proposal.deadlineAt.getTime() !== expectedDeadline) {
      return 'El plazo de la votación no es el que corresponde a su fecha de convocatoria.';
    }

    if (closings.length > 1) {
      return 'La votación tiene más de una entrada de cierre.';
    }

    if (proposal.status === 'abierta') {
      if (closing) return 'La votación figura como abierta, pero el registro dice que se cerró.';
      return undefined;
    }

    if (!closing) {
      return `La votación figura como ${proposal.status}, pero el registro no tiene entrada de cierre.`;
    }
    if (closing !== entries[entries.length - 1]) {
      return 'Hay entradas en el registro posteriores al cierre de la votación.';
    }
    if (proposal.finalHash !== closing.hash) {
      return 'La huella final publicada no es la de la entrada de cierre.';
    }
    if (proposal.closeReason !== closing.closeReason) {
      return 'El motivo de cierre publicado no es el que se selló en el registro.';
    }

    const sealedOutcome = closing.choice as unknown as string;
    if (sealedOutcome !== proposal.status) {
      return `La votación figura como ${proposal.status}, pero el resultado sellado al cerrarla es "${sealedOutcome ?? 'ninguno'}".`;
    }

    // El resultado sellado debe seguirse de los votos y de las reglas de cierre.
    const approved = sealedOutcome === 'aprobada';
    const elapsedMs =
      new Date(closing.createdAt).getTime() - new Date(opening.createdAt).getTime();

    if (closing.closeReason === 'via_rapida') {
      const fulfils =
        counts.si >= VIA_RAPIDA_MIN_POSITIVOS &&
        counts.no <= VIA_RAPIDA_MAX_NEGATIVOS &&
        elapsedMs >= VIA_RAPIDA_MIN_DIAS * DIA_MS;
      if (!approved || !fulfils) {
        return `El cierre por vía rápida no se sostiene con los votos del registro (${counts.si} a favor, ${counts.no} en contra).`;
      }
    } else if (closing.closeReason === 'plazo') {
      if (elapsedMs < PLAZO_DIAS * DIA_MS) {
        return 'La votación se cerró por plazo antes de que venciera.';
      }
      if (approved !== counts.si > counts.no) {
        return `El resultado sellado (${sealedOutcome}) no es el que dan los votos del registro (${counts.si} a favor, ${counts.no} en contra).`;
      }
    } else {
      return 'La entrada de cierre no tiene un motivo válido.';
    }

    return undefined;
  }

  async verifyAllProposals(): Promise<VerificationResult[]> {
    const ids = await this.plazaRepository.listAllProposalIds();
    const results: VerificationResult[] = [];
    for (const id of ids) {
      results.push(await this.verifyProposal(id));
    }
    return results;
  }

  /**
   * Archivo público de una votación cerrada: el registro completo y la lista de
   * votantes, en dos estructuras separadas.
   *
   * Van separadas a propósito. Publicar ambas permite cuadrar cifras; unirlas
   * en una sola estructura reintroduciría la relación persona-voto que el
   * esquema evita.
   */
  async getPublicRecord(proposalId: string) {
    const proposal = await this.plazaRepository.findProposalById(proposalId);
    if (!proposal) throw new Error('La propuesta no existe.');
    if (proposal.status === 'abierta') {
      throw new Error('El registro se publica al cerrarse la votación.');
    }

    const entries = await this.plazaRepository.getLedger(proposalId);
    const counts = computeTally(entries);
    const voters = await this.plazaRepository.listVoters(proposalId);
    const target = await this.plazaRepository.getProposalTarget(proposalId);

    return {
      // El enunciado completo, para que el verificador independiente pueda
      // recalcular su huella y comprobar que nadie lo editó tras convocar.
      enunciado: {
        titulo: proposal.title,
        descripcion: proposal.description,
        clase: proposal.kind,
        modo: proposal.mode,
        accionCodice: target.targetAction ?? null,
        normaAfectada: target.targetRuleId ?? null,
        textoPropuesto: target.proposedBody ?? null,
        condicionesPropuestas: target.proposedBullets ?? [],
        seccionDestino: target.proposedSectionId ?? null
      },
      propuesta: {
        id: proposal.id,
        titulo: proposal.title,
        clase: proposal.kind,
        modo: proposal.mode,
        estado: proposal.status,
        convocada: proposal.createdAt.toISOString(),
        cerrada: proposal.closedAt?.toISOString(),
        motivoCierre: proposal.closeReason,
        huellaFinal: proposal.finalHash
      },
      recuento: {
        si: counts.si,
        no: counts.no,
        votosVigentes: counts.total,
        anulacionesSinRevoto: counts.anulacionesSinRevoto,
        participantes: voters.length
      },
      // El registro sellado. Sin identidades.
      registro: entries.map((e) => ({
        // El id es un UUID aleatorio sin relación con ningún usuario. Se
        // publica porque el verificador independiente lo necesita para
        // recalcular la huella y para emparejar las anulaciones con el voto
        // al que se refieren.
        id: e.id,
        posicion: e.sequence,
        tipo: e.kind,
        opcion: e.choice ?? null,
        anula: e.refId ?? null,
        motivoCierre: e.closeReason ?? null,
        esRevoto: e.isRevote ? true : undefined,
        // El sello no se guarda: solo su huella. Se publica para que cada cual
        // pueda localizar su propio voto en el archivo derivándola de su sello.
        huellaSello: e.urnaTokenHash ?? null,
        // Solo en la apertura: huella del enunciado sometido a votación.
        huellaEnunciado: e.contentHash ?? null,
        fecha: e.createdAt.toISOString(),
        huellaAnterior: e.prevHash,
        huella: e.hash
      })),
      // La lista de votantes. Sin fechas ni opciones.
      votantes: voters
    };
  }

  // --------------------------------------------------------------- Comentarios

  async addComment(proposalId: string, userId: string, body: string): Promise<ProposalComment> {
    const text = body?.trim();
    if (!text) throw new Error('El comentario está vacío.');

    const proposal = await this.plazaRepository.findProposalById(proposalId);
    if (!proposal) throw new Error('La propuesta no existe.');

    return this.plazaRepository.addComment({
      id: crypto.randomUUID(),
      proposalId,
      userId,
      body: text,
      createdAt: new Date()
    });
  }

  // ------------------------------------------------------------------ Interno

}
