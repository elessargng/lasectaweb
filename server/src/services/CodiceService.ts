import { CodiceRepository } from '../repositories/CodiceRepository';
import { PlazaRepository } from '../repositories/PlazaRepository';
import {
  SectionWithRules,
  RuleWithHistory,
  TargetAction,
  CodiceSection
} from '../types/codice';
import { VerificationResult } from '../types/plaza';
import seed from '../utils/codiceSeed.json';

/** Incidencia encontrada al verificar el Códice. */
export interface CodiceProblem {
  /** Norma afectada, o la votación si la norma que creó ya no existe. */
  ruleId: string;
  reference?: string;
  ok: false;
  problem: string;
  brokenAtVersion?: number;
  versionsChecked: number;
}

/**
 * Texto original de las normas fundacionales, por referencia.
 *
 * Esas normas no tienen votación que las respalde, así que el ancla es el
 * fichero del repositorio del que se cargaron: está bajo control de versiones
 * y cualquier cambio en él queda a la vista.
 */
const FOUNDATIONAL_TEXT = new Map<string, { body: string; bullets: string[] }>(
  (seed as any[]).flatMap((section) =>
    (section.articles as any[]).map((a) => [
      a.reference as string,
      { body: a.body as string, bullets: (a.bullets as string[] | undefined) ?? [] }
    ])
  )
);

function sameBullets(a: string[] | undefined, b: string[] | undefined): boolean {
  return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
}

export class CodiceService {
  /**
   * Verificación de una votación. Se inyecta después de construir (La Plaza y
   * el Códice dependen el uno del otro) y sin ella no se aplica nada: una
   * votación que no se puede verificar no cambia las leyes.
   */
  private verifyProposal?: (proposalId: string) => Promise<VerificationResult>;

  constructor(
    private codiceRepository: CodiceRepository,
    private plazaRepository: PlazaRepository
  ) {}

  setProposalVerifier(verifier: (proposalId: string) => Promise<VerificationResult>): void {
    this.verifyProposal = verifier;
  }

  async getCodice(includeRepealed = false): Promise<SectionWithRules[]> {
    return this.codiceRepository.getCodice(includeRepealed);
  }

  async listSections(): Promise<CodiceSection[]> {
    return this.codiceRepository.listSections();
  }

  /** Una norma con su histórico y la votación que aprobó cada versión. */
  async getRuleHistory(ruleId: string): Promise<RuleWithHistory | undefined> {
    return this.codiceRepository.getRuleWithHistory(ruleId);
  }

  /**
   * Una norma con su versión vigente, sin el histórico.
   *
   * La usa La Plaza para mostrar, junto a una propuesta de cambio, lo que la
   * norma dice ahora mismo.
   */
  async getRuleWithCurrent(ruleId: string) {
    const history = await this.codiceRepository.getRuleWithHistory(ruleId);
    if (!history) return undefined;

    // La vigente es la que marca la norma, igual que en el Códice completo:
    // así La Plaza y el Códice nunca muestran textos distintos.
    const current = history.versions.find((v) => v.id === history.currentVersionId);
    return {
      reference: history.reference,
      current: current
        ? { body: current.body, bullets: current.bullets, version: current.version }
        : undefined
    };
  }

  async getSectionById(sectionId: string) {
    const sections = await this.codiceRepository.listSections();
    return sections.find((s) => s.id === sectionId);
  }

  /**
   * Aplica al Códice el resultado de una votación aprobada.
   *
   * Se llama al cerrarse una propuesta que apuntaba a una norma. Si la
   * propuesta no tiene destino en el Códice (un acuerdo puntual, por ejemplo
   * una compra) no hace nada: no toda votación cambia las normas.
   *
   * Antes de tocar nada verifica la votación completa: la cadena, que el
   * enunciado no se haya editado tras convocar y que el resultado sea el que
   * dan los votos. Lo que se aplica es el texto que se votó, o nada.
   *
   * Es idempotente: aplicar dos veces la misma votación no genera versiones
   * duplicadas, aunque alguien haya vaciado appliedAt.
   */
  async applyApprovedProposal(proposalId: string): Promise<{ applied: boolean; reason?: string }> {
    const proposal = await this.plazaRepository.findProposalById(proposalId);
    if (!proposal) return { applied: false, reason: 'La propuesta no existe.' };

    const target = await this.plazaRepository.getProposalTarget(proposalId);

    if (!target.targetAction) {
      return { applied: false, reason: 'Esta votación no modifica el Códice.' };
    }
    if (target.appliedAt) {
      return { applied: false, reason: 'Ya se había aplicado.' };
    }
    if (proposal.status !== 'aprobada') {
      return { applied: false, reason: 'La propuesta no fue aprobada.' };
    }

    if (!this.verifyProposal) {
      return { applied: false, reason: 'No se puede verificar la votación.' };
    }
    const check = await this.verifyProposal(proposalId);
    if (!check.ok) {
      return {
        applied: false,
        reason: `La votación no supera la verificación y no se aplica: ${check.problem}`
      };
    }

    const changeNote = `Aprobado en la votación "${proposal.title}".`;
    // La huella final de la votación queda sellada en la versión, de forma que
    // se pueda comprobar que el texto en vigor es el que se votó.
    const proposalFinalHash = proposal.finalHash;

    switch (target.targetAction as TargetAction) {
      case 'crear':
      case 'modificar': {
        // Si la versión ya existe, la votación se aplicó y solo faltaba
        // anotarlo.
        if (await this.codiceRepository.findVersionByProposalId(proposalId)) break;

        if (!target.proposedBody) {
          return { applied: false, reason: 'Falta el texto de la norma.' };
        }

        if (target.targetAction === 'crear') {
          if (!target.proposedSectionId) {
            return { applied: false, reason: 'Falta la sección de la norma.' };
          }
          const section = (await this.codiceRepository.listSections()).find(
            (s) => s.id === target.proposedSectionId
          );
          if (!section) return { applied: false, reason: 'La sección no existe.' };

          const reference = await this.codiceRepository.nextReference(section.number);
          await this.codiceRepository.createRule({
            sectionId: section.id,
            reference,
            kind: proposal.kind,
            position: parseInt(reference.split('.')[1] ?? '0', 10),
            body: target.proposedBody,
            bullets: target.proposedBullets ?? [],
            origin: 'votacion',
            proposalId,
            proposalFinalHash,
            changeNote
          });
          break;
        }

        if (!target.targetRuleId) {
          return { applied: false, reason: 'Falta la norma a modificar.' };
        }
        const rule = await this.codiceRepository.findRuleById(target.targetRuleId);
        if (!rule) return { applied: false, reason: 'La norma no existe.' };
        if (rule.repealedAt) return { applied: false, reason: 'La norma está derogada.' };

        // Añade una versión nueva y la pone en vigor. La anterior se conserva.
        await this.codiceRepository.addVersion({
          ruleId: target.targetRuleId,
          body: target.proposedBody,
          bullets: target.proposedBullets ?? [],
          origin: 'votacion',
          proposalId,
          proposalFinalHash,
          changeNote
        });
        break;
      }

      case 'derogar': {
        if (!target.targetRuleId) {
          return { applied: false, reason: 'Falta la norma a derogar.' };
        }
        const rule = await this.codiceRepository.findRuleById(target.targetRuleId);
        if (!rule) return { applied: false, reason: 'La norma no existe.' };

        if (rule.repealedAt) {
          if (rule.repealedByProposalId !== proposalId) {
            return { applied: false, reason: 'La norma ya estaba derogada por otra votación.' };
          }
          break;
        }
        await this.codiceRepository.repealRule(target.targetRuleId, proposalId);
        break;
      }

      default:
        return { applied: false, reason: 'Acción desconocida.' };
    }

    await this.plazaRepository.markProposalApplied(proposalId);
    return { applied: true };
  }

  /**
   * Verifica el Códice: que nadie ha editado el texto de una ley por debajo y
   * que lo que está en vigor es exactamente lo que se votó.
   *
   * La cadena de versiones por sí sola no basta: sus huellas no llevan ningún
   * secreto, así que quien pueda escribir en la base de datos puede cambiar un
   * texto y recalcularlas. Por eso cada versión se cruza además con su ancla:
   * la votación que la aprobó (cuyo registro es público y verificable desde
   * fuera) o, en las fundacionales, el Códice original del repositorio.
   *
   * Devuelve solo las normas con problemas: el Códice tiene decenas de normas y
   * el vigilante solo necesita saber qué falla.
   */
  async verifyCodice(): Promise<CodiceProblem[]> {
    const problems: CodiceProblem[] = [];
    /** Votaciones que respaldan algún cambio del Códice. */
    const backing = new Set<string>();

    for (const ruleId of await this.codiceRepository.listAllRuleIds()) {
      const chain = await this.codiceRepository.verifyRuleChain(ruleId);
      const rule = await this.codiceRepository.getRuleWithHistory(ruleId);

      if (!chain.ok) {
        problems.push({
          ruleId,
          reference: rule?.reference,
          ok: false,
          problem: chain.problem ?? 'La cadena de versiones está rota.',
          brokenAtVersion: chain.brokenAtVersion,
          versionsChecked: chain.versionsChecked
        });
        continue;
      }
      if (!rule) continue;

      const problem = await this.checkRuleAnchors(rule, backing);
      if (problem) {
        problems.push({
          ruleId,
          reference: rule.reference,
          ok: false,
          problem: problem.text,
          brokenAtVersion: problem.version,
          versionsChecked: chain.versionsChecked
        });
      }
    }

    // Al revés: toda votación aplicada debe haber dejado su rastro. Borrar la
    // última versión de una norma (o una derogación) no rompe ninguna cadena;
    // solo se delata porque la votación que la aprobó se queda sin respaldo.
    for (const proposalId of await this.plazaRepository.listAppliedProposalIds()) {
      if (backing.has(proposalId)) continue;

      const proposal = await this.plazaRepository.findProposalById(proposalId);
      const target = await this.plazaRepository.getProposalTarget(proposalId);
      const rule = target.targetRuleId
        ? await this.codiceRepository.findRuleById(target.targetRuleId)
        : undefined;

      problems.push({
        ruleId: target.targetRuleId ?? proposalId,
        reference: rule?.reference,
        ok: false,
        problem: `La votación "${proposal?.title ?? proposalId}" se aplicó al Códice, pero el cambio que aprobó (${target.targetAction}) ya no está.`,
        versionsChecked: 0
      });
    }

    return problems;
  }

  /**
   * Cruza cada versión de una norma con su ancla y comprueba que la versión en
   * vigor y la derogación, si la hay, son las que corresponden.
   *
   * Anota en `backing` las votaciones que respaldan algo de esta norma.
   */
  private async checkRuleAnchors(
    rule: RuleWithHistory,
    backing: Set<string>
  ): Promise<{ text: string; version?: number } | undefined> {
    // El histórico viene de la más reciente a la más antigua.
    const versions = [...rule.versions].reverse();
    if (versions.length === 0) return { text: 'La norma no tiene ningún texto.' };

    // Se anotan primero todas las votaciones que respaldan algo de esta norma,
    // para que un problema en ella no se avise además como "votación aplicada
    // sin rastro". Una misma votación no puede respaldar dos cambios.
    const backers = [
      ...versions.map((v) => v.proposalId),
      rule.repealedAt ? rule.repealedByProposalId : undefined
    ].filter((id): id is string => !!id);
    let duplicated = false;
    for (const id of backers) {
      if (backing.has(id)) duplicated = true;
      backing.add(id);
    }
    if (duplicated) return { text: 'Una misma votación respalda más de un cambio del Códice.' };

    const latest = versions[versions.length - 1];
    if (rule.currentVersionId !== latest.id) {
      return {
        text: `La versión en vigor no es la última aprobada (la ${latest.version}).`,
        version: latest.version
      };
    }

    for (const version of versions) {
      if (version.origin === 'fundacional') {
        if (version.version !== 1) {
          return {
            text: `La versión ${version.version} figura como fundacional: solo la primera puede serlo.`,
            version: version.version
          };
        }
        const original = FOUNDATIONAL_TEXT.get(rule.reference);
        if (!original) {
          return { text: 'Figura como fundacional, pero no está en el Códice original.', version: 1 };
        }
        if (original.body !== version.body || !sameBullets(original.bullets, version.bullets)) {
          return { text: 'El texto fundacional no coincide con el del Códice original.', version: 1 };
        }
        continue;
      }

      if (version.origin !== 'votacion') {
        return { text: `La versión ${version.version} tiene un origen desconocido.`, version: version.version };
      }

      const expectedAction: TargetAction = version.version === 1 ? 'crear' : 'modificar';
      const problem = await this.checkBackingProposal(version.proposalId, async (proposalId) => {
        const target = await this.plazaRepository.getProposalTarget(proposalId);
        const proposal = await this.plazaRepository.findProposalById(proposalId);

        if (target.targetAction !== expectedAction) {
          return `la votación no era para ${expectedAction === 'crear' ? 'crear esta norma' : 'modificarla'}`;
        }
        if (expectedAction === 'modificar' && target.targetRuleId !== rule.id) {
          return 'la votación modificaba otra norma';
        }
        if (expectedAction === 'crear' && target.proposedSectionId !== rule.sectionId) {
          return 'la norma no está en la sección que se votó';
        }
        if (proposal?.finalHash !== version.proposalFinalHash) {
          return 'la huella de la votación no es la que se selló en la versión';
        }
        if (target.proposedBody !== version.body || !sameBullets(target.proposedBullets, version.bullets)) {
          return 'el texto en vigor no es el que se votó';
        }
        return undefined;
      });
      if (problem) return { text: `Versión ${version.version}: ${problem}.`, version: version.version };
    }

    if (rule.repealedAt) {
      const problem = await this.checkBackingProposal(rule.repealedByProposalId, async (proposalId) => {
        const target = await this.plazaRepository.getProposalTarget(proposalId);
        if (target.targetAction !== 'derogar' || target.targetRuleId !== rule.id) {
          return 'la votación no era para derogar esta norma';
        }
        return undefined;
      });
      if (problem) return { text: `Derogación: ${problem}.` };
    }

    return undefined;
  }

  /**
   * Comprobaciones comunes a toda votación que respalda un cambio del Códice:
   * que existe, que se aprobó y que su registro es íntegro. `specific` añade
   * lo propio de cada tipo de cambio.
   */
  private async checkBackingProposal(
    proposalId: string | undefined,
    specific: (proposalId: string) => Promise<string | undefined>
  ): Promise<string | undefined> {
    if (!proposalId) return 'no hay ninguna votación que lo respalde';

    const proposal = await this.plazaRepository.findProposalById(proposalId);
    if (!proposal) return 'la votación que lo aprobó ya no existe';
    if (proposal.status !== 'aprobada') return 'la votación que lo respalda no fue aprobada';

    if (!this.verifyProposal) return 'no se puede verificar la votación que lo respalda';
    const check = await this.verifyProposal(proposalId);
    if (!check.ok) return `la votación que lo respalda no supera la verificación (${check.problem})`;

    return specific(proposalId);
  }

  /**
   * Aplica todas las votaciones aprobadas que aún no se han reflejado en el
   * Códice. Lo llama el vigilante, para que un cierre que no llegara a
   * aplicarse en su momento no se quede sin efecto.
   */
  async applyPendingProposals(): Promise<string[]> {
    const pending = await this.plazaRepository.listApprovedUnappliedProposals();
    const applied: string[] = [];
    for (const id of pending) {
      const result = await this.applyApprovedProposal(id);
      if (result.applied) applied.push(id);
      else console.warn(`[Codice] La votación ${id} sigue sin aplicarse: ${result.reason}`);
    }
    return applied;
  }
}
