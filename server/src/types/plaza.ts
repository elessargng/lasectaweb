/**
 * Tipos de La Plaza: propuestas, votos y registro sellado.
 *
 * El diseño se apoya en dos principios que conviene tener presentes al tocar
 * este módulo:
 *
 *  1. El registro de votos (plaza_votes) NO contiene identidades. La relación
 *     entre una persona y su voto no se guarda en ninguna parte.
 *  2. La participación (plaza_participation) sí guarda identidades, pero solo
 *     para evitar votos duplicados y poder publicar la lista de votantes.
 *
 * Cruzar ambas tablas rompería el secreto del voto. No se hace en ningún sitio.
 */

/** Clase de propuesta: determina en qué registro queda el resultado. */
export type ProposalKind = 'edicto' | 'acuerdo';

/**
 * Modo de comprobación de sellos.
 * - 'normal': comprobar el sello no altera el voto.
 * - 'secreto': comprobar el sello anula el voto (se puede volver a votar).
 */
export type ProposalMode = 'normal' | 'secreto';

export type ProposalStatus = 'abierta' | 'aprobada' | 'rechazada';

/** Motivo por el que se cerró una votación. Entra en la huella del cierre. */
export type CloseReason = 'plazo' | 'via_rapida';

/** Opción de voto. Los umbrales se definen sobre positivos y negativos. */
export type VoteChoice = 'si' | 'no';

/** Tipo de entrada en la cadena sellada. */
export type LedgerKind = 'apertura' | 'voto' | 'anulacion' | 'cierre';

export interface Proposal {
  id: string;
  authorId: string;
  title: string;
  description: string;
  kind: ProposalKind;
  mode: ProposalMode;
  status: ProposalStatus;
  createdAt: Date;
  /** Fecha límite del plazo ordinario (createdAt + PLAZO_DIAS). */
  deadlineAt: Date;
  closedAt?: Date;
  closeReason?: CloseReason;
  /** Huella final de la cadena. Solo presente al cerrarse. */
  finalHash?: string;
  /**
   * Se marca cuando la propuesta acumula más votos negativos de los que la vía
   * rápida admite. Es permanente: una anulación posterior no la reactiva.
   */
  fastTrackBlocked: boolean;
}

/**
 * Una entrada de la cadena sellada. Cada entrada incluye la huella de la
 * anterior, de forma que el registro no se puede alterar sin romper los
 * eslabones posteriores.
 *
 * No incluye userId por diseño: ver la nota de cabecera.
 */
export interface LedgerEntry {
  id: string;
  proposalId: string;
  /** Posición en la cadena, empezando en 1 (la apertura). */
  sequence: number;
  kind: LedgerKind;
  /**
   * En 'voto', la opción elegida. En 'apertura' lleva "clase:modo" y en
   * 'cierre' el resultado ('aprobada' o 'rechazada'), para que ambos entren en
   * la huella.
   */
  choice?: VoteChoice;
  /** Solo en 'anulacion': id de la entrada de voto que queda sin efecto. */
  refId?: string;
  /** Solo en 'cierre': por qué se cerró. */
  closeReason?: CloseReason;
  /**
   * Solo en 'voto': marca que este voto sustituye a uno anulado del mismo
   * votante. Se registra al emitirlo porque desde la cadena no se puede
   * deducir —sin identidades, un voto posterior a una anulación puede ser
   * igualmente el primer voto de otra persona—. Permite cuadrar:
   *   votos vigentes = participantes - anulacionesSinRevoto
   */
  isRevote?: boolean;
  /**
   * Huella del token de urna derivado del sello. Es lo único que el servidor
   * guarda del sello: sirve para localizar el voto sin conocerlo.
   */
  urnaTokenHash?: string;
  /**
   * Solo en 'apertura': huella del contenido sometido a votación. Ancla el
   * enunciado de la propuesta a la cadena.
   */
  contentHash?: string;
  createdAt: Date;
  prevHash: string;
  hash: string;
}

/** Constancia de que alguien participó. Nunca se cruza con LedgerEntry. */
export interface Participation {
  proposalId: string;
  userId: string;
  votedAt: Date;
}

/** Comentario en una propuesta. Público y con nombre: es debate, no voto. */
export interface ProposalComment {
  id: string;
  proposalId: string;
  userId: string;
  username?: string;
  body: string;
  createdAt: Date;
}

/** Recuento vigente de una propuesta, descontando anulaciones. */
export interface Tally {
  si: number;
  no: number;
  /** Votos vigentes (si + no). */
  total: number;
  /** Anulaciones que no fueron seguidas de un nuevo voto. */
  anulacionesSinRevoto: number;
  /** Personas que constan como participantes. */
  participantes: number;
}

/** Resultado de comprobar un sello. */
export interface ReceiptLookup {
  found: boolean;
  choice?: VoteChoice;
  sealedAt?: Date;
  /** true si esta consulta ha anulado el voto (solo en modo secreto). */
  annulled: boolean;
  /** true si la propuesta sigue abierta y por tanto se puede volver a votar. */
  canRevote: boolean;
}

/** Resultado de verificar la integridad de una cadena. */
export interface VerificationResult {
  ok: boolean;
  proposalId: string;
  entriesChecked: number;
  /** Descripción del primer problema encontrado, si hay alguno. */
  problem?: string;
  /** Posición de la entrada donde se rompe la cadena. */
  brokenAtSequence?: number;
  /** true si el número de votos no cuadra con el de participantes. */
  countMismatch?: boolean;
  /** true si el enunciado se ha editado después de convocar la votación. */
  contentTampered?: boolean;
  /** true si el estado o el resultado no son los que dicta el registro. */
  outcomeTampered?: boolean;
}
