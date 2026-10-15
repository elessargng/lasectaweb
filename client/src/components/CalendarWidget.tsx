import { useState, useEffect, type MouseEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import { Modal } from "./Modal";
import { listRituals, type Ritual } from "../utils/ritualsApi";
import { RITUAL_KINDS, kindOf, alpha } from "./rituales/ritualKinds";
import { addDays, coversDay, dayKey, expandOccurrences, formatTime, isSameDay, keyOf, ritualPath, startOfDay } from "./rituales/ritualDates";

import {
  CirclePlus
} from "lucide-react";


export interface PublicPlayListSchema {
  id: number;
  name: string;
  order: number;
  max_players: number | null;
  player_count: number;
}

export interface PublicPlaySchema {
  id: number;
  name: string;
  slug: string;
  date: string;
  script_name: string | null;
  in_person: boolean;
  lists: PublicPlayListSchema[];
}

const DAYS_SHOWN = 7;

function getNextDays(startDate: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, i) => addDays(startDate, i));
}

/** Las de Villacuervos se abren allí; las de aquí, en su día de la agenda. */
function externalLink(ritual: Ritual): string | undefined {
  return ritual.source === 'villacuervos' ? ritual.villacuervosUrl ?? ritual.link : undefined;
}

function RitualPill({ ritual, day, onHover }: {
  ritual: Ritual;
  day: Date;
  onHover: (ritual: Ritual | null, el: HTMLElement | null) => void;
}) {
  const style = RITUAL_KINDS[kindOf(ritual)];
  const Icon = style.icon;
  const cancelled = ritual.status === 'cancelado';
  // Una jornada de varios días muestra la hora solo el día en que empieza.
  const label = isSameDay(new Date(ritual.startsAt), day) ? formatTime(ritual.startsAt) : style.shortLabel;

  const className = `flex items-center justify-center gap-1 w-full py-1 px-1.5 border rounded-sm font-ui text-xs font-semibold tracking-wide text-center transition-all duration-200 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 active:translate-y-0 shadow-[0_4px_10px_-4px_rgba(0,0,0,0.8)] ${cancelled ? 'line-through opacity-50' : ''}`;
  const colors = { color: style.color, backgroundColor: alpha(style.color, 0.15), borderColor: alpha(style.color, 0.45) };
  const content = (
    <>
      <Icon size={13} className="shrink-0" />
      {/* La hora sola no dice qué partida es: el lector oye también el tipo y el título */}
      <span className="sr-only">{style.label}: {ritual.title}{cancelled ? ' (cancelada)' : ''}, </span>
      <span className="truncate">{label}</span>
    </>
  );
  const hoverProps = {
    onMouseEnter: (e: MouseEvent<HTMLElement>) => onHover(ritual, e.currentTarget),
    onMouseLeave: () => onHover(null, null)
  };

  const external = externalLink(ritual);
  if (external) {
    return (
      <a href={external} target="_blank" rel="noopener noreferrer" className={className} style={colors} {...hoverProps}>
        {content}
        <span className="sr-only"> (se abre en una ventana nueva)</span>
      </a>
    );
  }
  return (
    <Link to={ritualPath(ritual)} className={className} style={colors} {...hoverProps}>
      {content}
    </Link>
  );
}

function MiniCalendar({ rituals, narrador }: { rituals: Ritual[], narrador: boolean }) {
  const days = getNextDays(startOfDay(new Date()), DAYS_SHOWN);
  const [hoveredRitual, setHoveredRitual] = useState<Ritual | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleHover = (ritual: Ritual | null, el: HTMLElement | null) => {
    setHoveredRitual(ritual);
    setAnchorEl(el);
  };

  return (
    <div className="w-full overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
      <div className="flex md:grid md:grid-cols-7 gap-3 min-w-max md:min-w-0 w-full">
        {days.map((day, i) => {
          const todayRituals = rituals.filter((ritual) => coversDay(ritual, day));
          const hasRitual = todayRituals.length > 0;
          const isToday = i === 0;

          return (
            <div
              key={i}
              className={`relative rounded-sm p-3 text-center w-[104px] md:w-auto flex flex-col border transition-colors ${hasRitual
                ? 'bg-[linear-gradient(180deg,rgba(18,26,51,0.75),rgba(13,15,23,0.9))] border-theme-main/35'
                : 'bg-surface-low/40 border-outline-ghost/60'
                }`}
            >
              {isToday && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-theme-main shadow-[0_0_10px_rgba(212,175,106,0.9)]" />}
              <div className="flex flex-col items-center border-b border-outline-ghost/50 pb-2 mb-1.5 w-full">
                <span className={`font-ui text-[0.65rem] uppercase tracking-[0.2em] font-semibold ${isToday ? 'text-theme-main' : 'text-on-surface-muted'}`}>
                  {day.toLocaleDateString('es-ES', { weekday: 'short' })}
                </span>
                <span className={`font-display text-2xl leading-none mt-1 ${isToday ? 'text-gilded' : hasRitual ? 'text-on-surface' : 'text-on-surface-muted/70'}`}>
                  {day.getDate()}
                </span>
              </div>

              {hasRitual && (
                <div className="flex flex-col gap-1.5 mt-1.5 w-full">
                  {todayRituals.map((ritual) => (
                    <RitualPill key={keyOf(ritual)} ritual={ritual} day={day} onHover={handleHover} />
                  ))}
                </div>
              )}

              {narrador && (
                <Link
                  to={`/rituales?nuevo=${dayKey(day)}`}
                  aria-label={`Añadir partida el ${day.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}`}
                  className="mt-auto pt-3 text-theme-main/60 hover:text-theme-main transition-colors flex justify-center"
                >
                  <CirclePlus size={20} />
                </Link>
              )}
            </div>
          );
        })}
      </div>

      <Modal
        isOpen={!!hoveredRitual}
        anchorEl={anchorEl}
        ritual={hoveredRitual}
      />
    </div>
  );
}

// --- Container: fetches data and renders the calendar ---
export default function CalendarWidget() {
  const [rituals, setRituals] = useState<Ritual[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();

  const isNarrador = (user?.roles || []).includes('narrador') || (user?.roles || []).includes('admin');

  useEffect(() => {
    // Partidas de La Secta y de Villacuervos, presenciales y jornadas. Las
    // periódicas llegan como serie y aquí se despliegan.
    const from = startOfDay(new Date());
    const to = addDays(from, DAYS_SHOWN);
    listRituals(from, to)
      .then((data) => setRituals(expandOccurrences(data, from, to)))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-on-surface-muted italic">Cargando el calendario…</p>;
  if (error) return <p className="text-blood-bright">Error: {error}</p>;

  return <MiniCalendar rituals={rituals} narrador={isNarrador} />;
}
