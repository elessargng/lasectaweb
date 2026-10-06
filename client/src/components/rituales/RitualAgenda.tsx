import { MapPin, ScrollText, Users } from 'lucide-react';
import type { Ritual } from '../../utils/ritualsApi';
import { RITUAL_KINDS, alpha, kindOf } from './ritualKinds';
import { compactPlaces } from './ritualSignups';
import { addDays, compareRituals, dayKey, formatShortDate, formatTime, isMultiDay, isSameDay, keyOf, startOfDay } from './ritualDates';

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
    <ol className="relative border-l border-theme-main/25 ml-6 md:ml-7">
      {days.map(({ day, items }) => {
        const isToday = isSameDay(day, today);
        const isSelected = isSameDay(day, selectedDay);
        return (
          <li key={dayKey(day)} className="relative pl-9 md:pl-10 pb-6 last:pb-0">
            <div
              className={`absolute -left-6 md:-left-7 top-0 w-12 md:w-14 flex flex-col items-center py-1 border transition-colors ${
                isToday
                  ? 'bg-theme-container/60 border-theme-main shadow-[0_0_14px_rgba(177,156,217,0.35)]'
                  : isSelected
                    ? 'bg-surface border-theme-main/80'
                    : 'bg-surface border-theme-main/30'
              }`}
            >
              <span className="text-[9px] font-display uppercase tracking-widest text-theme-main">
                {day.toLocaleDateString('es-ES', { weekday: 'short' })}
              </span>
              <span className="font-display text-xl text-on-surface leading-none">{day.getDate()}</span>
              {isToday && <span className="text-[8px] uppercase tracking-wider text-theme-main mt-0.5">hoy</span>}
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
      className={`w-full text-left flex items-center gap-3 px-3 py-2 border transition-all hover:brightness-125 focus:outline-none focus-visible:ring-1 focus-visible:ring-theme-main ${
        cancelled ? 'opacity-50' : ''
      }`}
      style={{
        backgroundColor: alpha(style.color, focused ? 0.16 : 0.07),
        borderColor: alpha(style.color, focused ? 0.8 : 0.2),
        boxShadow: `inset 2px 0 0 ${style.color}${focused ? `, 0 0 16px ${alpha(style.color, 0.25)}` : ''}`
      }}
    >
      <Icon className="w-4 h-4 shrink-0" style={{ color: style.color }} />
      <span className="w-20 md:w-24 shrink-0 text-xs font-semibold tabular-nums" style={{ color: style.color }}>
        {when}
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block truncate text-on-surface ${cancelled ? 'line-through' : ''}`}>{ritual.title}</span>
        {(ritual.scriptName || ritual.location || places) && (
          <span className="flex flex-wrap gap-x-3 text-[11px] text-on-surface-muted">
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
