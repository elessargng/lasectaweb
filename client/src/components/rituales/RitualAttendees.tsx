import { Loader2, UserMinus, UserPlus } from 'lucide-react';
import type { Ritual } from '../../utils/ritualsApi';
import { getAvatarUrl } from '../../utils/api';
import { alpha } from './ritualKinds';

/** Lo que necesita la tarjeta para que la persona que mira pueda apuntarse. */
export interface SignupActions {
  userId?: string;
  /** Momento de referencia para saber si una partida ya ha empezado. */
  now: number;
  busyKey: string | null;
  onSignUp: (ritual: Ritual) => void;
  onLeave: (ritual: Ritual) => void;
}

interface RitualAttendeesProps {
  ritual: Ritual;
  color: string;
  actions?: SignupActions;
}

/**
 * La gente apuntada a una partida de La Secta, en el orden en que se apuntó, y
 * el botón para apuntarse o desapuntarse. Las plazas no limitan: quien se
 * apunta pasadas las plazas sigue en la lista, debajo de una marca.
 */
export const RitualAttendees = ({ ritual, color, actions }: RitualAttendeesProps) => {
  const attendees = ritual.attendees ?? [];
  const key = ritual.occurrenceKey ?? ritual.id;
  const busy = actions?.busyKey === key;
  const mine = !!actions?.userId && attendees.some((a) => a.userId === actions.userId);
  const started = !!actions && new Date(ritual.startsAt).getTime() <= actions.now;
  const cancelled = ritual.status === 'cancelado';
  const places = ritual.maxPlayers;

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-display uppercase tracking-[0.18em] text-on-surface-muted">
          Apuntados · <span className="tabular-nums">{attendees.length}</span>
        </p>
        {places && <span className="text-xs text-on-surface-muted tabular-nums">{places} plazas</span>}
      </div>

      {attendees.length === 0 ? (
        <p className="text-sm italic text-on-surface-muted">Nadie se ha apuntado todavía.</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {attendees.map((a, i) => (
            <li key={a.userId} className="contents">
              {/* Marca donde se acaban las plazas: quien va después se apuntó cuando ya estaban cubiertas */}
              {places && i === places && (
                <span className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-on-surface-muted/80 my-1">
                  <span className="flex-1 border-t border-dashed border-outline-ghost" />
                  Por encima de las {places} plazas
                  <span className="flex-1 border-t border-dashed border-outline-ghost" />
                </span>
              )}
              <span className="flex items-center gap-2 text-sm">
                <span className="w-5 text-right text-xs tabular-nums text-on-surface-muted">{i + 1}.</span>
                <img
                  src={getAvatarUrl(a.profilePicture)}
                  alt=""
                  className="w-6 h-6 rounded-full object-cover border border-outline-ghost"
                  loading="lazy"
                />
                <span className={`truncate ${a.userId === actions?.userId ? 'text-on-surface font-semibold' : 'text-on-surface/90'}`}>
                  {a.username}
                </span>
                {a.userId === actions?.userId && (
                  <span className="text-[10px] uppercase tracking-wider shrink-0" style={{ color }}>
                    tú
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}

      {!cancelled &&
        (started ? (
          <p className="text-xs italic text-on-surface-muted">La partida ya ha empezado.</p>
        ) : !actions?.userId ? (
          <p className="text-xs italic text-on-surface-muted">Identifícate para apuntarte.</p>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => (mine ? actions.onLeave(ritual) : actions.onSignUp(ritual))}
            className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 border text-xs font-display uppercase tracking-wider transition-colors disabled:opacity-60"
            style={
              mine
                ? { borderColor: 'var(--color-outline-ghost)' }
                : { borderColor: alpha(color, 0.6), color, backgroundColor: alpha(color, 0.12) }
            }
          >
            {busy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : mine ? (
              <UserMinus className="w-3.5 h-3.5" />
            ) : (
              <UserPlus className="w-3.5 h-3.5" />
            )}
            {mine ? 'Desapuntarme' : 'Apuntarme'}
          </button>
        ))}
    </div>
  );
};

export default RitualAttendees;
