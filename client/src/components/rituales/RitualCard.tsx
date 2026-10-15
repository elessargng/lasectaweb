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
      className={`relative flex gap-3 p-3 border bg-surface-container-low/70 transition-all duration-300 scroll-mt-32 hover:bg-surface-container focus-within:ring-1 focus-within:ring-theme-main ${cancelled ? 'opacity-60' : ''}`}
      style={{
        borderColor: alpha(style.color, highlighted ? 0.9 : 0.3),
        boxShadow: highlighted
          ? `inset 3px 0 0 ${style.color}, 0 0 22px ${alpha(style.color, 0.3)}`
          : `inset 3px 0 0 ${style.color}`
      }}
    >
      <div
        className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
        style={{
          background: `radial-gradient(circle at 35% 30%, ${alpha(style.color, 0.45)}, ${alpha(style.color, 0.12)} 70%)`,
          border: `1px solid ${alpha(style.color, 0.6)}`
        }}
      >
        <Icon className="w-4 h-4" style={{ color: style.color }} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-display uppercase tracking-[0.18em]" style={{ color: style.color }}>
          {style.shortLabel}
        </p>
        <h4 className={`font-body text-base leading-snug text-on-surface ${cancelled ? 'line-through' : ''}`}>
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

        <ul id={summaryId} className="mt-1.5 flex flex-col gap-0.5 text-[13px] text-on-surface-muted">
          {cancelled && (
            <li className="inline-flex items-center gap-1.5 text-red-300">
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
