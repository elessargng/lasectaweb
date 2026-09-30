import { parseApiResponse } from './api';
import { generateSeal, deriveTokens } from './sealCrypto';

/**
 * Cliente de la API de La Plaza.
 *
 * Las respuestas del servidor vienen en castellano (sello, voto, recuento...),
 * así que los tipos siguen esa nomenclatura para no traducir de ida y vuelta.
 */

export type ProposalKind = 'edicto' | 'acuerdo';
export type ProposalMode = 'normal' | 'secreto';
export type ProposalStatus = 'abierta' | 'aprobada' | 'rechazada';
export type CloseReason = 'plazo' | 'via_rapida';
export type VoteChoice = 'si' | 'no';

export interface Proposal {
  id: string;
  authorId: string;
  title: string;
  description: string;
  kind: ProposalKind;
  mode: ProposalMode;
  status: ProposalStatus;
  createdAt: string;
  deadlineAt: string;
  closedAt?: string;
  closeReason?: CloseReason;
  finalHash?: string;
  fastTrackBlocked: boolean;
}

export interface ProposalListItem extends Proposal {
  authorUsername: string;
  commentCount: number;
  /** Qué hace con el Códice. Ausente en los acuerdos puntuales. */
  targetAction?: TargetAction;
  /** Numeración de la norma afectada, al modificar o derogar. */
  targetReference?: string;
}

export interface Tally {
  si: number;
  no: number;
  total: number;
  anulacionesSinRevoto: number;
  participantes: number;
}

export interface Comment {
  id: string;
  proposalId: string;
  userId: string;
  username?: string;
  body: string;
  createdAt: string;
}

/**
 * El cambio que una propuesta hará en el Códice si se aprueba, con el texto
 * vigente al lado para poder compararlos. Ausente en los acuerdos puntuales,
 * que no tocan las normas.
 */
export interface ProposedChange {
  action: TargetAction;
  proposedBody?: string;
  proposedBullets: string[];
  /** Cuándo se aplicó al Códice. Solo en propuestas ya aprobadas. */
  appliedAt?: string;
  /** Norma afectada, al modificar o derogar. */
  reference?: string;
  currentBody?: string;
  currentBullets?: string[];
  currentVersion?: number;
  /** Sección de destino, al crear una norma nueva. */
  sectionNumber?: number;
  sectionTitle?: string;
}

export interface ProposalDetail {
  proposal: Proposal;
  tally: Tally;
  comments: Comment[];
  /** Qué cambia en el Códice. Ausente si es un acuerdo puntual. */
  change?: ProposedChange;
  /** Solo presente si la votación está cerrada. */
  voters?: string[];
  /** Estado de participación de quien consulta. Solo lo ve esa persona. */
  hasVoted?: boolean;
  /**
   * Si quien consulta puede votar ahora mismo. Distinto de !hasVoted: tras
   * anular un voto en modo secreto sigue constando como participante, pero
   * tiene derecho a votar de nuevo.
   */
  canVote?: boolean;
}

export interface ReceiptResult {
  encontrado: boolean;
  voto?: VoteChoice;
  sellado?: string;
  anulado: boolean;
  puedeVolverAVotar: boolean;
  mensaje?: string;
  /**
   * Segunda fase de la anulación, que corre en segundo plano con un retardo
   * deliberado. Espérala si necesitas refrescar la interfaz cuando el turno de
   * voto esté ya devuelto.
   */
  turnoRecuperado?: Promise<void>;
}

/** Reglas de aprobación. Deben coincidir con las del servidor. */
export const PLAZO_DIAS = 14;
export const VIA_RAPIDA_MIN_POSITIVOS = 15;
export const VIA_RAPIDA_MAX_NEGATIVOS = 1;
export const VIA_RAPIDA_MIN_DIAS = 3;

function apiUrl(): string {
  return import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';
}

function authHeaders(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function listProposals(status?: ProposalStatus): Promise<ProposalListItem[]> {
  const query = status ? `?status=${status}` : '';
  const res = await fetch(`${apiUrl()}/plaza/proposals${query}`);
  return parseApiResponse<ProposalListItem[]>(res);
}

export async function getProposal(id: string, token: string | null): Promise<ProposalDetail> {
  const res = await fetch(`${apiUrl()}/plaza/proposals/${id}`, {
    headers: authHeaders(token)
  });
  return parseApiResponse<ProposalDetail>(res);
}

export interface CreateProposalPayload {
  title: string;
  description: string;
  kind: ProposalKind;
  mode: ProposalMode;
  /**
   * Solo si la propuesta cambia el Códice. Un acuerdo puntual (una compra, una
   * fecha) no lleva destino: no toca las normas.
   */
  targetAction?: TargetAction;
  targetRuleId?: string;
  proposedBody?: string;
  proposedBullets?: string[];
  proposedSectionId?: string;
}

export async function createProposal(
  token: string,
  payload: CreateProposalPayload
): Promise<Proposal> {
  const res = await fetch(`${apiUrl()}/plaza/proposals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(payload)
  });
  return parseApiResponse<Proposal>(res);
}

export async function castVote(
  id: string,
  token: string,
  choice: VoteChoice
): Promise<{ sello: string; votacionCerrada: boolean }> {
  // El sello se genera aquí y solo viaja esta vez: el servidor guarda las
  // huellas de sus dos tokens y se olvida del sello.
  const sello = await generateSeal();

  const res = await fetch(`${apiUrl()}/plaza/proposals/${id}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify({ choice, seal: sello })
  });
  const data = await parseApiResponse<{ votacionCerrada: boolean }>(res);
  // El sello no vuelve del servidor: es el que acabamos de generar aquí, y el
  // servidor solo conserva las huellas de sus dos tokens.
  return { sello, votacionCerrada: data.votacionCerrada };
}

/**
 * Comprueba un sello.
 *
 * OJO: en votaciones en modo secreto esta llamada ANULA el voto. Pide siempre
 * confirmación explícita antes de invocarla en ese modo.
 */
export async function checkReceipt(id: string, seal: string): Promise<ReceiptResult> {
  const tokens = await deriveTokens(seal);

  // FASE 1 — la urna. Solo viaja el token de urna, nunca el sello.
  const res = await fetch(`${apiUrl()}/plaza/proposals/${id}/check-receipt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urnaToken: tokens.urna })
  });

  // Un sello que no consta devuelve 404, que es una respuesta legítima y no un
  // error: se normaliza para que la interfaz la muestre como tal.
  if (res.status === 404) {
    const data = await res.json().catch(() => ({}));
    return {
      encontrado: false,
      anulado: false,
      puedeVolverAVotar: false,
      mensaje: data?.mensaje
    };
  }

  const result = await parseApiResponse<ReceiptResult>(res);

  // FASE 2 — el censo. Solo si el voto se ha anulado, con el otro token y
  // separada en el tiempo: si ambas llamadas salieran a la vez, su cercanía en
  // los registros del servidor permitiría emparejarlas y se perdería justo la
  // separación que buscamos.
  if (result.anulado) {
    const delay = 1500 + Math.random() * 3500;
    // Sin await: la respuesta se muestra ya, y el turno se recupera en segundo
    // plano. Devolvemos la promesa para que quien llame pueda esperarla si
    // necesita refrescar la interfaz al terminar.
    result.turnoRecuperado = new Promise<void>((resolve) => {
      setTimeout(async () => {
        try {
          await fetch(`${apiUrl()}/plaza/proposals/${id}/release-turn`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ censoToken: tokens.censo })
          });
        } catch {
          // Si falla, el voto queda anulado pero sin turno devuelto. Volver a
          // comprobar el mismo sello reintenta esta fase.
        }
        resolve();
      }, delay);
    });
  }

  return result;
}

export async function addComment(id: string, token: string, body: string): Promise<Comment> {
  const res = await fetch(`${apiUrl()}/plaza/proposals/${id}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify({ body })
  });
  return parseApiResponse<Comment>(res);
}

/** URL del registro público. El navegador la abre para descargar el archivo. */
export function recordUrl(id: string, download = false): string {
  return `${apiUrl()}/plaza/proposals/${id}/record${download ? '?download=1' : ''}`;
}

export function verifyUrl(id: string): string {
  return `${apiUrl()}/plaza/proposals/${id}/verify`;
}

export interface VerificationResult {
  ok: boolean;
  proposalId: string;
  entriesChecked: number;
  problem?: string;
  brokenAtSequence?: number;
  countMismatch?: boolean;
}

export async function verifyProposal(id: string): Promise<VerificationResult> {
  const res = await fetch(verifyUrl(id));
  // Un 409 significa "se ha encontrado un problema", que es un resultado
  // válido de la verificación y no un fallo de la petición.
  if (res.status === 409) {
    return res.json();
  }
  return parseApiResponse<VerificationResult>(res);
}

// ------------------------------------------------------------------- Utilidades

/** Días que quedan para que venza el plazo ordinario. */
export function daysRemaining(deadlineAt: string): number {
  const ms = new Date(deadlineAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

/** Días transcurridos desde que se convocó. */
export function daysElapsed(createdAt: string): number {
  const ms = Date.now() - new Date(createdAt).getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

/**
 * ¿Puede esta propuesta cerrarse aún por vía rápida?
 *
 * Se usa solo para informar en la interfaz; la decisión real la toma el
 * servidor al registrar cada voto.
 */
export function fastTrackStatus(
  proposal: Proposal,
  tally: Tally
): { available: boolean; missing: string[] } {
  if (proposal.fastTrackBlocked) {
    return { available: false, missing: ['Hay más de un voto en contra'] };
  }

  const missing: string[] = [];
  if (tally.si < VIA_RAPIDA_MIN_POSITIVOS) {
    missing.push(`Faltan ${VIA_RAPIDA_MIN_POSITIVOS - tally.si} votos a favor`);
  }
  const elapsed = daysElapsed(proposal.createdAt);
  if (elapsed < VIA_RAPIDA_MIN_DIAS) {
    const dias = VIA_RAPIDA_MIN_DIAS - elapsed;
    missing.push(`${dias} ${dias === 1 ? 'día' : 'días'} de espera mínima`);
  }

  return { available: missing.length === 0, missing };
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

// ---------------------------------------------------------------- El Códice

export type RuleKind = 'edicto' | 'acuerdo';
export type VersionOrigin = 'fundacional' | 'votacion';
export type TargetAction = 'crear' | 'modificar' | 'derogar';

export interface CodiceVersion {
  id: string;
  ruleId: string;
  version: number;
  body: string;
  bullets: string[];
  proposalId?: string;
  origin: VersionOrigin;
  changeNote?: string;
  createdAt: string;
}

export interface CodiceRule {
  id: string;
  sectionId: string;
  reference: string;
  kind: RuleKind;
  position: number;
  currentVersionId?: string;
  repealedAt?: string;
  repealedByProposalId?: string;
  createdAt: string;
  current?: CodiceVersion;
  /** Versiones anteriores. Si es 0, la norma nunca se ha modificado. */
  historyCount: number;
}

export interface CodiceSection {
  id: string;
  number: number;
  title: string;
  icon?: string;
  position: number;
  rules: CodiceRule[];
}

export interface RuleHistory extends Omit<CodiceRule, 'current' | 'historyCount'> {
  sectionNumber: number;
  sectionTitle: string;
  versions: Array<
    CodiceVersion & {
      proposalTitle?: string;
      proposalClosedAt?: string;
      proposalFinalHash?: string;
    }
  >;
}

export async function getCodice(includeRepealed = false): Promise<CodiceSection[]> {
  const res = await fetch(`${apiUrl()}/codice${includeRepealed ? '?derogadas=1' : ''}`);
  return parseApiResponse<CodiceSection[]>(res);
}

export async function getCodiceSections(): Promise<Omit<CodiceSection, 'rules'>[]> {
  const res = await fetch(`${apiUrl()}/codice/sections`);
  return parseApiResponse(res);
}

export async function getRuleHistory(ruleId: string): Promise<RuleHistory> {
  const res = await fetch(`${apiUrl()}/codice/rules/${ruleId}/history`);
  return parseApiResponse<RuleHistory>(res);
}
