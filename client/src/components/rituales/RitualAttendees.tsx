import { CalendarCheck, CalendarPlus, CalendarX, Loader2, UserMinus, UserPlus } from 'lucide-react';
import type { Ritual } from '../../utils/ritualsApi';
import { getAvatarUrl } from '../../utils/api';
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
  /** Sin uso desde el rediseño: los botones y marcas van en el latón de la web. */
  color?: string;
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

const avatarClass = 'w-7 h-7 rounded-full object-cover ring-1 ring-theme-main/40 ring-offset-1 ring-offset-surface';
const nota = 'text-xs italic text-on-surface-muted';

/** Marca «tú» junto al nombre de quien mira. */
const Tu = () => (
  <span className="px-1.5 py-px font-ui text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-theme-main border border-theme-main/40 rounded-sm shrink-0">
    tú
  </span>
);

/**
 * La gente apuntada a una partida de La Secta, en el orden en que se apuntó, y
 * el botón para apuntarse o desapuntarse. Las plazas no limitan: quien se
 * apunta pasadas las plazas sigue en la lista, debajo de una marca.
 *
 * En las presenciales y los eventos no hay inscripción: solo quien quiere
 * asistir, para que se sepa quién piensa ir, sin orden ni prioridad.
 */
export const RitualAttendees = ({ ritual, actions }: RitualAttendeesProps) => {
  if (isIntention(ritual)) return <RitualIntentions ritual={ritual} actions={actions} />;

  const attendees = ritual.attendees ?? [];
  const key = ritual.occurrenceKey ?? ritual.id;
  const busy = actions?.busyKey === key;
  const mine = !!actions?.userId && attendees.some((a) => a.userId === actions.userId);
  const started = !!actions && closesAt(ritual) <= actions.now;
  const cancelled = ritual.status === 'cancelado';
  const places = ritual.maxPlayers;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <h3 className="rotulo flex-1">
          Apuntados · <span className="tabular-nums">{attendees.length}</span>
        </h3>
        {places && <span className="font-ui text-[0.68rem] tracking-[0.14em] uppercase text-on-surface-muted tabular-nums">{places} plazas</span>}
      </div>

      {attendees.length === 0 ? (
        <p className="text-sm italic text-on-surface-muted">Nadie se ha apuntado todavía.</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {attendees.map((a, i) => (
            <li key={a.userId} className="contents">
              {/* Marca donde se acaban las plazas: quien va después se apuntó cuando ya estaban cubiertas */}
              {places && i === places && (
                <span className="flex items-center gap-2 font-ui text-[0.6rem] uppercase tracking-[0.16em] text-blood-bright/90 my-1.5">
                  <span className="flex-1 border-t border-dashed border-blood-bright/40" />
                  Por encima de las {places} plazas
                  <span className="flex-1 border-t border-dashed border-blood-bright/40" />
                </span>
              )}
              <span className="flex items-center gap-2.5 text-[0.98rem]">
                <span className="w-6 text-right font-ui text-xs tabular-nums text-theme-main/70">{i + 1}</span>
                <img src={getAvatarUrl(a.profilePicture)} alt="" className={avatarClass} loading="lazy" />
                <span className={`truncate ${a.userId === actions?.userId ? 'text-on-surface-bright font-semibold' : 'text-on-surface/90'}`}>
                  {a.username}
                </span>
                {a.userId === actions?.userId && <Tu />}
              </span>
            </li>
          ))}
        </ol>
      )}

      {!cancelled &&
        (started ? (
          <p className={nota}>La partida ya ha empezado.</p>
        ) : !actions?.userId ? (
          <p className={nota}>Identifícate para apuntarte.</p>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => (mine ? actions.onLeave(ritual) : actions.onSignUp(ritual))}
            className={`self-start gap-2 ${mine ? 'btn-sello btn-sello-peligro' : 'btn-runic btn-runic-primary px-5 py-2 text-xs'}`}
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : mine ? (
              <UserMinus className="w-4 h-4" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            {mine ? 'Desapuntarme' : 'Apuntarme'}
          </button>
        ))}
    </div>
  );
};

/**
 * Quién quiere asistir a una partida presencial o a un evento, y el botón para
 * decirlo («Quiero asistir») o retirarlo («Ya no puedo asistir»). La lista va
 * por nombre, sin números, porque no da prioridad.
 */
const RitualIntentions = ({ ritual, actions }: RitualAttendeesProps) => {
  const attendees = [...(ritual.attendees ?? [])].sort((a, b) => a.username.localeCompare(b.username, 'es'));
  const key = ritual.occurrenceKey ?? ritual.id;
  const busy = actions?.busyKey === key;
  const mine = !!actions?.userId && attendees.some((a) => a.userId === actions.userId);
  const ended = !!actions && closesAt(ritual) <= actions.now;
  const cancelled = ritual.status === 'cancelado';

  return (
    <div className="flex flex-col gap-3">
      <h3 className="rotulo">
        Quieren asistir · <span className="tabular-nums">{attendees.length}</span>
      </h3>

      {attendees.length === 0 ? (
        <p className="text-sm italic text-on-surface-muted">Nadie ha dicho todavía que vaya a asistir.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {attendees.map((a) => (
            <li
              key={a.userId}
              className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-background/50 border border-outline-ghost/80 text-[0.95rem]"
            >
              <img src={getAvatarUrl(a.profilePicture)} alt="" className={avatarClass} loading="lazy" />
              <span className={a.userId === actions?.userId ? 'text-on-surface-bright font-semibold' : 'text-on-surface/90'}>
                {a.username}
              </span>
              {a.userId === actions?.userId && <Tu />}
            </li>
          ))}
        </ul>
      )}

      {!cancelled &&
        (ended ? (
          <p className={nota}>Ya ha terminado.</p>
        ) : !actions?.userId ? (
          <p className={nota}>Identifícate para decir que quieres asistir.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {/* El texto del botón dice lo que hace: «Quiero asistir» (llamada principal, en dorado) o, si ya vas,
                «Ya no puedo asistir». Por eso no es un botón de alternar: el estado lo dice el aviso de al lado. */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {mine && (
                <p className="inline-flex items-center gap-1.5 font-ui text-xs font-semibold uppercase tracking-[0.14em] text-gold-bright">
                  <CalendarCheck className="w-4 h-4" /> Vas a asistir
                </p>
              )}
              <button
                type="button"
                aria-busy={busy || undefined}
                disabled={busy}
                onClick={() => (mine ? actions.onLeave(ritual) : actions.onSignUp(ritual))}
                className={`gap-2 ${mine ? 'btn-sello btn-sello-peligro' : 'btn-runic btn-runic-primary px-5 py-2 text-xs'}`}
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : mine ? (
                  <CalendarX className="w-4 h-4" />
                ) : (
                  <CalendarPlus className="w-4 h-4" />
                )}
                {mine ? 'Ya no puedo asistir' : 'Quiero asistir'}
              </button>
            </div>
            <p className={nota}>Solo para saber quién piensa ir: no reserva plaza.</p>
          </div>
        ))}
    </div>
  );
};

export default RitualAttendees;
