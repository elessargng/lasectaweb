import { ChevronLeft, ChevronRight, Feather, MapPin, Plus, Repeat, ScrollText, Users } from 'lucide-react';
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
import { attendanceSummary } from './ritualSignups';

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
      {/* Escuadras doradas en las esquinas del marco (decorativas) */}
      <span aria-hidden="true" className="corner corner-tl -translate-x-3 -translate-y-3" />
      <span aria-hidden="true" className="corner corner-tr translate-x-3 -translate-y-3" />
      <span aria-hidden="true" className="corner corner-bl -translate-x-3 translate-y-3" />
      <span aria-hidden="true" className="corner corner-br translate-x-3 translate-y-3" />

      <div className="border border-theme-main/25 bg-outline-ghost/70 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)]">
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
                    backgroundColor: alpha(style.color, 0.16),
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
                    ? 'bg-gradient-to-b from-theme-container to-surface'
                    : 'bg-gradient-to-b from-surface-container-low/90 to-surface'
                } ${isSelected ? 'ring-1 ring-inset ring-theme-main shadow-[inset_0_0_24px_rgba(212,175,106,0.12)]' : ''}`}
              >
                {isToday && (
                  <span className="absolute inset-x-0 top-0 h-0.5 bg-theme-main shadow-[0_0_10px_rgba(212,175,106,0.9)] pointer-events-none" />
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
                      isToday ? 'text-gilded' : 'text-on-surface'
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
                    aria-label={`Convocar un ritual el ${day.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}`}
                    data-tip="Convocar"
                    onClick={() => onCreateOnDay(day)}
                    className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full text-theme-main border border-theme-main/50 bg-background/80 md:opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-theme-main hover:text-background transition-opacity cursor-pointer"
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
  const attendance = attendanceSummary(ritual);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      className={`group/evento w-full text-left px-2.5 py-2 rounded-sm bg-background/70 border border-outline-ghost/70 hover:border-theme-main/50 hover:bg-surface-container transition-colors cursor-pointer ${cancelled ? 'opacity-50' : ''} ${className}`}
      style={{ borderLeft: `2px solid ${style.color}` }}
    >
      {/* Hora y tipo */}
      <span className="flex items-center gap-1.5 font-ui text-[0.68rem] font-semibold tracking-wide" style={{ color: style.color }}>
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span className="tabular-nums">{isMultiDay(ritual) ? 'Jornadas' : formatTime(ritual.startsAt)}</span>
        {!isMultiDay(ritual) && <span className="truncate opacity-80">· {style.shortLabel}</span>}
        {(ritual.recurrenceDays || ritual.recurrenceMonths) && (
          <>
            <Repeat className="w-3 h-3 shrink-0 ml-auto opacity-70" />
            <span className="sr-only">, se repite</span>
          </>
        )}
      </span>
      <span lang="es" className={`block mt-1 text-[0.95rem] leading-snug text-on-surface group-hover/evento:text-gold-bright line-clamp-3 hyphens-auto break-words ${cancelled ? 'line-through' : ''}`}>
        {ritual.title}
        {cancelled && <span className="sr-only"> (cancelado)</span>}
      </span>
      {/* Lo esencial para decidir si interesa; el resto, en el modal */}
      {(ritual.scriptName || ritual.location || ritual.storytellerUsername || attendance) && (
        <span className="flex flex-col gap-0.5 mt-1.5 text-xs text-on-surface-muted [&_svg]:text-theme-main/70">
          {ritual.scriptName && (
            <span className="flex items-center gap-1 min-w-0">
              <ScrollText className="w-3 h-3 shrink-0" /> <span className="truncate">{ritual.scriptName}</span>
            </span>
          )}
          {ritual.location && (
            <span className="flex items-center gap-1 min-w-0">
              <MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{ritual.location}</span>
            </span>
          )}
          {ritual.storytellerUsername && (
            <span className="flex items-center gap-1 min-w-0">
              <Feather className="w-3 h-3 shrink-0" /> <span className="truncate">Narra {ritual.storytellerUsername}</span>
            </span>
          )}
          {attendance && (
            <span className="flex items-center gap-1 min-w-0">
              <Users className="w-3 h-3 shrink-0" /> <span className="truncate">{attendance}</span>
            </span>
          )}
        </span>
      )}
    </button>
  );
};

export default RitualWeek;
