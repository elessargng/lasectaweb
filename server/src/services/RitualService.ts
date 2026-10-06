import crypto from 'crypto';
import { RitualRepository } from '../repositories/RitualRepository';
import { RitualSignupRepository } from '../repositories/RitualSignupRepository';
import { UserRepository } from '../repositories/UserRepository';
import { VillacuervosService } from './VillacuervosService';
import { PublicPlayListSchema } from '../types/villacuervos';
import {
  Ritual,
  RitualInput,
  RitualSignupList,
  MAX_RECURRENCE_DAYS,
  MAX_RECURRENCE_MONTHS,
  RITUAL_STATUSES,
  RITUAL_TYPES
} from '../types/rituals';

function villacuervosPlayUrl(playId: number, slug: string): string {
  return `https://villacuervos.es/partidas/${process.env.VILLACUERVOS_CULT_SLUG}/${playId}/${slug}`;
}

function toSignupLists(lists: PublicPlayListSchema[]): RitualSignupList[] {
  return [...lists]
    .sort((a, b) => a.order - b.order)
    .map((l) => ({
      name: l.name.trim(),
      order: l.order,
      maxPlayers: l.max_players ?? undefined,
      playerCount: l.player_count
    }));
}

function withVillacuervosUrl(ritual: Ritual): Ritual {
  if (ritual.villacuervosPlayId && ritual.villacuervosSlug) {
    ritual.villacuervosUrl = villacuervosPlayUrl(ritual.villacuervosPlayId, ritual.villacuervosSlug);
  }
  return ritual;
}

const MAX_RANGE_DAYS = 120;

export class RitualService {
  constructor(
    private ritualRepository: RitualRepository,
    private userRepository: UserRepository,
    private villacuervosService: VillacuervosService,
    private signupRepository: RitualSignupRepository
  ) {}

  /**
   * Admite inscripción aquí: solo las partidas online de La Secta. Las
   * publicadas también en Villacuervos no, porque allí ya tienen sus listas y
   * la gente se apunta allí; las presenciales y las jornadas tampoco.
   */
  private acceptsSignups(ritual: Ritual): boolean {
    return ritual.source === 'secta' && ritual.type === 'partida_online' && !ritual.villacuervosPlayId;
  }

  private async withAttendees(rituals: Ritual[]): Promise<Ritual[]> {
    const open = rituals.filter((r) => this.acceptsSignups(r));
    const attendees = await this.signupRepository.listForRituals(open.map((r) => r.id));
    for (const r of open) {
      r.signupsEnabled = true;
      r.attendees = attendees.get(r.id) ?? [];
    }
    return rituals;
  }

  /** Convocar, modificar y cancelar rituales es cosa de narradores y administradores. */
  private async checkOrganizerPermission(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('Usuario no encontrado.');
    }
    if (!user.roles.includes('narrador') && !user.roles.includes('admin')) {
      throw new Error('Acceso denegado. Se requiere el rol de narrador.');
    }
  }

  /**
   * La agenda de un intervalo: los rituales propios y, junto a ellos, las
   * partidas pendientes de La Secta en Villacuervos que no se hayan apuntado
   * aquí. Las listas de inscripción se leen de Villacuervos en cada consulta,
   * también para las partidas de aquí publicadas allí. Si Villacuervos no
   * responde, la agenda se sirve igualmente, sin sus partidas ni sus listas.
   */
  async listBetween(from: string, to: string): Promise<Ritual[]> {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime()) || toDate <= fromDate) {
      throw new Error('El intervalo de fechas no es válido.');
    }
    if (toDate.getTime() - fromDate.getTime() > MAX_RANGE_DAYS * 24 * 60 * 60 * 1000) {
      throw new Error(`El intervalo no puede superar los ${MAX_RANGE_DAYS} días.`);
    }

    const fromIso = fromDate.toISOString();
    const toIso = toDate.toISOString();
    const own = await this.withAttendees((await this.ritualRepository.listBetween(fromIso, toIso)).map(withVillacuervosUrl));
    const external = await this.listVillacuervosPlays(fromIso, toIso, own);

    return [...own, ...external].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  /** Quién puede narrar: para elegirlo al convocar un ritual. */
  async listStorytellers(userId: string): Promise<Array<{ id: string; username: string }>> {
    await this.checkOrganizerPermission(userId);
    return (await this.userRepository.listAll())
      .filter((u) => u.roles.includes('narrador'))
      .map((u) => ({ id: u.id, username: u.username }))
      .sort((a, b) => a.username.localeCompare(b.username));
  }

  async getById(id: string): Promise<Ritual | undefined> {
    const ritual = await this.ritualRepository.findById(id);
    return ritual ? (await this.withAttendees([withVillacuervosUrl(ritual)]))[0] : undefined;
  }

  /**
   * Comprueba que se puede apuntar o desapuntar de esa partida (o de esa
   * repetición, en una serie) y devuelve la clave de la repetición.
   */
  private async signupTarget(id: string, rawOccurrence: unknown): Promise<{ ritual: Ritual; occurrence: string }> {
    const ritual = await this.getById(id);
    if (!ritual) {
      throw new Error('El ritual no existe.');
    }
    if (!ritual.signupsEnabled) {
      throw new Error(
        ritual.villacuervosPlayId
          ? 'A esta partida se apunta uno en Villacuervos.'
          : 'Solo se puede apuntar uno a las partidas online de La Secta.'
      );
    }
    if (ritual.status === 'cancelado') {
      throw new Error('La partida está cancelada.');
    }

    const series = !!(ritual.recurrenceDays || ritual.recurrenceMonths);
    let occurrence = '';
    let startsAt = new Date(ritual.startsAt);
    if (series) {
      const date = new Date(String(rawOccurrence ?? ''));
      if (isNaN(date.getTime())) {
        throw new Error('Indica a qué partida de la serie te apuntas.');
      }
      if (date < startsAt || (ritual.recurrenceUntil && date > new Date(ritual.recurrenceUntil))) {
        throw new Error('Esa fecha no pertenece a la serie.');
      }
      occurrence = date.toISOString();
      startsAt = date;
    }
    if (startsAt.getTime() <= Date.now()) {
      throw new Error('La partida ya ha empezado.');
    }
    return { ritual, occurrence };
  }

  /** Apunta a alguien a una partida. Las plazas no limitan: se apunta igual. */
  async signUp(userId: string, id: string, rawOccurrence: unknown): Promise<Ritual> {
    const { occurrence } = await this.signupTarget(id, rawOccurrence);
    if (!(await this.signupRepository.add(id, occurrence, userId))) {
      throw new Error('Ya estás apuntado a esta partida.');
    }
    return (await this.getById(id))!;
  }

  async leave(userId: string, id: string, rawOccurrence: unknown): Promise<Ritual> {
    const { occurrence } = await this.signupTarget(id, rawOccurrence);
    if (!(await this.signupRepository.remove(id, occurrence, userId))) {
      throw new Error('No estabas apuntado a esta partida.');
    }
    return (await this.getById(id))!;
  }

  /**
   * Convoca un ritual. Una partida online puede publicarse a la vez en
   * Villacuervos: se crea allí primero, y si Villacuervos la rechaza no se
   * guarda nada, para que no quede una mitad sin la otra.
   */
  async create(userId: string, raw: any): Promise<Ritual> {
    await this.checkOrganizerPermission(userId);
    const input = await this.validate(raw);

    let villacuervos: { playId: number; slug: string } | undefined;
    if (raw?.alsoInVillacuervos === true) {
      if (input.type !== 'partida_online') {
        throw new Error('Solo las partidas online se pueden crear también en Villacuervos.');
      }
      const play = await this.villacuervosService.createPlay(userId, {
        name: input.title,
        date: input.startsAt,
        text: input.description ?? null,
        link: input.link ?? null,
        in_person: false,
        public: true,
        lists: [{ name: 'Jugadores', order: 1, max_players: input.maxPlayers ?? null }]
      });
      villacuervos = { playId: play.id, slug: play.slug };
    }

    const id = crypto.randomUUID();
    await this.ritualRepository.create(id, userId, input, villacuervos);
    return (await this.getById(id))!;
  }

  async update(userId: string, id: string, raw: any): Promise<Ritual> {
    await this.checkOrganizerPermission(userId);
    if (!(await this.ritualRepository.findById(id))) {
      throw new Error('El ritual no existe.');
    }
    const input = await this.validate(raw);
    await this.ritualRepository.update(id, input);
    return (await this.getById(id))!;
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.checkOrganizerPermission(userId);
    if (!(await this.ritualRepository.findById(id))) {
      throw new Error('El ritual no existe.');
    }
    await this.ritualRepository.delete(id);
  }

  private async validate(raw: any): Promise<RitualInput> {
    const text = (value: unknown): string | null => {
      if (value === undefined || value === null) return null;
      const trimmed = String(value).trim();
      return trimmed ? trimmed : null;
    };

    const type = raw?.type;
    if (!RITUAL_TYPES.includes(type)) {
      throw new Error('El tipo de ritual no es válido.');
    }

    const title = text(raw.title);
    if (!title) {
      throw new Error('El ritual necesita un título.');
    }

    // Las partidas online que se convocan aquí son siempre de La Secta: las
    // de Villacuervos solo se leen de su API.
    const managedBy = type === 'partida_online' ? 'secta' : null;

    const startsAt = new Date(raw.startsAt);
    if (isNaN(startsAt.getTime())) {
      throw new Error('La fecha de convocatoria no es válida.');
    }

    // Solo las jornadas tienen fecha de fin; una partida es una convocatoria.
    let endsAt: string | null = null;
    if (type === 'jornada' && text(raw.endsAt)) {
      const end = new Date(raw.endsAt);
      if (isNaN(end.getTime())) {
        throw new Error('La fecha de fin no es válida.');
      }
      if (end < startsAt) {
        throw new Error('Las jornadas no pueden terminar antes de empezar.');
      }
      endsAt = end.toISOString();
    }

    // La periodicidad es cosa de las partidas presenciales: cada tantos días,
    // o cada tantos meses en el mismo día de la semana del mes.
    const given = (value: unknown) => value !== undefined && value !== null && value !== '';
    let recurrenceDays: number | null = null;
    let recurrenceMonths: number | null = null;
    let recurrenceUntil: string | null = null;
    if (type === 'partida_presencial' && given(raw.recurrenceDays) && given(raw.recurrenceMonths)) {
      throw new Error('Una partida se repite cada tantos días o cada tantos meses, no las dos cosas.');
    }
    if (type === 'partida_presencial' && given(raw.recurrenceDays)) {
      recurrenceDays = Number(raw.recurrenceDays);
      if (!Number.isInteger(recurrenceDays) || recurrenceDays < 1 || recurrenceDays > MAX_RECURRENCE_DAYS) {
        throw new Error(`La periodicidad debe ser un número de días entre 1 y ${MAX_RECURRENCE_DAYS}.`);
      }
    }
    if (type === 'partida_presencial' && given(raw.recurrenceMonths)) {
      recurrenceMonths = Number(raw.recurrenceMonths);
      if (!Number.isInteger(recurrenceMonths) || recurrenceMonths < 1 || recurrenceMonths > MAX_RECURRENCE_MONTHS) {
        throw new Error(`La periodicidad debe ser un número de meses entre 1 y ${MAX_RECURRENCE_MONTHS}.`);
      }
    }
    if (recurrenceDays || recurrenceMonths) {
      if (text(raw.recurrenceUntil)) {
        const until = new Date(raw.recurrenceUntil);
        if (isNaN(until.getTime())) {
          throw new Error('La fecha final de la repetición no es válida.');
        }
        if (until < startsAt) {
          throw new Error('La repetición no puede acabar antes de la primera partida.');
        }
        recurrenceUntil = until.toISOString();
      }
    }

    let maxPlayers: number | null = null;
    if (raw.maxPlayers !== undefined && raw.maxPlayers !== null && raw.maxPlayers !== '') {
      maxPlayers = Number(raw.maxPlayers);
      if (!Number.isInteger(maxPlayers) || maxPlayers < 1) {
        throw new Error('El número máximo de jugadores no es válido.');
      }
    }

    const storytellerId = text(raw.storytellerId);
    if (storytellerId && !(await this.userRepository.findById(storytellerId))) {
      throw new Error('El narrador indicado no existe.');
    }

    const status = raw.status ?? 'programado';
    if (!RITUAL_STATUSES.includes(status)) {
      throw new Error('El estado del ritual no es válido.');
    }

    return {
      type,
      managedBy,
      title,
      description: text(raw.description),
      startsAt: startsAt.toISOString(),
      endsAt,
      location: type === 'partida_online' ? null : text(raw.location),
      link: text(raw.link),
      scriptName: type === 'jornada' ? null : text(raw.scriptName),
      maxPlayers,
      storytellerId,
      recurrenceDays,
      recurrenceMonths,
      recurrenceUntil,
      status
    };
  }

  private async listVillacuervosPlays(from: string, to: string, own: Ritual[]): Promise<Ritual[]> {
    let plays;
    try {
      plays = await this.villacuervosService.getPendingPlays();
    } catch (error) {
      console.warn('[RITUALES] No se pudieron leer las partidas de Villacuervos:', (error as Error).message);
      return [];
    }

    // Una partida que se convocó aquí y se publicó también en Villacuervos no
    // se muestra dos veces: se queda la de aquí, con las listas de allí.
    const playsById = new Map(plays.map((play) => [play.id, play]));
    for (const ritual of own) {
      const play = ritual.villacuervosPlayId ? playsById.get(ritual.villacuervosPlayId) : undefined;
      if (play) ritual.signupLists = toSignupLists(play.lists);
    }
    const linked = new Set(own.map((r) => r.villacuervosPlayId).filter(Boolean));

    return plays
      .filter((play) => !linked.has(play.id))
      .map((play): Ritual | null => {
        const date = new Date(play.date);
        if (isNaN(date.getTime())) return null;
        const link = villacuervosPlayUrl(play.id, play.slug);
        return {
          id: `villacuervos-${play.id}`,
          type: play.in_person ? 'partida_presencial' : 'partida_online',
          managedBy: play.in_person ? undefined : 'villacuervos',
          title: play.name,
          startsAt: date.toISOString(),
          link,
          scriptName: play.script_name ?? undefined,
          // Las plazas van por lista (narración, jugadores...): sumarlas no dice nada.
          signupLists: toSignupLists(play.lists),
          status: 'programado',
          createdBy: 'villacuervos',
          createdAt: date.toISOString(),
          source: 'villacuervos'
        };
      })
      .filter((r): r is Ritual => !!r && r.startsAt >= from && r.startsAt < to);
  }
}
