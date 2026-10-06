import type { Ritual } from './ritualsApi';
import type { ImageExportRequest, ImageTemplate } from './ritualExport';

/**
 * Exportación como imagen: la Agenda Sectaria. El fondo (título, logo, velas,
 * cuervo y pergamino en blanco) es fijo; aquí solo se escribe en el pergamino
 * el mes y sus rituales, como en el cartel original: una línea por fecha,
 * centrada y con la misma inclinación que el pergamino.
 *
 * Las tres plantillas comparten el texto y cambian el fondo: el cartel tal cual,
 * recortado a 4:5 para Instagram o prolongado a 9:16 para TikTok. Cada fondo
 * dice dónde quedó el cartel original dentro de él (escala y desplazamiento),
 * y el texto se escribe con las medidas del original sobre esa transformación.
 */
const BACKGROUNDS: Record<ImageTemplate, { src: string; scale: number; offsetY: number }> = {
  // 956 × 1280, el cartel original.
  defecto: { src: '/exportar/agenda-defecto.jpg', scale: 1, offsetY: 0 },
  // 1080 × 1350 (4:5): el cartel a 1080 de ancho, sin 28 px de arriba ni el pie.
  instagram: { src: '/exportar/agenda-instagram.jpg', scale: 1080 / 956, offsetY: -28 },
  // 1080 × 1920 (9:16): el cartel a 1080 de ancho, centrado, con el fondo prolongado arriba y abajo.
  tiktok: { src: '/exportar/agenda-tiktok.jpg', scale: 1080 / 956, offsetY: 237 }
};

/**
 * Geometría del texto en el cartel original (956 × 1280), medida sobre él. Cada línea va girada como el pergamino, y el centro de cada una se
 * desplaza a la derecha según baja, porque el pergamino se ensancha hacia
 * abajo a la derecha.
 */
const PARCHMENT = {
  /** Línea base y centro del nombre del mes. */
  titleX: 522,
  titleY: 682,
  titleSize: 46,
  /** Línea base de la primera entrada y última línea base posible (encima del adorno). */
  firstLineY: 728,
  lastLineY: 1085,
  /** Cuánto se desplaza el centro a la derecha por cada píxel que baja. */
  drift: 0.24,
  /** El texto sube hacia la derecha. */
  angle: (-4.6 * Math.PI) / 180,
  maxWidth: 540
};

/** Como en el cartel; donde no haya Times, Crimson Text, que carga la web. */
const FONT_FAMILY = '"Times New Roman", Times, "Crimson Text", serif';
const INK = '#1f120c';
const MAX_FONT = 28;
const MIN_FONT = 16;
/** Interlineado del cartel: 32 px con letra de 25. */
const LINE_SPACING = 1.28;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar el fondo de la plantilla.'));
    img.src = src;
  });
}

const two = (n: number) => String(n).padStart(2, '0');

/** "2/09", "Del 17 al 20 / 09" o "Del 30/09 al 2/10", como en el cartel. */
export function agendaDateLabel(ritual: Ritual): string {
  const start = new Date(ritual.startsAt);
  const end = ritual.endsAt ? new Date(ritual.endsAt) : start;
  if (start.toDateString() === end.toDateString()) return `${start.getDate()}/${two(start.getMonth() + 1)}`;
  if (start.getMonth() === end.getMonth()) return `Del ${start.getDate()} al ${end.getDate()} / ${two(end.getMonth() + 1)}`;
  return `Del ${start.getDate()}/${two(start.getMonth() + 1)} al ${end.getDate()}/${two(end.getMonth() + 1)}`;
}

/** "Japan Weekend (Madrid)"; las partidas online, sin lugar, van como "(online)". */
function agendaPlace(ritual: Ritual): string {
  if (ritual.location) return `${ritual.title} (${ritual.location})`;
  if (ritual.type === 'partida_online') return `${ritual.title} (online)`;
  return ritual.title;
}

/**
 * Las entradas del cartel: una por fecha, con los rituales de esa fecha unidos
 * con "y". Los cancelados no se anuncian.
 */
export function agendaEntries(rituals: Ritual[]): string[] {
  const groups = new Map<string, { start: string; places: string[] }>();
  const sorted = rituals.filter((r) => r.status !== 'cancelado').sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  for (const r of sorted) {
    const label = agendaDateLabel(r);
    if (!groups.has(label)) groups.set(label, { start: r.startsAt, places: [] });
    groups.get(label)!.places.push(agendaPlace(r));
  }
  return [...groups.entries()]
    .sort(([, a], [, b]) => a.start.localeCompare(b.start))
    .map(([label, { places }]) => `${label} - ${places.join(JOIN)}`);
}

/** Une los rituales de una misma fecha; también es por donde se prefiere partir la línea. */
const JOIN = ' y ';

/**
 * Parte una entrada en líneas. Si no cabe, se parte primero detrás de cada
 * "y", como en el cartel ("Japan Weekend (Madrid) y" / "Partida en San
 * Quirze..."), y solo si aun así no cabe, por palabras.
 */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (ctx.measureText(text).width <= maxWidth) return [text];
  const parts = text.split(JOIN).map((part, i, all) => (i < all.length - 1 ? `${part} y` : part));
  if (parts.length === 1) return wrapWords(ctx, text, maxWidth);

  // Se juntan en cada línea tantos rituales como quepan, partiendo solo detrás de una "y".
  const lines: string[] = [];
  let line = '';
  for (const part of parts) {
    const candidate = line ? `${line} ${part}` : part;
    if (ctx.measureText(candidate).width <= maxWidth) line = candidate;
    else {
      if (line) lines.push(line);
      line = part;
    }
  }
  if (line) lines.push(line);
  return lines.flatMap((l) => wrapWords(ctx, l, maxWidth));
}

function wrapWords(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Reparte las entradas al mayor tamaño que quepa; si ni al mínimo caben, se recortan. */
function layout(ctx: CanvasRenderingContext2D, entries: string[]): { lineHeight: number; lines: string[] } {
  const available = PARCHMENT.lastLineY - PARCHMENT.firstLineY;
  for (let size = MAX_FONT; size >= MIN_FONT; size--) {
    ctx.font = `${size}px ${FONT_FAMILY}`;
    const lineHeight = Math.round(size * LINE_SPACING);
    const lines = entries.flatMap((e) => wrap(ctx, e, PARCHMENT.maxWidth));
    if ((lines.length - 1) * lineHeight <= available) return { lineHeight, lines };
  }

  // Ni al tamaño mínimo caben: se cortan las últimas entradas y se avisa.
  ctx.font = `${MIN_FONT}px ${FONT_FAMILY}`;
  const lineHeight = Math.round(MIN_FONT * LINE_SPACING);
  const room = Math.floor(available / lineHeight);
  const lines: string[] = [];
  let shown = 0;
  for (const e of entries) {
    const wrapped = wrap(ctx, e, PARCHMENT.maxWidth);
    if (lines.length + wrapped.length > room) break;
    lines.push(...wrapped);
    shown++;
  }
  lines.push(`… y ${entries.length - shown} más`);
  return { lineHeight, lines };
}

export async function renderAgenda({ rituals, month, template }: ImageExportRequest): Promise<Blob> {
  const frame = BACKGROUNDS[template];
  const [background] = await Promise.all([
    loadImage(frame.src),
    document.fonts.load(`${MAX_FONT}px ${FONT_FAMILY}`),
    document.fonts.load(`${PARCHMENT.titleSize}px ${FONT_FAMILY}`)
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = background.naturalWidth;
  canvas.height = background.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(background, 0, 0);

  // A partir de aquí se trabaja en las coordenadas del cartel original.
  ctx.setTransform(frame.scale, 0, 0, frame.scale, 0, frame.offsetY);

  // Tinta: se multiplica con el pergamino para que coja su textura.
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  /** Escribe una línea con su línea base en y, centrada donde le toca y girada como el pergamino. */
  const write = (text: string, y: number) => {
    ctx.save();
    ctx.translate(PARCHMENT.titleX + (y - PARCHMENT.titleY) * PARCHMENT.drift, y);
    ctx.rotate(PARCHMENT.angle);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };

  ctx.font = `${PARCHMENT.titleSize}px ${FONT_FAMILY}`;
  write(month.toLocaleDateString('es-ES', { month: 'long' }).toUpperCase(), PARCHMENT.titleY);

  const entries = agendaEntries(rituals);
  const { lineHeight, lines } = layout(ctx, entries.length ? entries : ['Sin rituales convocados este mes']);
  lines.forEach((line, i) => write(line, PARCHMENT.firstLineY + i * lineHeight));

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar la imagen.'))), 'image/jpeg', 0.92)
  );
}
