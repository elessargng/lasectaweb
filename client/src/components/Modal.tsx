import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, MapPin, Globe, Users, Feather } from 'lucide-react';
import type { Ritual } from '../utils/ritualsApi';
import { RITUAL_KINDS, kindOf } from './rituales/ritualKinds';
import { isMultiDay } from './rituales/ritualDates';
import { isFull } from './rituales/ritualSignups';

interface ModalProps {
  isOpen: boolean;
  anchorEl: HTMLElement | null;
  ritual: Ritual | null;
}

function formatDay(date: Date): string {
  const weekday = date.toLocaleDateString('es-ES', { weekday: 'long' });
  const day = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
  return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${day}`;
}

function formatHour(date: Date): string {
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

export const Modal: React.FC<ModalProps> = ({ isOpen, anchorEl, ritual }) => {
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

  if (!isOpen || !ritual || !coords) return null;

  const kind = RITUAL_KINDS[kindOf(ritual)];
  const KindIcon = kind.icon;
  const cancelled = ritual.status === 'cancelado';
  const start = new Date(ritual.startsAt);
  const end = ritual.endsAt ? new Date(ritual.endsAt) : null;
  const online = ritual.type === 'partida_online';
  const signupLists = [...(ritual.signupLists ?? [])].sort((a, b) => a.order - b.order);

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
        <span
          className="flex items-center gap-1.5 text-xs font-display uppercase tracking-wider font-semibold"
          style={{ color: kind.color }}
        >
          <KindIcon className="w-3.5 h-3.5" />
          {kind.label}
          {cancelled && <span className="text-red-400"> · Cancelada</span>}
        </span>
        <h4 className={`text-xl font-display font-bold text-theme-main leading-tight tracking-wide break-words uppercase ${cancelled ? 'line-through opacity-60' : ''}`}>
          {ritual.title}
        </h4>
        {ritual.scriptName && ritual.scriptName !== ritual.title && (
          <p className="text-base text-on-surface-muted font-body font-bold italic">
            Guion: {ritual.scriptName}
          </p>
        )}
      </div>

      <div className="border-b border-outline-ghost/40 my-3.5"></div>

      {/* Ritual Details */}
      <div className="flex flex-col gap-3 text-[17px] font-body">
        {/* Date and time */}
        <div className="flex items-center gap-2.5 text-on-surface">
          <Calendar className="w-5 h-5 text-theme-main shrink-0" />
          {isMultiDay(ritual) && end ? (
            <span>
              {formatDay(start)} — {formatDay(end)}
            </span>
          ) : (
            <span>
              {formatDay(start)} — <span className="font-semibold text-white">{formatHour(start)}h</span>
            </span>
          )}
        </div>

        {/* Location mode */}
        <div className="flex items-center gap-2.5">
          {online ? (
            <>
              <Globe className="w-5 h-5 text-theme-main shrink-0" />
              <span className="text-on-surface-muted">Online</span>
            </>
          ) : (
            <>
              <MapPin className="w-5 h-5 text-theme-main shrink-0" />
              <span className="text-on-surface-muted">{ritual.location || 'Presencial'}</span>
            </>
          )}
        </div>

        {ritual.storytellerUsername && (
          <div className="flex items-center gap-2.5">
            <Feather className="w-5 h-5 text-theme-main shrink-0" />
            <span className="text-on-surface-muted">Narra {ritual.storytellerUsername}</span>
          </div>
        )}
      </div>

      {/* Player Lists / RSVP */}
      {signupLists.length > 0 ? (
        <>
          <div className="border-b border-outline-ghost/40 my-3.5"></div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5 text-theme-main font-display text-sm tracking-wider uppercase font-semibold">
              <Users className="w-[18px] h-[18px]" />
              <span>Listas de Inscripción</span>
            </div>

            {signupLists.map((list) => {
              const percent = list.maxPlayers
                ? Math.min(100, (list.playerCount / list.maxPlayers) * 100)
                : 0;

              return (
                <div key={list.order} className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-baseline text-base">
                    <span className="font-body text-on-surface-muted font-medium">
                      {list.name}
                    </span>
                    <span className="font-display text-sm text-on-surface font-semibold">
                      {list.playerCount}
                      {list.maxPlayers !== undefined && (
                        <span className="text-on-surface-muted font-normal"> / {list.maxPlayers}</span>
                      )}
                    </span>
                  </div>

                  {list.maxPlayers !== undefined && (
                    <div className="w-full h-2 bg-surface-low border border-outline-ghost/30 rounded-sm overflow-hidden">
                      <div
                        style={{ width: `${percent}%` }}
                        className={`h-full rounded-sm transition-all duration-500 ${
                          isFull(list) ? 'bg-red-500/80' : 'bg-theme-main'
                        }`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (ritual.signupsEnabled || ritual.maxPlayers) ? (
        <>
          <div className="border-b border-outline-ghost/40 my-3.5"></div>
          <div className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2.5 text-theme-main font-display text-sm tracking-wider uppercase font-semibold">
              <Users className="w-[18px] h-[18px]" />
              {ritual.signupsEnabled ? 'Apuntados' : 'Plazas'}
            </span>
            <span className="font-display text-sm text-on-surface font-semibold">
              {ritual.signupsEnabled ? ritual.attendees?.length ?? 0 : ''}
              {ritual.maxPlayers !== undefined && (
                <span className="text-on-surface-muted font-normal">
                  {ritual.signupsEnabled ? ' / ' : ''}{ritual.maxPlayers}
                </span>
              )}
            </span>
          </div>
        </>
      ) : null}
    </div>,
    document.body
  );
};
