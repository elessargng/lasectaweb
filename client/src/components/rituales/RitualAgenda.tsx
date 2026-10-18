import { MapPin, ScrollText, Users } from 'lucide-react';
import type { Ritual } from '../../utils/ritualsApi';
import { RITUAL_KINDS, kindOf } from './ritualKinds';
import { compactPlaces } from './ritualSignups';
import { addDays, compareRituals, dayKey, formatShortDate, formatSpokenDate, formatTime, isMultiDay, isSameDay, keyOf, startOfDay } from './ritualDates';

interface RitualAgendaProps {
  month: Date;
  rituals: Ritual[];
  selectedDay: Date;
  focusedKey: string | null;
  onSelectRitual: (day: Date, ritual: Ritual) => void;
}

/**
 * Los rituales de un mes en una línea de tiempo, agrupados por día. Cada
 * jornada aparece en todos los días del mes que ocupa.
 */
export const RitualAgenda = ({ month, rituals, selectedDay, focusedKey, onSelectRitual }: RitualAgendaProps) => {
  const today = new Date();
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0);

  const groups = new Map<string, { day: Date; items: Ritual[] }>();
  for (const r of rituals) {
    const start = startOfDay(new Date(r.startsAt));
    const end = startOfDay(new Date(r.endsAt ?? r.startsAt));
    for (let day = start < firstDay ? firstDay : start; day <= end && day <= lastDay; day = addDays(day, 1)) {
      const key = dayKey(day);
      if (!groups.has(key)) groups.set(key, { day, items: [] });
      groups.get(key)!.items.push(r);
    }
  }
  const days = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, g]) => g);

  if (days.length === 0) {
    return (
      <p className="text-center py-12 text-on-surface-muted italic font-body border border-dashed border-outline-ghost/70">
        No hay rituales convocados este mes.
      </p>
    );
  }

  return (
    <ol className="relative border-l border-theme-main/30 ml-6 md:ml-7">
      {days.map(({ day, items }) => {
        const isToday = isSameDay(day, today);
        const isSelected = isSameDay(day, selectedDay);
        return (
          <li key={dayKey(day)} className="relative pl-9 md:pl-10 pb-6 last:pb-0">
            <div
              className={`absolute -left-6 md:-left-7 top-0 w-12 md:w-14 flex flex-col items-center py-1.5 border rounded-sm transition-colors bg-[radial-gradient(circle_at_50%_30%,#1f2538,#0d0f17)] ${
                isToday
                  ? 'border-theme-main shadow-[0_0_16px_rgba(212,175,106,0.35)]'
                  : isSelected
                    ? 'border-theme-main/80'
                    : 'border-theme-main/30'
              }`}
            >
              <span className="font-ui text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-theme-main/90">
                {day.toLocaleDateString('es-ES', { weekday: 'short' })}
              </span>
              <span className={`font-display text-xl leading-none ${isToday ? 'text-gilded' : 'text-on-surface'}`}>{day.getDate()}</span>
              {isToday && <span className="font-ui text-[0.5rem] font-semibold uppercase tracking-[0.2em] text-theme-main mt-0.5">hoy</span>}
            </div>

            <div className="flex flex-col gap-1.5 pt-0.5">
              {items.sort(compareRituals).map((r) => (
                <AgendaRow
                  key={keyOf(r)}
                  ritual={r}
                  focused={isSelected && focusedKey === keyOf(r)}
                  onClick={() => onSelectRitual(day, r)}
                />
              ))}
            </div>
          </li>
        );
      })}
    </ol>
  );
};

interface AgendaRowProps {
  ritual: Ritual;
  focused: boolean;
  onClick: () => void;
}

/** Una línea por ritual: lo justo para reconocerlo; el detalle va al lado. */
const AgendaRow = ({ ritual, focused, onClick }: AgendaRowProps) => {
  const style = RITUAL_KINDS[kindOf(ritual)];
  const Icon = style.icon;
  const cancelled = ritual.status === 'cancelado';
  const places = compactPlaces(ritual);
  const when = isMultiDay(ritual) ? `${formatShortDate(ritual.startsAt)} – ${formatShortDate(ritual.endsAt!)}` : formatTime(ritual.startsAt);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left flex items-center gap-3 px-3 py-2.5 border rounded-sm transition-all cursor-pointer ${
        focused
          ? 'border-theme-main/80 bg-theme-main/[0.06] shadow-[0_0_18px_rgba(212,175,106,0.15)]'
          : 'border-outline-ghost/80 bg-background/50 hover:border-theme-main/50 hover:bg-surface-container/60'
      } ${cancelled ? 'opacity-50' : ''}`}
      style={{ boxShadow: `inset 2px 0 0 ${style.color}` }}
    >
      <Icon className="w-4 h-4 shrink-0" style={{ color: style.color }} />
      <span className="w-20 md:w-24 shrink-0 text-xs font-semibold tabular-nums" style={{ color: style.color }}>
        {!isMultiDay(ritual) && <span className="sr-only">{formatSpokenDate(ritual.startsAt)}, </span>}
        {when}
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block truncate text-on-surface ${cancelled ? 'line-through' : ''}`}>{ritual.title}</span>
        {(ritual.scriptName || ritual.location || places) && (
          <span className="flex flex-wrap gap-x-3 text-xs text-on-surface-muted [&_svg]:text-theme-main/70">
            {ritual.scriptName && (
              <span className="inline-flex items-center gap-1 truncate">
                <ScrollText className="w-3 h-3 shrink-0" /> {ritual.scriptName}
              </span>
            )}
            {ritual.location && (
              <span className="inline-flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3 shrink-0" /> {ritual.location}
              </span>
            )}
            {places && (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Users className="w-3 h-3 shrink-0" /> {places}
              </span>
            )}
          </span>
        )}
      </span>
    </button>
  );
};

export default RitualAgenda;
