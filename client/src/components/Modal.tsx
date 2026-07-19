import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, MapPin, Globe, Users } from 'lucide-react';
import type { PublicPlaySchema } from './CalendarWidget';

interface ModalProps {
  isOpen: boolean;
  anchorEl: HTMLElement | null;
  play: PublicPlaySchema | null;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, anchorEl, play }) => {
  const [coords, setCoords] = useState<{ top: number; left: number; showBelow: boolean } | null>(null);

  useEffect(() => {
    if (!anchorEl || !isOpen) {
      setCoords(null);
      return;
    }

    const updatePosition = () => {
      const rect = anchorEl.getBoundingClientRect();
      // If the button is close to the top of the screen (less than 240px), show modal below
      const showBelow = rect.top < 240;
      
      const top = showBelow ? rect.bottom + 8 : rect.top - 8;
      const left = rect.left + rect.width / 2;
      
      setCoords({ top, left, showBelow });
    };

    updatePosition();

    // Re-calculate position on window scroll or resize
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [anchorEl, isOpen]);

  if (!isOpen || !play || !coords) return null;

  const dateObj = new Date(play.date);
  const weekday = dateObj.toLocaleDateString('es-ES', { weekday: 'long' });
  const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const dateFormatted = dateObj.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
  });
  const timeFormatted = dateObj.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const transform = coords.showBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)';

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        transform,
        zIndex: 100,
      }}
      className="w-84 bg-surface border border-outline-ghost/90 text-on-surface p-5 rounded-md shadow-2xl pointer-events-none select-none animate-in fade-in-0 zoom-in-95 duration-200"
    >
      {/* Runic Corner Details */}
      <span className="absolute top-1.5 left-2.5 text-[10px] text-theme-main/40 font-display select-none">ᚠ</span>
      <span className="absolute top-1.5 right-2.5 text-[10px] text-theme-main/40 font-display select-none">ᚦ</span>
      <span className="absolute bottom-1.5 left-2.5 text-[10px] text-theme-main/40 font-display select-none">ᚨ</span>
      <span className="absolute bottom-1.5 right-2.5 text-[10px] text-theme-main/40 font-display select-none">ᛟ</span>

      {/* Header Info */}
      <div className="flex flex-col gap-1 pr-2">
        <h4 className="text-xl font-display font-bold text-theme-main leading-tight tracking-wide break-words uppercase">
          {play.name}
        </h4>
        {play.script_name && play.script_name !== play.name && (
          <p className="text-base text-on-surface-muted font-body font-bold italic">
            Guion: {play.script_name}
          </p>
        )}
      </div>

      <div className="border-b border-outline-ghost/40 my-3.5"></div>

      {/* Play Details */}
      <div className="flex flex-col gap-3 text-[17px] font-body">
        {/* Date and time */}
        <div className="flex items-center gap-2.5 text-on-surface">
          <Calendar className="w-5 h-5 text-theme-main shrink-0" />
          <span>
            {capitalizedWeekday}, {dateFormatted} — <span className="font-semibold text-white">{timeFormatted}h</span>
          </span>
        </div>

        {/* Location mode */}
        <div className="flex items-center gap-2.5">
          {play.in_person ? (
            <>
              <MapPin className="w-5 h-5 text-theme-main shrink-0" />
              <span className="text-on-surface-muted">Presencial</span>
            </>
          ) : (
            <>
              <Globe className="w-5 h-5 text-theme-main shrink-0" />
              <span className="text-on-surface-muted">Online</span>
            </>
          )}
        </div>
      </div>

      <div className="border-b border-outline-ghost/40 my-3.5"></div>

      {/* Player Lists / RSVP */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5 text-theme-main font-display text-sm tracking-wider uppercase font-semibold">
          <Users className="w-[18px] h-[18px]" />
          <span>Listas de Inscripción</span>
        </div>

        {play.lists && play.lists.length > 0 ? (
          <div className="flex flex-col gap-3">
            {play.lists
              .sort((a, b) => a.order - b.order)
              .map((list) => {
                const isFull = list.max_players !== null && list.player_count >= list.max_players;
                const percent = list.max_players 
                  ? Math.min(100, (list.player_count / list.max_players) * 100) 
                  : 0;

                return (
                  <div key={list.id} className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-baseline text-base">
                      <span className="font-body text-on-surface-muted font-medium">
                        {list.name}
                      </span>
                      <span className="font-display text-sm text-on-surface font-semibold">
                        {list.player_count}
                        {list.max_players !== null && (
                          <span className="text-on-surface-muted font-normal"> / {list.max_players}</span>
                        )}
                      </span>
                    </div>

                    {list.max_players !== null && (
                      <div className="w-full h-2 bg-surface-low border border-outline-ghost/30 rounded-sm overflow-hidden">
                        <div
                          style={{ width: `${percent}%` }}
                          className={`h-full rounded-sm transition-all duration-500 ${
                            isFull ? 'bg-red-500/80' : 'bg-theme-main'
                          }`}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        ) : (
          <p className="text-sm text-on-surface-muted font-body italic">
            No hay listas configuradas en esta partida.
          </p>
        )}
      </div>
    </div>,
    document.body
  );
};
