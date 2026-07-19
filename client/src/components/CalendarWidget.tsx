import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import { Modal } from "./Modal";

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

const API_URL = `${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api'}`;


async function fetchPendingPlays(): Promise<PublicPlaySchema[]> {
  const response = await fetch(`${API_URL}/villacuervos/plays/pending`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function getNextDays(startDate: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, i) => {
    const day = new Date(startDate);
    day.setDate(day.getDate() + i);
    return day;
  });
}

function isSameDay(dateStr: string, target: Date): boolean {
  const d = new Date(dateStr);
  return (
    d.getFullYear() === target.getFullYear() &&
    d.getMonth() === target.getMonth() &&
    d.getDate() === target.getDate()
  );
}

function MiniCalendar({ plays, narrador }: { plays: PublicPlaySchema[], narrador: boolean }) {
  const days = getNextDays(new Date(), 7);
  const [hoveredPlay, setHoveredPlay] = useState<PublicPlaySchema | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  return (
    <div className="w-full overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-thin scrollbar-thumb-theme-main/20 scrollbar-track-transparent">
      <div className="flex md:grid md:grid-cols-7 gap-3 min-w-max md:min-w-0 w-full">
        {days.map((day, i) => {
          const todayGames = plays.filter((play) => isSameDay(play.date, day));
          const hasGame = todayGames.length > 0;

          return (
            <div
              key={i}
              className={`rounded-lg p-3 text-center w-[100px] md:w-auto flex flex-col border transition-colors ${hasGame
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

              {hasGame && (
                <div className="flex flex-col gap-1.5 mt-1.5 w-full">
                  {todayGames.map((play) => {
                    const playTime = new Date(play.date).toLocaleTimeString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    const playLink = `https://villacuervos.es/partidas/la-secta/${play.id}/${play.slug}`;

                    return (
                      <a
                        key={play.id}
                        href={playLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onMouseEnter={(e) => {
                          setHoveredPlay(play);
                          setAnchorEl(e.currentTarget);
                        }}
                        onMouseLeave={() => {
                          setHoveredPlay(null);
                          setAnchorEl(null);
                        }}
                        className="block w-full py-1 px-1.5 bg-theme-container/40 hover:bg-theme-main/30 text-theme-main border border-theme-main/30 hover:border-theme-main rounded text-xs md:text-sm font-semibold text-center transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 shadow-sm"
                      >
                        {playTime}
                      </a>
                    );
                  })}
                </div>
              )}

              {narrador && (
                <Link
                  to="/rituales"
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
        isOpen={!!hoveredPlay}
        anchorEl={anchorEl}
        play={hoveredPlay}
      />
    </div>
  );
}

// --- Container: fetches data and renders the calendar ---
export default function CalendarWidget() {
  const [plays, setPlays] = useState<PublicPlaySchema[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();

  const isNarrador = (user?.roles || []).includes('narrador') || (user?.roles || []).includes('admin');

  useEffect(() => {
    fetchPendingPlays()
      .then((data) => setPlays(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading calendar…</p>;
  if (error) return <p>Error: {error}</p>;

  return <MiniCalendar plays={plays} narrador={isNarrador} />;
}
