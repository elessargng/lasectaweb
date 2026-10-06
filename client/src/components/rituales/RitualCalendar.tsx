import { Plus } from 'lucide-react';
import type { Ritual } from '../../utils/ritualsApi';
import { RITUAL_KINDS, alpha, kindOf } from './ritualKinds';
import { WEEKDAYS, compareRituals, coversDay, formatTime, isMultiDay, isSameDay, keyOf, monthGrid, weekLanes } from './ritualDates';

interface RitualCalendarProps {
  month: Date;
  rituals: Ritual[];
  selectedDay: Date;
  canCreate: boolean;
  onSelectDay: (day: Date) => void;
  /** Al pulsar un ritual concreto: se elige su día y se resalta en el detalle. */
  onSelectRitual: (day: Date, ritual: Ritual) => void;
  onCreateOnDay: (day: Date) => void;
}

const MAX_VISIBLE = 3;

/**
 * La cuadrícula del mes. Cada ritual es un sello del color de su clase; las
 * jornadas de varios días se dibujan como una cinta que cruza las casillas.
 */
export const RitualCalendar = ({
  month,
  rituals,
  selectedDay,
  canCreate,
  onSelectDay,
  onSelectRitual,
  onCreateOnDay
}: RitualCalendarProps) => {
  const today = new Date();
  const days = monthGrid(month);
  const lanes = Array.from({ length: days.length / 7 }, (_, w) => weekLanes(days.slice(w * 7, w * 7 + 7), rituals)).flat();

  return (
    <div className="relative">
      {/* Esquinas rúnicas del marco */}
      <span className="absolute -top-2.5 -left-1 text-theme-main/40 text-xs select-none pointer-events-none">ᚠ</span>
      <span className="absolute -top-2.5 -right-1 text-theme-main/40 text-xs select-none pointer-events-none">ᚦ</span>
      <span className="absolute -bottom-3 -left-1 text-theme-main/40 text-xs select-none pointer-events-none">ᚨ</span>
      <span className="absolute -bottom-3 -right-1 text-theme-main/40 text-xs select-none pointer-events-none">ᛟ</span>

      <div className="grid grid-cols-7 mb-2">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`text-center text-[10px] md:text-xs font-display uppercase tracking-[0.2em] py-1 ${
              i >= 5 ? 'text-theme-main/80' : 'text-on-surface-muted'
            }`}
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-outline-ghost/60 border border-outline-ghost/60 shadow-[0_0_40px_rgba(74,59,105,0.25)]">
        {days.map((day, index) => {
          const inMonth = day.getMonth() === month.getMonth();
          const isToday = isSameDay(day, today);
          const isSelected = isSameDay(day, selectedDay);
          const dayRituals = rituals.filter((r) => coversDay(r, day)).sort(compareRituals);
          const bandSlots = lanes[index];
          const singles = dayRituals.filter((r) => !isMultiDay(r));
          const visibleSingles = singles.slice(0, Math.max(0, MAX_VISIBLE - bandSlots.length));
          const hidden = singles.length - visibleSingles.length;

          return (
            <div
              key={day.toISOString()}
              role="button"
              tabIndex={0}
              onClick={() => onSelectDay(day)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelectDay(day))}
              aria-label={`${day.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}, ${dayRituals.length} rituales`}
              className={`group relative min-h-[4.25rem] md:min-h-[7.25rem] p-1 md:p-1.5 flex flex-col text-left cursor-pointer transition-colors duration-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-theme-main ${
                isToday
                  ? 'bg-gradient-to-b from-theme-container/45 to-surface-container-low hover:from-theme-container/60'
                  : inMonth
                    ? 'bg-gradient-to-b from-surface-container-low to-surface hover:from-surface-container hover:to-surface-container-low'
                    : 'bg-background/90 hover:bg-surface'
              } ${isSelected ? 'ring-1 ring-inset ring-theme-main/70' : ''}`}
            >
              {isToday && (
                <span className="absolute inset-x-0 top-0 h-0.5 bg-theme-main shadow-[0_0_10px_rgba(177,156,217,0.9)] pointer-events-none" />
              )}
              <span
                className={`font-display leading-none text-sm md:text-lg ${
                  isToday
                    ? 'text-theme-main drop-shadow-[0_0_6px_rgba(177,156,217,0.8)]'
                    : inMonth
                      ? 'text-on-surface'
                      : 'text-on-surface-muted/40'
                }`}
              >
                {day.getDate()}
              </span>

              {/* Móvil: solo los sellos, en fila */}
              {dayRituals.length > 0 && (
                <div className="flex md:hidden flex-wrap gap-0.5 mt-auto pt-1">
                  {dayRituals.slice(0, 4).map((r) => (
                    <span
                      key={keyOf(r)}
                      className="w-2 h-2 rotate-45"
                      style={{
                        backgroundColor: r.status === 'cancelado' ? 'transparent' : RITUAL_KINDS[kindOf(r)].color,
                        border: `1px solid ${RITUAL_KINDS[kindOf(r)].color}`
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Escritorio: primero las cintas de las jornadas, cada una en su carril; después el resto */}
              <div className={`hidden md:flex flex-col gap-1 mt-1.5 ${inMonth ? '' : 'opacity-50'}`}>
                {bandSlots.map((band, lane) => {
                  if (!band) return <div key={`hueco-${lane}`} className="h-[1.125rem]" aria-hidden="true" />;
                  const style = RITUAL_KINDS[kindOf(band)];
                  // La cinta repite el título al empezar y al abrir cada semana.
                  const labelHere = isSameDay(new Date(band.startsAt), day) || day.getDay() === 1;
                  return (
                    <div
                      key={keyOf(band)}
                      title={band.title}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectRitual(day, band);
                      }}
                      className={`h-[1.125rem] flex items-center text-[11px] leading-tight px-1 truncate hover:brightness-125 ${
                        labelHere ? 'rounded-l-sm -mr-1.5' : '-mx-1.5'
                      } ${band.status === 'cancelado' ? 'line-through opacity-50' : ''}`}
                      style={{
                        backgroundColor: alpha(style.color, 0.22),
                        borderLeft: labelHere ? `2px solid ${style.color}` : 'none'
                      }}
                    >
                      {labelHere && <span className="truncate text-on-surface/90">{band.title}</span>}
                    </div>
                  );
                })}

                {visibleSingles.map((r) => {
                  const style = RITUAL_KINDS[kindOf(r)];
                  return (
                    <div
                      key={keyOf(r)}
                      title={r.title}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectRitual(day, r);
                      }}
                      className={`h-[1.125rem] flex items-center gap-1 text-[11px] leading-tight px-1 rounded-sm truncate hover:brightness-125 ${
                        r.status === 'cancelado' ? 'line-through opacity-50' : ''
                      }`}
                      style={{ color: style.color, backgroundColor: alpha(style.color, 0.1), borderLeft: `2px solid ${style.color}` }}
                    >
                      <span className="font-semibold tabular-nums shrink-0">{formatTime(r.startsAt)}</span>
                      <span className="truncate text-on-surface/90">{r.title}</span>
                    </div>
                  );
                })}
                {hidden > 0 && <span className="text-[10px] text-on-surface-muted pl-1">+{hidden} más</span>}
              </div>

              {canCreate && (
                <button
                  type="button"
                  title="Convocar un ritual este día"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateOnDay(day);
                  }}
                  className="hidden md:flex absolute bottom-1 right-1 w-5 h-5 items-center justify-center rounded-full text-theme-main/80 border border-theme-main/40 bg-surface/80 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-theme-container hover:text-theme-main transition-opacity"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RitualCalendar;
