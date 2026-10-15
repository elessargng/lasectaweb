import { CalendarCheck, CalendarPlus, Loader2, UserMinus, UserPlus } from 'lucide-react';
import type { Ritual } from '../../utils/ritualsApi';
import { getAvatarUrl } from '../../utils/api';
import { alpha } from './ritualKinds';
import { isIntention } from './ritualSignups';

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
 * Hasta cuándo se puede cambiar: la inscripción se cierra al empezar la
 * partida; la intención de asistir, al terminar el ritual (en una serie, al
 * terminar esa repetición).
 */
function closesAt(ritual: Ritual): number {
  const start = new Date(ritual.startsAt).getTime();
  if (!isIntention(ritual) || !ritual.endsAt) return start;
  const duration = new Date(ritual.endsAt).getTime() - new Date(ritual.seriesStartsAt ?? ritual.startsAt).getTime();
  return start + Math.max(0, duration);
}

/**
 * La gente apuntada a una partida de La Secta, en el orden en que se apuntó, y
 * el botón para apuntarse o desapuntarse. Las plazas no limitan: quien se
 * apunta pasadas las plazas sigue en la lista, debajo de una marca.
 *
 * En las presenciales y los eventos no hay inscripción: solo quien quiere
 * asistir, para que se sepa quién piensa ir, sin orden ni prioridad.
 */
export const RitualAttendees = ({ ritual, color, actions }: RitualAttendeesProps) => {
  if (isIntention(ritual)) return <RitualIntentions ritual={ritual} color={color} actions={actions} />;

  const attendees = ritual.attendees ?? [];
  const key = ritual.occurrenceKey ?? ritual.id;
  const busy = actions?.busyKey === key;
  const mine = !!actions?.userId && attendees.some((a) => a.userId === actions.userId);
  const started = !!actions && closesAt(ritual) <= actions.now;
  const cancelled = ritual.status === 'cancelado';
  const places = ritual.maxPlayers;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-display uppercase tracking-[0.18em] text-on-surface-muted">
          Apuntados · <span className="tabular-nums">{attendees.length}</span>
        </h3>
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

/**
 * Quién quiere asistir a una partida presencial o a un evento, y el botón para
 * decirlo o retirarlo. Es un botón de alternar: el lector anuncia si está
 * marcado. La lista va por nombre, sin números, porque no da prioridad.
 */
const RitualIntentions = ({ ritual, color, actions }: RitualAttendeesProps) => {
  const attendees = [...(ritual.attendees ?? [])].sort((a, b) => a.username.localeCompare(b.username, 'es'));
  const key = ritual.occurrenceKey ?? ritual.id;
  const busy = actions?.busyKey === key;
  const mine = !!actions?.userId && attendees.some((a) => a.userId === actions.userId);
  const ended = !!actions && closesAt(ritual) <= actions.now;
  const cancelled = ritual.status === 'cancelado';

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-display uppercase tracking-[0.18em] text-on-surface-muted">
        Quieren asistir · <span className="tabular-nums">{attendees.length}</span>
      </h3>

      {attendees.length === 0 ? (
        <p className="text-sm italic text-on-surface-muted">Nadie ha dicho todavía que vaya a asistir.</p>
      ) : (
        <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
          {attendees.map((a) => (
            <li key={a.userId} className="flex items-center gap-1.5 text-sm">
              <img
                src={getAvatarUrl(a.profilePicture)}
                alt=""
                className="w-6 h-6 rounded-full object-cover border border-outline-ghost"
                loading="lazy"
              />
              <span className={a.userId === actions?.userId ? 'text-on-surface font-semibold' : 'text-on-surface/90'}>
                {a.username}
              </span>
              {a.userId === actions?.userId && (
                <span className="text-[10px] uppercase tracking-wider" style={{ color }}>
                  tú
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {!cancelled &&
        (ended ? (
          <p className="text-xs italic text-on-surface-muted">Ya ha terminado.</p>
        ) : !actions?.userId ? (
          <p className="text-xs italic text-on-surface-muted">Identifícate para decir que quieres asistir.</p>
        ) : (
          <div className="flex flex-col gap-1">
            <button
              type="button"
              aria-pressed={mine}
              aria-busy={busy || undefined}
              disabled={busy}
              onClick={() => (mine ? actions.onLeave(ritual) : actions.onSignUp(ritual))}
              className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 border text-xs font-display uppercase tracking-wider transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-1 focus-visible:ring-theme-main"
              style={
                mine
                  ? { borderColor: alpha(color, 0.9), color: 'var(--color-on-surface)', backgroundColor: alpha(color, 0.3) }
                  : { borderColor: alpha(color, 0.6), color, backgroundColor: alpha(color, 0.12) }
              }
            >
              {busy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : mine ? (
                <CalendarCheck className="w-3.5 h-3.5" />
              ) : (
                <CalendarPlus className="w-3.5 h-3.5" />
              )}
              Quiero asistir
            </button>
            <p className="text-[11px] text-on-surface-muted">Solo para saber quién piensa ir: no reserva plaza.</p>
          </div>
        ))}
    </div>
  );
};

export default RitualAttendees;
