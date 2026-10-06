export type RitualType = 'partida_online' | 'partida_presencial' | 'jornada';
export type RitualManager = 'secta' | 'villacuervos';
export type RitualStatus = 'programado' | 'cancelado';

export const RITUAL_TYPES: RitualType[] = ['partida_online', 'partida_presencial', 'jornada'];
export const RITUAL_MANAGERS: RitualManager[] = ['secta', 'villacuervos'];
export const RITUAL_STATUSES: RitualStatus[] = ['programado', 'cancelado'];

/** Una lista de inscripción de una partida de Villacuervos (narración, jugadores...). */
export interface RitualSignupList {
  name: string;
  order: number;
  /** Vacío: sin límite. */
  maxPlayers?: number;
  playerCount: number;
}

/** Una persona apuntada a una partida de La Secta. */
export interface RitualAttendee {
  /** Repetición de la serie a la que se apuntó; vacío en una partida suelta. */
  occurrence: string;
  userId: string;
  username: string;
  profilePicture?: string;
  signedUpAt: string;
}

export interface Ritual {
  id: string;
  type: RitualType;
  /**
   * Quién gestiona la partida. Solo en las partidas online: las de La Secta se
   * convocan aquí y las de Villacuervos se leen de su API.
   */
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
  /**
   * Cada cuántos meses se repite, en el mismo día de la semana y la misma
   * posición del mes. Excluyente con recurrenceDays.
   */
  recurrenceMonths?: number;
  recurrenceUntil?: string;
  /** Partida de Villacuervos en la que también se publicó. */
  villacuervosPlayId?: number;
  villacuervosSlug?: string;
  villacuervosUrl?: string;
  /**
   * Listas de inscripción, leídas de Villacuervos en cada consulta: las de sus
   * partidas y las de las partidas de aquí publicadas también allí.
   */
  signupLists?: RitualSignupList[];
  /** Si admite que la gente se apunte aquí: solo partidas online de La Secta no publicadas en Villacuervos. */
  signupsEnabled?: boolean;
  /**
   * Gente apuntada, en el orden en que se apuntó. En una serie periódica van
   * las de todas sus repeticiones, cada una con su occurrence.
   */
  attendees?: RitualAttendee[];
  status: RitualStatus;
  createdBy: string;
  createdByUsername?: string;
  createdAt: string;
  updatedAt?: string;
  /**
   * De dónde sale el ritual. Los de Villacuervos se leen de su API y no se
   * pueden editar desde aquí.
   */
  source: 'secta' | 'villacuervos';
}

export interface RitualInput {
  type: RitualType;
  managedBy?: RitualManager | null;
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
}

export const MAX_RECURRENCE_DAYS = 365;
export const MAX_RECURRENCE_MONTHS = 12;
