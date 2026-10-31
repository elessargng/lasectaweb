/**
 * Tipos del Códice: las normas de La Secta, versionadas.
 *
 * Modelo: una norma (CodiceRule) tiene identidad estable y numeración visible;
 * su contenido vive en versiones (CodiceVersion) que nunca se modifican. Cambiar
 * una norma añade una versión nueva y traslada la vigencia, de forma que el
 * histórico queda completo.
 *
 * Las normas anteriores a La Plaza tienen su primera versión marcada como
 * 'fundacional' y sin votación asociada: la votación solo es obligatoria para
 * las normas nuevas y las modificaciones.
 */

export type RuleKind = 'edicto' | 'acuerdo';

/**
 * De dónde viene una versión.
 * - 'fundacional': ya existía antes de La Plaza, no se votó.
 * - 'votacion': aprobada en una votación de La Plaza.
 */
export type VersionOrigin = 'fundacional' | 'votacion';

/** Qué pretende hacer una propuesta con el Códice. */
export type TargetAction = 'crear' | 'modificar' | 'derogar';

export interface CodiceSection {
  id: string;
  number: number;
  title: string;
  icon?: string;
  position: number;
}

export interface CodiceVersion {
  id: string;
  ruleId: string;
  version: number;
  body: string;
  bullets: string[];
  /** Votación que la aprobó. Ausente en versiones fundacionales. */
  proposalId?: string;
  origin: VersionOrigin;
  changeNote?: string;
  createdAt: Date;
  /** Huella de la versión anterior de esta norma. Encadena el histórico. */
  prevHash?: string;
  /** Huella de esta versión. Alterar su texto la invalida. */
  hash?: string;
  /** Huella final de la votación que la aprobó. Liga el texto a su origen. */
  proposalFinalHash?: string;
}

export interface CodiceRule {
  id: string;
  sectionId: string;
  /** Numeración visible, por ejemplo '1.4'. Se mantiene entre versiones. */
  reference: string;
  kind: RuleKind;
  position: number;
  currentVersionId?: string;
  repealedAt?: Date;
  repealedByProposalId?: string;
  createdAt: Date;
}

/** Una norma con su versión vigente resuelta, para mostrarla en el Códice. */
export interface RuleWithCurrent extends CodiceRule {
  current?: CodiceVersion;
  /** Número de versiones anteriores. Si es 0, nunca se ha modificado. */
  historyCount: number;
}

/** Una sección con sus normas vigentes. */
export interface SectionWithRules extends CodiceSection {
  rules: RuleWithCurrent[];
}

/** Norma con su histórico completo, para la vista de detalle. */
export interface RuleWithHistory extends CodiceRule {
  sectionNumber: number;
  sectionTitle: string;
  versions: Array<
    CodiceVersion & {
      /** Datos de la votación, si esta versión vino de una. */
      proposalTitle?: string;
      proposalClosedAt?: Date;
      proposalFinalHash?: string;
    }
  >;
}

/** Lo que una propuesta pretende cambiar en el Códice. */
export interface ProposalTarget {
  targetRuleId?: string;
  targetAction?: TargetAction;
  proposedBody?: string;
  proposedBullets?: string[];
  proposedSectionId?: string;
  appliedAt?: Date;
}
