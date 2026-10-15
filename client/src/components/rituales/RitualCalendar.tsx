import { Plus } from 'lucide-react';
import type { Ritual } from '../../utils/ritualsApi';
import { RITUAL_KINDS, alpha, kindOf } from './ritualKinds';
import { WEEKDAYS, compareRituals, coversDay, formatTime, isMultiDay, isSameDay, keyOf, monthGrid, weekLanes } from './ritualDates';
import { compactPlaces } from './ritualSignups';

interface RitualCalendarProps {
  month: Date;
  rituals: Ritual[];
  selectedDay: Date;
  canCreate: boolean;
  onSelectDay: (day: Date) => void;
  /** Al pulsar un ritual concreto: se abre su detalle. */
  onSelectRitual: (day: Date, ritual: Ritual) => void;
  onCreateOnDay: (day: Date) => void;
  /** «+N más»: lleva a la semana de ese día, donde caben todos. */
  onShowWeek: (day: Date) => void;
}

const MAX_VISIBLE = 4;

const longDay = (day: Date) => day.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

/**
 * La cuadrícula del mes, a todo el ancho. Cada ritual es un botón con su hora
 * y su título que abre el detalle; las jornadas de varios días se dibujan como
 * una cinta que cruza las casillas (solo el tramo con el título es botón, para
 * que el lector no la oiga una vez por día). En el móvil las casillas solo
 * llevan sellos de color y la lista del día va debajo del calendario.
 */
export const RitualCalendar = ({
  month,
  rituals,
  selectedDay,
  canCreate,
  onSelectDay,
  onSelectRitual,
  onCreateOnDay,
  onShowWeek
}: RitualCalendarProps) => {
  const today = new Date();
  const days = monthGrid(month);
  const lanes = Array.from({ length: days.length / 7 }, (_, w) => weekLanes(days.slice(w * 7, w * 7 + 7), rituals)).flat();

  return (
    <div className="relative">
      {/* Escuadras doradas en las esquinas del marco (decorativas) */}
      <span aria-hidden="true" className="corner corner-tl -translate-x-3 -translate-y-3" />
      <span aria-hidden="true" className="corner corner-tr translate-x-3 -translate-y-3" />
      <span aria-hidden="true" className="corner corner-bl -translate-x-3 translate-y-3" />
      <span aria-hidden="true" className="corner corner-br translate-x-3 translate-y-3" />

      <div aria-hidden="true" className="grid grid-cols-7 mb-2">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`text-center font-ui text-[0.65rem] md:text-xs font-semibold uppercase tracking-[0.22em] py-1 ${
              i >= 5 ? 'text-theme-main/85' : 'text-on-surface-muted'
            }`}
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-outline-ghost/70 border border-theme-main/25 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)]">
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
              className={`group relative min-h-[4.5rem] md:min-h-[9rem] p-1 md:p-2 flex flex-col transition-colors duration-200 ${
                isToday
                  ? 'bg-gradient-to-b from-theme-container to-surface'
                  : inMonth
                    ? 'bg-gradient-to-b from-surface-container-low/90 to-surface'
                    : 'bg-background/90'
              } ${isSelected ? 'ring-1 ring-inset ring-theme-main shadow-[inset_0_0_20px_rgba(212,175,106,0.12)]' : ''}`}
            >
              {isToday && (
                <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-theme-main shadow-[0_0_10px_rgba(212,175,106,0.9)] pointer-events-none" />
              )}

              {/* El número del día elige el día (en el móvil, su lista aparece debajo del calendario) */}
              <button
                type="button"
                onClick={() => onSelectDay(day)}
                aria-label={`${longDay(day)}, ${dayRituals.length === 0 ? 'sin rituales' : dayRituals.length === 1 ? 'un ritual' : `${dayRituals.length} rituales`}`}
                aria-current={isToday ? 'date' : undefined}
                className={`self-start min-w-7 h-7 -m-0.5 px-1 rounded-sm font-display leading-none text-sm md:text-lg text-left cursor-pointer hover:bg-theme-main/10 ${
                  isToday ? 'text-gilded' : inMonth ? 'text-on-surface' : 'text-on-surface-muted/40'
                }`}
              >
                {day.getDate()}
              </button>

              {/* Móvil: solo los sellos, en fila (decorativos: el número del día ya dice cuántos hay) */}
              {dayRituals.length > 0 && (
                <div aria-hidden="true" className="flex md:hidden flex-wrap gap-0.5 mt-auto pt-1">
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
              <ul className={`hidden md:flex flex-col gap-1 mt-1.5 ${inMonth ? '' : 'opacity-50'}`}>
                {bandSlots.map((band, lane) => {
                  if (!band) return <li key={`hueco-${lane}`} className="h-6" aria-hidden="true" />;
                  const style = RITUAL_KINDS[kindOf(band)];
                  const cancelled = band.status === 'cancelado';
                  // La cinta repite el título al empezar y al abrir cada semana; solo ese tramo es botón.
                  const labelHere = isSameDay(new Date(band.startsAt), day) || day.getDay() === 1;
                  const bandClass = `h-6 flex items-center gap-1.5 text-xs leading-tight px-1.5 truncate cursor-pointer hover:brightness-125 ${
                    labelHere ? 'rounded-l-sm -mr-2' : '-mx-2'
                  } ${cancelled ? 'line-through opacity-50' : ''}`;
                  const bandStyle = {
                    backgroundColor: alpha(style.color, 0.16),
                    borderLeft: labelHere ? `2px solid ${style.color}` : 'none'
                  };
                  const BandIcon = style.icon;
                  return (
                    <li key={keyOf(band)} className="contents">
                      {labelHere ? (
                        <button
                          type="button"
                          onClick={() => onSelectRitual(day, band)}
                          aria-haspopup="dialog"
                          className={`${bandClass} w-[calc(100%+0.5rem)] text-left`}
                          style={bandStyle}
                        >
                          <BandIcon className="w-3.5 h-3.5 shrink-0" style={{ color: style.color }} />
                          <span className="truncate text-on-surface/90">
                            <span className="sr-only">{style.label}: </span>
                            {band.title}
                            {cancelled && <span className="sr-only"> (cancelado)</span>}
                          </span>
                        </button>
                      ) : (
                        <div aria-hidden="true" onClick={() => onSelectRitual(day, band)} className={bandClass} style={bandStyle} />
                      )}
                    </li>
                  );
                })}

                {visibleSingles.map((r) => {
                  const style = RITUAL_KINDS[kindOf(r)];
                  const cancelled = r.status === 'cancelado';
                  const places = compactPlaces(r);
                  return (
                    <li key={keyOf(r)}>
                      <button
                        type="button"
                        onClick={() => onSelectRitual(day, r)}
                        aria-haspopup="dialog"
                        className={`w-full h-6 flex items-center gap-1.5 text-xs leading-tight px-1.5 rounded-sm text-left cursor-pointer border border-transparent hover:border-theme-main/40 hover:bg-surface-container transition-colors ${
                          cancelled ? 'line-through opacity-50' : ''
                        }`}
                        style={{ backgroundColor: 'rgba(7, 8, 13, 0.6)', borderLeft: `2px solid ${style.color}` }}
                      >
                        <span className="font-semibold tabular-nums shrink-0" style={{ color: style.color }}>
                          {formatTime(r.startsAt)}
                        </span>
                        <span className="truncate text-on-surface/90">
                          <span className="sr-only">{style.label}: </span>
                          {r.title}
                          {cancelled && <span className="sr-only"> (cancelado)</span>}
                        </span>
                        {places && <span className="ml-auto shrink-0 pl-1 text-[0.65rem] tabular-nums text-on-surface-muted">{places}</span>}
                      </button>
                    </li>
                  );
                })}
                {hidden > 0 && (
                  <li>
                    <button
                      type="button"
                      onClick={() => onShowWeek(day)}
                      aria-label={`Ver ${hidden} ${hidden === 1 ? 'ritual más' : 'rituales más'} en la semana del ${longDay(day)}`}
                      className="font-ui text-[0.65rem] font-semibold tracking-[0.12em] uppercase text-theme-main/85 hover:text-gold-bright pl-1.5 cursor-pointer"
                    >
                      +{hidden} más
                    </button>
                  </li>
                )}
              </ul>

              {canCreate && (
                <button
                  type="button"
                  aria-label={`Convocar un ritual el ${longDay(day)}`}
                  data-tip="Convocar"
                  onClick={() => onCreateOnDay(day)}
                  className="hidden md:flex absolute top-1.5 right-1.5 w-5 h-5 items-center justify-center rounded-full text-theme-main border border-theme-main/50 bg-background/80 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-theme-main hover:text-background transition-opacity cursor-pointer"
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
