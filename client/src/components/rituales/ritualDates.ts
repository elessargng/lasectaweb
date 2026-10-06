import type { Ritual } from '../../utils/ritualsApi';

export const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Clave local AAAA-MM-DD, para agrupar y para la URL. */
export function dayKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

export function parseDayKey(key: string | null): Date | null {
  const match = key?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return isNaN(date.getTime()) ? null : date;
}

/** Las seis semanas que muestra la cuadrícula de un mes, empezando en lunes. */
export function monthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = addDays(first, -offset);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** Un ritual ocupa un día si empieza, sigue o termina en él. */
export function coversDay(ritual: Ritual, day: Date): boolean {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = addDays(startOfDay(day), 1).getTime();
  const start = new Date(ritual.startsAt).getTime();
  const end = new Date(ritual.endsAt ?? ritual.startsAt).getTime();
  return start < dayEnd && end >= dayStart;
}

export function isMultiDay(ritual: Ritual): boolean {
  return !!ritual.endsAt && !isSameDay(new Date(ritual.startsAt), new Date(ritual.endsAt));
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

export function formatLongDay(date: Date): string {
  return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

/** Valor para un input date, en hora local. */
export function toLocalDateInput(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  return isNaN(date.getTime()) ? '' : dayKey(date);
}

/** Valor para un input datetime-local, en hora local. */
export function toLocalInput(iso?: string | Date | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  return `${dayKey(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * Despliega las series periódicas en sus repeticiones dentro de [from, to).
 * Se hace aquí y no en el servidor para sumar los días en hora local: así una
 * partida de las 19:00 sigue a las 19:00 al cambiar de horario de verano.
 */
export function expandOccurrences(rituals: Ritual[], from: Date, to: Date): Ritual[] {
  const result: Ritual[] = [];
  for (const r of rituals) {
    const step = r.recurrenceDays ?? r.recurrenceMonths;
    if (!step) {
      result.push({ ...r, occurrenceKey: r.id, attendees: r.attendees?.filter((a) => !a.occurrence) });
      continue;
    }
    const start = new Date(r.startsAt);
    const until = r.recurrenceUntil ? new Date(r.recurrenceUntil) : null;
    const nth = r.recurrenceDays ? (n: number) => addDays(start, n * step) : (n: number) => addMonthsSameWeekday(start, n * step);
    // Saltar directamente a las repeticiones cercanas al intervalo.
    const elapsed = r.recurrenceDays
      ? (from.getTime() - start.getTime()) / (step * 86400000)
      : ((from.getFullYear() - start.getFullYear()) * 12 + from.getMonth() - start.getMonth()) / step;
    for (let n = Math.max(0, Math.floor(elapsed) - 1); ; n++) {
      const occurrence = nth(n);
      if (occurrence >= to || (until && occurrence > until)) break;
      if (occurrence < from) continue;
      const iso = occurrence.toISOString();
      result.push({
        ...r,
        startsAt: iso,
        seriesStartsAt: r.startsAt,
        occurrenceKey: `${r.id}@${iso}`,
        attendees: r.attendees?.filter((a) => a.occurrence === iso)
      });
    }
  }
  return result.sort(compareRituals);
}

const ORDINALS = ['primer', 'segundo', 'tercer', 'cuarto'];

/**
 * Posición de un día dentro de su mes: qué día de la semana es y cuántas veces
 * ha salido ya ese día en el mes. El quinto se toma como "el último", porque
 * no todos los meses lo tienen.
 */
export function monthlyPosition(date: Date): { weekday: number; nth: number | 'ultimo' } {
  const nth = Math.ceil(date.getDate() / 7);
  return { weekday: date.getDay(), nth: nth === 5 ? 'ultimo' : nth };
}

/**
 * El mismo día de la semana, en la misma posición del mes, tantos meses
 * después: del segundo jueves de octubre, el segundo jueves de noviembre,
 * tenga el mes 28, 30 o 31 días. Conserva la hora.
 */
export function addMonthsSameWeekday(date: Date, months: number): Date {
  const { weekday, nth } = monthlyPosition(date);
  const year = date.getFullYear();
  const month = date.getMonth() + months;
  let day: Date;
  if (nth === 'ultimo') {
    day = new Date(year, month + 1, 0);
    day.setDate(day.getDate() - ((day.getDay() - weekday + 7) % 7));
  } else {
    day = new Date(year, month, 1);
    day.setDate(1 + ((weekday - day.getDay() + 7) % 7) + (nth - 1) * 7);
  }
  day.setHours(date.getHours(), date.getMinutes(), date.getSeconds(), 0);
  return day;
}

/** "el segundo jueves", "el último sábado"... */
export function describeMonthlyPosition(date: Date): string {
  const { nth } = monthlyPosition(date);
  const weekday = date.toLocaleDateString('es-ES', { weekday: 'long' });
  return `el ${nth === 'ultimo' ? 'último' : ORDINALS[nth - 1]} ${weekday}`;
}

/** Texto de la periodicidad de una serie, o null si no se repite. */
export function describeRecurrence(ritual: Ritual): string | null {
  let text: string;
  if (ritual.recurrenceDays) {
    text = `Cada ${ritual.recurrenceDays} días`;
  } else if (ritual.recurrenceMonths) {
    const every = ritual.recurrenceMonths === 1 ? 'Cada mes' : `Cada ${ritual.recurrenceMonths} meses`;
    text = `${every}, ${describeMonthlyPosition(new Date(ritual.seriesStartsAt ?? ritual.startsAt))}`;
  } else {
    return null;
  }
  return ritual.recurrenceUntil ? `${text}, hasta el ${formatShortDate(ritual.recurrenceUntil)}` : text;
}

/**
 * Orden dentro de un día: primero las jornadas de varios días, por orden de
 * comienzo, y después el resto por hora. Así las cintas de las jornadas no
 * cambian de altura de una casilla a otra.
 */
export function compareRituals(a: Ritual, b: Ritual): number {
  const multiA = isMultiDay(a);
  const multiB = isMultiDay(b);
  if (multiA !== multiB) return multiA ? -1 : 1;
  return a.startsAt.localeCompare(b.startsAt) || a.createdAt.localeCompare(b.createdAt);
}

/** Lunes de la semana de un día. */
export function startOfWeek(date: Date): Date {
  return addDays(startOfDay(date), -((date.getDay() + 6) % 7));
}

/** Clave única de un ritual o de una repetición de una serie. */
export const keyOf = (r: Ritual) => r.occurrenceKey ?? r.id;

/**
 * Reparte las jornadas de varios días de una semana en carriles: cada una
 * conserva su altura todos los días que dura, y la que empezó antes va arriba.
 * Devuelve, para cada día de la semana, qué jornada ocupa cada carril (o
 * nada, para dejar el hueco y que las de debajo no suban).
 */
export function weekLanes(week: Date[], rituals: Ritual[]): Array<Array<Ritual | null>> {
  const bands = rituals.filter((r) => isMultiDay(r) && week.some((d) => coversDay(r, d))).sort(compareRituals);
  const laneEnds: number[] = [];
  const laneOf = new Map<string, number>();

  for (const band of bands) {
    const first = week.findIndex((d) => coversDay(band, d));
    const last = week.length - 1 - [...week].reverse().findIndex((d) => coversDay(band, d));
    let lane = laneEnds.findIndex((end) => end < first);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = last;
    laneOf.set(keyOf(band), lane);
  }

  return week.map((day) => {
    const slots: Array<Ritual | null> = Array(laneEnds.length).fill(null);
    for (const band of bands) {
      if (coversDay(band, day)) slots[laneOf.get(keyOf(band))!] = band;
    }
    // Los huecos al final no hacen falta: no hay nada debajo que sostener.
    while (slots.length && slots[slots.length - 1] === null) slots.pop();
    return slots;
  });
}
