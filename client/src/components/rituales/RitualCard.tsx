import { Ban, Clock, MapPin, Repeat, ScrollText, Users } from 'lucide-react';
import type { Ritual } from '../../utils/ritualsApi';
import { RITUAL_KINDS, alpha, kindOf } from './ritualKinds';
import { formatShortDate, formatTime, isMultiDay } from './ritualDates';
import { attendanceSummary, isIntention } from './ritualSignups';

interface RitualCardProps {
  ritual: Ritual;
  /** El que se acaba de pulsar en el calendario: se resalta. */
  highlighted?: boolean;
  /** Quien mira, para avisar de si ya va. */
  userId?: string;
  /** Abre el detalle completo del ritual. */
  onOpen: (ritual: Ritual) => void;
}

/**
 * Un ritual en el lateral del calendario, en resumen: lo justo para ubicarlo y
 * saber cuánta gente va. Toda la tarjeta abre el detalle, donde está el resto.
 */
export const RitualCard = ({ ritual, highlighted = false, userId, onOpen }: RitualCardProps) => {
  const style = RITUAL_KINDS[kindOf(ritual)];
  const Icon = style.icon;
  const cancelled = ritual.status === 'cancelado';
  const summaryId = `ritual-resumen-${ritual.occurrenceKey ?? ritual.id}`;

  const when = isMultiDay(ritual)
    ? `${formatShortDate(ritual.startsAt)} – ${formatShortDate(ritual.endsAt!)}`
    : ritual.endsAt
      ? `${formatTime(ritual.startsAt)} – ${formatTime(ritual.endsAt)}`
      : formatTime(ritual.startsAt);
  const attendance = attendanceSummary(ritual, userId);
  // Las plazas solo van aparte cuando el resumen de asistencia no las incluye.
  const places = ritual.maxPlayers && (!ritual.signupsEnabled || isIntention(ritual)) && !ritual.signupLists?.length;

  return (
    <article
      id={`ritual-${ritual.occurrenceKey ?? ritual.id}`}
      className={`group relative flex gap-3 p-3.5 border rounded-sm transition-all duration-300 motion-reduce:transition-none scroll-mt-32 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent)] focus-within:ring-1 focus-within:ring-theme-main ${
        highlighted
          ? 'border-theme-main/80 bg-theme-main/[0.06] shadow-[0_0_22px_rgba(212,175,106,0.18)]'
          : 'border-outline-ghost hover:border-theme-main/50 hover:bg-surface-container/60'
      } ${cancelled ? 'opacity-60' : ''}`}
    >
      {/* Filo del color del tipo, a la izquierda */}
      <span aria-hidden="true" className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full" style={{ backgroundColor: style.color }} />

      <span className="medallon w-10 h-10">
        <Icon className="w-4 h-4" style={{ color: style.color }} />
      </span>

      <div className="flex-1 min-w-0">
        <p className="font-ui text-[0.6rem] font-semibold uppercase tracking-[0.2em]" style={{ color: alpha(style.color, 0.95) }}>
          {style.shortLabel}
        </p>
        <h4 className={`font-body text-[1.05rem] leading-snug text-on-surface group-hover:text-gold-bright transition-colors ${cancelled ? 'line-through' : ''}`}>
          {/* El botón ocupa toda la tarjeta con su ::after; el lector solo lee el título y, luego, el resumen */}
          <button
            type="button"
            onClick={() => onOpen(ritual)}
            aria-haspopup="dialog"
            aria-describedby={summaryId}
            className="text-left focus:outline-none after:absolute after:inset-0 after:content-['']"
          >
            {ritual.title}
          </button>
        </h4>

        <ul id={summaryId} className="mt-2 flex flex-col gap-1 text-[13px] text-on-surface-muted [&_svg]:text-theme-main/70">
          {cancelled && (
            <li className="inline-flex items-center gap-1.5 text-blood-bright">
              <Ban className="w-3.5 h-3.5 shrink-0" /> Cancelado
            </li>
          )}
          <li className="inline-flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 shrink-0" /> {when}
            {(ritual.recurrenceDays || ritual.recurrenceMonths) && (
              <>
                <Repeat className="w-3.5 h-3.5 shrink-0 ml-1" />
                <span className="sr-only">, se repite</span>
              </>
            )}
          </li>
          {ritual.location && (
            <li className="inline-flex items-center gap-1.5 min-w-0">
              <MapPin className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{ritual.location}</span>
            </li>
          )}
          {ritual.scriptName && (
            <li className="inline-flex items-center gap-1.5 min-w-0">
              <ScrollText className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{ritual.scriptName}</span>
            </li>
          )}
          {(attendance || places) && (
            <li className="inline-flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>
                {attendance}
                {attendance && places ? ' · ' : ''}
                {places ? `${ritual.maxPlayers} plazas` : ''}
              </span>
            </li>
          )}
        </ul>
      </div>
    </article>
  );
};

export default RitualCard;
