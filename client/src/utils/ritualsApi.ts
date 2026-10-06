import { parseApiResponse } from './api';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';

export type RitualType = 'partida_online' | 'partida_presencial' | 'jornada';
export type RitualManager = 'secta' | 'villacuervos';
export type RitualStatus = 'programado' | 'cancelado';

/** Una lista de inscripción de Villacuervos (narración, jugadores...). */
export interface RitualSignupList {
  name: string;
  order: number;
  /** Ausente: sin límite. */
  maxPlayers?: number;
  playerCount: number;
}

/** Una persona apuntada a una partida de La Secta. */
export interface RitualAttendee {
  /** Repetición de la serie (su inicio en ISO); vacío en una partida suelta. */
  occurrence: string;
  userId: string;
  username: string;
  profilePicture?: string;
  signedUpAt: string;
}

export interface Ritual {
  id: string;
  type: RitualType;
  /** Online: 'secta' si se convocó aquí, 'villacuervos' si se lee de su API. */
  managedBy?: RitualManager;
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
  location?: string;
  link?: string;
  scriptName?: string;
  maxPlayers?: number;
  storytellerId?: string;
  storytellerUsername?: string;
  /** Cada cuántos días se repite. Solo en las partidas presenciales. */
  recurrenceDays?: number;
  /** Cada cuántos meses, en el mismo día de la semana y posición del mes. */
  recurrenceMonths?: number;
  recurrenceUntil?: string;
  /** Partida de Villacuervos en la que también se publicó. */
  villacuervosPlayId?: number;
  villacuervosUrl?: string;
  /** Listas de inscripción, leídas de Villacuervos. */
  signupLists?: RitualSignupList[];
  /** Admite que la gente se apunte aquí: solo partidas online de La Secta no publicadas en Villacuervos. */
  signupsEnabled?: boolean;
  /**
   * Gente apuntada, en el orden en que se apuntó. Al desplegar una serie, cada
   * repetición se queda solo con la suya.
   */
  attendees?: RitualAttendee[];
  /**
   * Solo en el cliente, al desplegar una serie periódica: cuándo empieza la
   * serie (startsAt es el de esta repetición) y una clave única por repetición.
   */
  seriesStartsAt?: string;
  occurrenceKey?: string;
  status: RitualStatus;
  createdBy: string;
  createdByUsername?: string;
  createdAt: string;
  updatedAt?: string;
  /** Los de Villacuervos se leen de su API y no se editan desde aquí. */
  source: 'secta' | 'villacuervos';
}

export interface RitualInput {
  type: RitualType;
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
  link?: string | null;
  scriptName?: string | null;
  maxPlayers?: number | null;
  storytellerId?: string | null;
  recurrenceDays?: number | null;
  recurrenceMonths?: number | null;
  recurrenceUntil?: string | null;
  status?: RitualStatus;
  /** Al convocar una partida online: publicarla también en Villacuervos. */
  alsoInVillacuervos?: boolean;
}

export interface Storyteller {
  id: string;
  username: string;
}

const authHeaders = (token: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`
});

export async function listRituals(from: Date, to: Date): Promise<Ritual[]> {
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  return parseApiResponse(await fetch(`${API_URL}/rituals?${params}`));
}

export async function listStorytellers(token: string): Promise<Storyteller[]> {
  return parseApiResponse(await fetch(`${API_URL}/rituals/storytellers`, { headers: authHeaders(token) }));
}

export async function createRitual(token: string, input: RitualInput): Promise<Ritual> {
  return parseApiResponse(
    await fetch(`${API_URL}/rituals`, { method: 'POST', headers: authHeaders(token), body: JSON.stringify(input) })
  );
}

export async function updateRitual(token: string, id: string, input: RitualInput): Promise<Ritual> {
  return parseApiResponse(
    await fetch(`${API_URL}/rituals/${id}`, { method: 'PUT', headers: authHeaders(token), body: JSON.stringify(input) })
  );
}

/** Clave de la repetición a la que se apunta: su inicio en una serie, nada en una partida suelta. */
function occurrenceOf(ritual: Ritual): string | undefined {
  return ritual.seriesStartsAt ? ritual.startsAt : undefined;
}

export async function signUpForRitual(token: string, ritual: Ritual): Promise<void> {
  await parseApiResponse(
    await fetch(`${API_URL}/rituals/${ritual.id}/signups`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ occurrence: occurrenceOf(ritual) })
    })
  );
}

export async function leaveRitual(token: string, ritual: Ritual): Promise<void> {
  const occurrence = occurrenceOf(ritual);
  const query = occurrence ? `?${new URLSearchParams({ occurrence })}` : '';
  await parseApiResponse(
    await fetch(`${API_URL}/rituals/${ritual.id}/signups${query}`, { method: 'DELETE', headers: authHeaders(token) })
  );
}

export async function deleteRitual(token: string, id: string): Promise<void> {
  const response = await fetch(`${API_URL}/rituals/${id}`, { method: 'DELETE', headers: authHeaders(token) });
  if (!response.ok) await parseApiResponse(response);
}
