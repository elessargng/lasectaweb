import type { ReglaImagen } from './imagenes';

export type RitualType = 'partida_online' | 'partida_presencial' | 'jornada';
export type RitualManager = 'secta' | 'villacuervos';
export type RitualStatus = 'programado' | 'cancelado';

export const RITUAL_TYPES: RitualType[] = ['partida_online', 'partida_presencial', 'jornada'];
export const RITUAL_MANAGERS: RitualManager[] = ['secta', 'villacuervos'];
export const RITUAL_STATUSES: RitualStatus[] = ['programado', 'cancelado'];

/**
 * Qué significa apuntarse: en las partidas online de La Secta, inscribirse
 * (cuenta el orden, frente a las plazas); en las presenciales y los eventos,
 * solo avisar de que se piensa ir, sin orden ni prioridad.
 */
export type RitualAttendanceMode = 'inscripcion' | 'intencion';

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

/**
 * Una foto de un evento, que sube cualquier persona registrada (antes, durante o
 * después): lo que se ve en ella (para quien no la ve) y si la ve todo el mundo o
 * solo quien la subió.
 */
export interface RitualPhoto {
  id: string;
  src: string;
  alt: string;
  public: boolean;
  uploadedBy: string;
  uploadedByUsername?: string;
  uploadedAt: string;
}

/** Si alguien (o nadie, sin sesión) puede ver una foto: las públicas, todos; las privadas, quien la subió. */
export function puedeVerFoto(foto: RitualPhoto, userId?: string): boolean {
  return foto.public || (!!userId && foto.uploadedBy === userId);
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
  /**
   * Si admite que la gente se apunte aquí: las partidas online de La Secta no
   * publicadas en Villacuervos, y las presenciales y los eventos de La Secta.
   */
  signupsEnabled?: boolean;
  /** Con signupsEnabled: si es una inscripción o una intención de asistir. */
  attendanceMode?: RitualAttendanceMode;
  /**
   * Partida online publicada también en Villacuervos pero cuya inscripción se
   * lleva aquí (en La Secta), no en Villacuervos. Si va a false, la gente se
   * apunta en Villacuervos (con sus listas).
   */
  signupsInLaSecta?: boolean;
  /**
   * Gente apuntada, en el orden en que se apuntó. En una serie periódica van
   * las de todas sus repeticiones, cada una con su occurrence.
   */
  attendees?: RitualAttendee[];
  /** Solo en los eventos: las fotos que puede ver quien lo pide, en el orden en que se subieron. */
  photos?: RitualPhoto[];
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
  /** Al crear una online publicada también en Villacuervos: llevar aquí la inscripción. */
  signupsInLaSecta?: boolean;
}

export const MAX_RECURRENCE_DAYS = 365;
export const MAX_RECURRENCE_MONTHS = 12;

/** Cuántas fotos se suben de una vez. */
export const MAX_PHOTOS_PER_UPLOAD = 8;
/** Cuántas fotos puede subir cada persona a un evento. */
export const MAX_PHOTOS_PER_PERSON = 40;
/** Lo que puede ocupar la descripción de cada foto. */
export const MAX_RITUAL_PHOTO_ALT = 300;

/**
 * Las fotos de un evento: imágenes de verdad (nunca SVG). El cliente las manda ya
 * reducidas (1600 px, JPEG), así que sobra margen.
 */
export const FOTO_RITUAL: ReglaImagen = {
  maximos: { jpg: 3 * 1024 * 1024, png: 3 * 1024 * 1024, webp: 3 * 1024 * 1024, gif: 3 * 1024 * 1024 },
  noValida: 'Alguna foto no es válida (JPEG, PNG, WebP o GIF).',
  demasiadoGrande: 'Alguna foto es demasiado grande (máximo 3 MB).',
};
