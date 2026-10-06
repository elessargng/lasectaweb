import { ChevronLeft, ChevronRight, Plus, ScrollText, Users } from 'lucide-react';
import type { Ritual } from '../../utils/ritualsApi';
import { RITUAL_KINDS, alpha, kindOf } from './ritualKinds';
import {
  addDays,
  compareRituals,
  coversDay,
  formatTime,
  isMultiDay,
  isSameDay,
  keyOf,
  startOfWeek,
  weekLanes
} from './ritualDates';
import { compactPlaces } from './ritualSignups';

interface RitualWeekProps {
  /** Cualquier día de la semana que se muestra. */
  anchor: Date;
  rituals: Ritual[];
  selectedDay: Date;
  canCreate: boolean;
  onSelectDay: (day: Date) => void;
  /** Al pulsar un ritual concreto: se elige su día y se resalta en el detalle. */
  onSelectRitual: (day: Date, ritual: Ritual) => void;
  onCreateOnDay: (day: Date) => void;
}

interface BandPlacement {
  ritual: Ritual;
  lane: number;
  first: number;
  last: number;
}

/** Cada jornada de la semana con su carril y las columnas que cruza. */
function placeBands(week: Date[], rituals: Ritual[]): BandPlacement[] {
  const placements = new Map<string, BandPlacement>();
  weekLanes(week, rituals).forEach((slots, dayIndex) =>
    slots.forEach((band, lane) => {
      if (!band) return;
      const placed = placements.get(keyOf(band));
      if (placed) placed.last = dayIndex;
      else placements.set(keyOf(band), { ritual: band, lane, first: dayIndex, last: dayIndex });
    })
  );
  return [...placements.values()];
}

/**
 * La semana completa: las jornadas como cintas que cruzan las columnas y,
 * debajo, cada día con todos sus rituales, sin recortar ninguno.
 */
export const RitualWeek = ({
  anchor,
  rituals,
  selectedDay,
  canCreate,
  onSelectDay,
  onSelectRitual,
  onCreateOnDay
}: RitualWeekProps) => {
  const today = new Date();
  const week = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i));
  const bands = placeBands(week, rituals);

  return (
    <div className="relative">
      {/* Esquinas rúnicas del marco, como en el mes */}
      <span className="absolute -top-2.5 -left-1 text-theme-main/40 text-xs select-none pointer-events-none">ᚠ</span>
      <span className="absolute -top-2.5 -right-1 text-theme-main/40 text-xs select-none pointer-events-none">ᚦ</span>
      <span className="absolute -bottom-3 -left-1 text-theme-main/40 text-xs select-none pointer-events-none">ᚨ</span>
      <span className="absolute -bottom-3 -right-1 text-theme-main/40 text-xs select-none pointer-events-none">ᛟ</span>

      <div className="border border-outline-ghost/60 bg-outline-ghost/60 shadow-[0_0_40px_rgba(74,59,105,0.25)]">
        {/* Cintas de las jornadas (solo en pantallas anchas: en móvil van dentro de cada día) */}
        {bands.length > 0 && (
          <div className="hidden md:grid grid-cols-7 gap-y-1 py-1.5 bg-surface border-b border-outline-ghost/60">
            {bands.map(({ ritual, lane, first, last }) => {
              const style = RITUAL_KINDS[kindOf(ritual)];
              const Icon = style.icon;
              const startsBefore = !isSameDay(new Date(ritual.startsAt), week[first]);
              const endsAfter = !!ritual.endsAt && !isSameDay(new Date(ritual.endsAt), week[last]);
              return (
                <button
                  key={keyOf(ritual)}
                  type="button"
                  onClick={() => onSelectRitual(week[first], ritual)}
                  title={ritual.title}
                  className={`mx-1 h-6 flex items-center gap-1.5 px-2 text-xs truncate transition-colors hover:brightness-125 ${
                    startsBefore ? 'rounded-l-none' : 'rounded-l-sm'
                  } ${endsAfter ? 'rounded-r-none' : 'rounded-r-sm'} ${ritual.status === 'cancelado' ? 'line-through opacity-50' : ''}`}
                  style={{
                    gridColumn: `${first + 1} / ${last + 2}`,
                    gridRow: lane + 1,
                    backgroundColor: alpha(style.color, 0.22),
                    borderLeft: startsBefore ? 'none' : `2px solid ${style.color}`
                  }}
                >
                  {startsBefore && <ChevronLeft className="w-3 h-3 shrink-0" style={{ color: style.color }} />}
                  <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: style.color }} />
                  <span className="truncate text-on-surface/90">{ritual.title}</span>
                  {endsAfter && <ChevronRight className="w-3 h-3 shrink-0 ml-auto" style={{ color: style.color }} />}
                </button>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-7 gap-px">
          {week.map((day) => {
            const isToday = isSameDay(day, today);
            const isSelected = isSameDay(day, selectedDay);
            const dayRituals = rituals.filter((r) => coversDay(r, day)).sort(compareRituals);
            const singles = dayRituals.filter((r) => !isMultiDay(r));
            const dayBands = dayRituals.filter(isMultiDay);

            return (
              <div
                key={day.toISOString()}
                className={`group relative flex flex-col min-w-0 md:min-h-[20rem] transition-colors ${
                  isToday
                    ? 'bg-gradient-to-b from-theme-container/40 to-surface-container-low'
                    : 'bg-gradient-to-b from-surface-container-low to-surface'
                } ${isSelected ? 'ring-1 ring-inset ring-theme-main/70' : ''}`}
              >
                {isToday && (
                  <span className="absolute inset-x-0 top-0 h-0.5 bg-theme-main shadow-[0_0_10px_rgba(177,156,217,0.9)] pointer-events-none" />
                )}

                {/* Cabecera del día */}
                <button
                  type="button"
                  onClick={() => onSelectDay(day)}
                  className="flex md:flex-col items-baseline md:items-center gap-2 md:gap-0 px-3 py-2 md:py-3 border-b border-outline-ghost/40 text-left md:text-center focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-theme-main"
                >
                  <span
                    className={`text-[10px] md:text-xs font-display uppercase tracking-[0.2em] ${
                      day.getDay() === 0 || day.getDay() === 6 ? 'text-theme-main/80' : 'text-on-surface-muted'
                    }`}
                  >
                    {day.toLocaleDateString('es-ES', { weekday: 'short' })}
                  </span>
                  <span
                    className={`font-display text-xl md:text-2xl leading-none ${
                      isToday ? 'text-theme-main drop-shadow-[0_0_6px_rgba(177,156,217,0.8)]' : 'text-on-surface'
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  <span className="md:hidden text-xs text-on-surface-muted ml-auto">
                    {dayRituals.length === 0 ? '' : `${dayRituals.length} ${dayRituals.length === 1 ? 'ritual' : 'rituales'}`}
                  </span>
                </button>

                {/* Todos los rituales del día */}
                <div className="flex flex-col gap-1.5 p-1.5 flex-1">
                  {/* En móvil las jornadas no tienen cinta: se listan aquí */}
                  {dayBands.map((r) => (
                    <WeekEvent key={keyOf(r)} ritual={r} className="md:hidden" onClick={() => onSelectRitual(day, r)} />
                  ))}
                  {singles.map((r) => (
                    <WeekEvent key={keyOf(r)} ritual={r} onClick={() => onSelectRitual(day, r)} />
                  ))}
                  {dayRituals.length === 0 && (
                    <span className="hidden md:block text-center text-[11px] italic text-on-surface-muted/40 mt-4">—</span>
                  )}
                </div>

                {canCreate && (
                  <button
                    type="button"
                    title="Convocar un ritual este día"
                    onClick={() => onCreateOnDay(day)}
                    className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full text-theme-main/80 border border-theme-main/40 bg-surface/80 md:opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-theme-container hover:text-theme-main transition-opacity"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface WeekEventProps {
  ritual: Ritual;
  className?: string;
  onClick: () => void;
}

/** Un ritual dentro de la columna de su día: hora, nombre y lo esencial. */
const WeekEvent = ({ ritual, className = '', onClick }: WeekEventProps) => {
  const style = RITUAL_KINDS[kindOf(ritual)];
  const Icon = style.icon;
  const cancelled = ritual.status === 'cancelado';
  const places = compactPlaces(ritual);

  return (
    <button
      type="button"
      onClick={onClick}
      title={ritual.title}
      className={`w-full text-left px-2 py-1.5 rounded-sm transition-colors hover:brightness-125 ${cancelled ? 'opacity-50' : ''} ${className}`}
      style={{ backgroundColor: alpha(style.color, 0.1), borderLeft: `2px solid ${style.color}` }}
    >
      <span className="flex items-center gap-1 text-[11px] font-semibold tabular-nums" style={{ color: style.color }}>
        <Icon className="w-3 h-3 shrink-0" />
        {isMultiDay(ritual) ? 'Jornadas' : formatTime(ritual.startsAt)}
      </span>
      <span lang="es" className={`block text-[13px] leading-snug text-on-surface/90 line-clamp-3 hyphens-auto break-words ${cancelled ? 'line-through' : ''}`}>
        {ritual.title}
      </span>
      {(ritual.scriptName || places) && (
        <span className="flex flex-wrap gap-x-2 text-[10px] text-on-surface-muted mt-0.5">
          {ritual.scriptName && (
            <span className="inline-flex items-center gap-0.5 truncate">
              <ScrollText className="w-2.5 h-2.5 shrink-0" /> {ritual.scriptName}
            </span>
          )}
          {places && (
            <span className="inline-flex items-center gap-0.5 tabular-nums">
              <Users className="w-2.5 h-2.5 shrink-0" /> {places}
            </span>
          )}
        </span>
      )}
    </button>
  );
};

export default RitualWeek;
