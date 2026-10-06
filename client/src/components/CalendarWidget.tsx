import { useState, useEffect, type MouseEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import { Modal } from "./Modal";
import { listRituals, type Ritual } from "../utils/ritualsApi";
import { RITUAL_KINDS, kindOf, alpha } from "./rituales/ritualKinds";
import { addDays, coversDay, dayKey, expandOccurrences, formatTime, isSameDay, keyOf, startOfDay } from "./rituales/ritualDates";

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

  const className = `flex items-center justify-center gap-1 w-full py-1 px-1.5 border rounded text-xs md:text-sm font-semibold text-center transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 shadow-sm ${cancelled ? 'line-through opacity-50' : ''}`;
  const colors = { color: style.color, backgroundColor: alpha(style.color, 0.15), borderColor: alpha(style.color, 0.45) };
  const content = (
    <>
      <Icon size={13} className="shrink-0" />
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
      </a>
    );
  }
  return (
    <Link to={`/rituales?dia=${dayKey(day)}`} className={className} style={colors} {...hoverProps}>
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
    <div className="w-full overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-thin scrollbar-thumb-theme-main/20 scrollbar-track-transparent">
      <div className="flex md:grid md:grid-cols-7 gap-3 min-w-max md:min-w-0 w-full">
        {days.map((day, i) => {
          const todayRituals = rituals.filter((ritual) => coversDay(ritual, day));
          const hasRitual = todayRituals.length > 0;

          return (
            <div
              key={i}
              className={`rounded-lg p-3 text-center w-[100px] md:w-auto flex flex-col border transition-colors ${hasRitual
                ? 'bg-theme-container/10 border-theme-main/50'
                : 'bg-surface-low/30 border-outline-ghost/50 opacity-70'
                }`}
            >
              <div className="flex items-baseline justify-center gap-1.5 border-b border-outline-ghost/30 pb-1.5 mb-1.5 w-full">
                <span className="text-xs text-on-surface-muted uppercase tracking-wider font-semibold">
                  {day.toLocaleDateString('es-ES', { weekday: 'short' })}
                </span>
                <span className="text-lg font-bold text-on-surface">
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
                  title="Añadir nueva partida"
                  className="mt-auto pt-3 text-theme-main/70 hover:text-theme-main transition-colors flex justify-center"
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

  if (loading) return <p>Loading calendar…</p>;
  if (error) return <p>Error: {error}</p>;

  return <MiniCalendar rituals={rituals} narrador={isNarrador} />;
}
