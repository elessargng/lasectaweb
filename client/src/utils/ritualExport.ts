import type { Ritual } from './ritualsApi';
import { RITUAL_KINDS, kindOf } from '../components/rituales/ritualKinds';
import { renderAgenda } from './agendaImage';

/**
 * Exportación de la agenda. Se exporta exactamente lo que se ve: los rituales
 * del mes ya filtrados por clase, con cada repetición de una serie como un
 * evento propio.
 */

export type ImageTemplate = 'defecto' | 'instagram' | 'tiktok';

export const IMAGE_TEMPLATES: Array<{ id: ImageTemplate; label: string; hint: string }> = [
  { id: 'defecto', label: 'Por defecto', hint: 'La Agenda Sectaria: el mes en el pergamino' },
  { id: 'instagram', label: 'Instagram', hint: 'Vertical 4:5 (1080 × 1350), para publicación' },
  { id: 'tiktok', label: 'TikTok', hint: 'Vertical 9:16 (1080 × 1920)' }
];

/** Duración que se da a una partida en el calendario, que solo tiene hora de convocatoria. */
const DEFAULT_GAME_HOURS = 3;

const PRODID = '-//La Secta//Rituales//ES';

function monthSlug(month: Date): string {
  return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
}

function download(content: BlobPart, type: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Cada repetición solo una vez, aunque una jornada aparezca en varios días. */
function unique(rituals: Ritual[]): Ritual[] {
  const seen = new Set<string>();
  return rituals
    .filter((r) => {
      const key = r.occurrenceKey ?? r.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

function endOf(ritual: Ritual): Date {
  if (ritual.endsAt) return new Date(ritual.endsAt);
  return new Date(new Date(ritual.startsAt).getTime() + DEFAULT_GAME_HOURS * 3600000);
}

// ---------------------------------------------------------------- ICS

/** Fecha en UTC con el formato de iCalendar: 20261015T180000Z. */
function icsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Escapa un texto según RFC 5545. */
function icsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Las líneas de un .ics no deben pasar de 75 octetos: se pliegan con un espacio. */
function fold(line: string): string {
  const bytes = new TextEncoder();
  if (bytes.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  for (const char of line) {
    const limit = parts.length === 0 ? 75 : 74;
    if (bytes.encode(current + char).length > limit) {
      parts.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.join('\r\n ');
}

function describe(ritual: Ritual): string {
  const lines = [RITUAL_KINDS[kindOf(ritual)].label];
  if (ritual.scriptName) lines.push(`Guion: ${ritual.scriptName}`);
  if (ritual.storytellerUsername) lines.push(`Narra: ${ritual.storytellerUsername}`);
  if (ritual.signupLists?.length) {
    for (const l of ritual.signupLists) {
      lines.push(`${l.name}: ${l.playerCount}${l.maxPlayers !== undefined ? `/${l.maxPlayers}` : ''} inscritos`);
    }
  } else if (ritual.maxPlayers) {
    lines.push(`Plazas: ${ritual.maxPlayers}`);
  }
  if (ritual.signupsEnabled) lines.push(`Apuntados: ${ritual.attendees?.length ?? 0}`);
  if (ritual.link) lines.push(`Enlace: ${ritual.link}`);
  if (ritual.villacuervosUrl) lines.push(`Villacuervos: ${ritual.villacuervosUrl}`);
  if (ritual.description) lines.push('', ritual.description);
  return lines.join('\n');
}

export function buildIcs(rituals: Ritual[], month: Date): string {
  const stamp = icsDate(new Date());
  const monthName = month.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsText(`Rituales de La Secta · ${monthName}`)}`
  ];

  for (const r of unique(rituals)) {
    const url = r.link ?? r.villacuervosUrl;
    lines.push(
      'BEGIN:VEVENT',
      // Estable entre exportaciones: al volver a importar se actualiza en lugar de duplicarse.
      `UID:${(r.occurrenceKey ?? r.id).replace(/[^\w@.-]/g, '-')}@lasecta`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(new Date(r.startsAt))}`,
      `DTEND:${icsDate(endOf(r))}`,
      `SUMMARY:${icsText(r.title)}`,
      `DESCRIPTION:${icsText(describe(r))}`,
      `CATEGORIES:${icsText(RITUAL_KINDS[kindOf(r)].shortLabel)}`,
      `STATUS:${r.status === 'cancelado' ? 'CANCELLED' : 'CONFIRMED'}`
    );
    if (r.location) lines.push(`LOCATION:${icsText(r.location)}`);
    if (url) lines.push(`URL:${url}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function exportIcs(rituals: Ritual[], month: Date): void {
  download(buildIcs(rituals, month), 'text/calendar;charset=utf-8', `rituales-la-secta-${monthSlug(month)}.ics`);
}

// ---------------------------------------------------------------- JSON

export function buildJson(rituals: Ritual[], month: Date, kinds: string[]): string {
  return JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      month: monthSlug(month),
      kinds,
      rituals: unique(rituals).map((r) => ({
        id: r.id,
        // En una serie, cada repetición tiene su fecha y comparte el id de la serie.
        occurrenceOf: r.seriesStartsAt ? r.id : undefined,
        kind: kindOf(r),
        kindLabel: RITUAL_KINDS[kindOf(r)].label,
        type: r.type,
        managedBy: r.managedBy,
        source: r.source,
        status: r.status,
        title: r.title,
        description: r.description,
        startsAt: r.startsAt,
        endsAt: r.endsAt,
        location: r.location,
        link: r.link,
        villacuervosUrl: r.villacuervosUrl,
        scriptName: r.scriptName,
        maxPlayers: r.maxPlayers,
        signupLists: r.signupLists,
        attendees: r.signupsEnabled ? (r.attendees ?? []).map((a) => a.username) : undefined,
        storyteller: r.storytellerUsername,
        recurrenceDays: r.recurrenceDays,
        recurrenceMonths: r.recurrenceMonths
      }))
    },
    null,
    2
  );
}

export function exportJson(rituals: Ritual[], month: Date, kinds: string[]): void {
  download(buildJson(rituals, month, kinds), 'application/json;charset=utf-8', `rituales-la-secta-${monthSlug(month)}.json`);
}

// ---------------------------------------------------------------- Imagen

export interface ImageExportRequest {
  rituals: Ritual[];
  month: Date;
  template: ImageTemplate;
}

/** Dibuja la agenda con una plantilla y devuelve la imagen ya en JPG. */
export type ImageRenderer = (request: ImageExportRequest) => Promise<Blob>;

/**
 * Un renderizador por plantilla. Mientras una plantilla no tenga el suyo,
 * exportar con ella no hace nada.
 */
const IMAGE_RENDERERS: Record<ImageTemplate, ImageRenderer | null> = {
  defecto: renderAgenda,
  instagram: renderAgenda,
  tiktok: renderAgenda
};

export function isImageExportAvailable(template: ImageTemplate): boolean {
  return IMAGE_RENDERERS[template] !== null;
}

export async function exportImage(rituals: Ritual[], month: Date, template: ImageTemplate): Promise<void> {
  const render = IMAGE_RENDERERS[template];
  if (!render) return;
  const image = await render({ rituals: unique(rituals), month, template });
  download(image, 'image/jpeg', `rituales-la-secta-${monthSlug(month)}-${template}.jpg`);
}
