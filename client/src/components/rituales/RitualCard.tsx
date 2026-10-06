import { Clock, ExternalLink, MapPin, Pencil, ScrollText, Trash2, Users, Feather, Ban, Repeat } from 'lucide-react';
import type { Ritual } from '../../utils/ritualsApi';
import { RITUAL_KINDS, alpha, kindOf } from './ritualKinds';
import { describeRecurrence, formatShortDate, formatTime, isMultiDay } from './ritualDates';
import { formatCount, isFull } from './ritualSignups';
import RitualAttendees, { type SignupActions } from './RitualAttendees';

const VILLACUERVOS_COLOR = RITUAL_KINDS.online_villacuervos.color;

interface RitualCardProps {
  ritual: Ritual;
  /** El que se acaba de pulsar en el calendario: se resalta. */
  highlighted?: boolean;
  canManage: boolean;
  /** Para apuntarse a las partidas online de La Secta. */
  signup?: SignupActions;
  onEdit: (ritual: Ritual) => void;
  onDelete: (ritual: Ritual) => void;
}

function linkLabel(ritual: Ritual): string {
  if (ritual.source === 'villacuervos') return 'Ver en Villacuervos';
  if (ritual.type === 'partida_online') return 'Entrar en la sala';
  return 'Más información';
}

/**
 * Un ritual como un sello de lacre: el emblema de su clase a la izquierda y los
 * datos que hacen falta para acudir a la derecha.
 */
export const RitualCard = ({ ritual, highlighted = false, canManage, signup, onEdit, onDelete }: RitualCardProps) => {
  const style = RITUAL_KINDS[kindOf(ritual)];
  const Icon = style.icon;
  const cancelled = ritual.status === 'cancelado';
  const editable = canManage && ritual.source === 'secta';

  const when = isMultiDay(ritual)
    ? `${formatShortDate(ritual.startsAt)} ${formatTime(ritual.startsAt)} — ${formatShortDate(ritual.endsAt!)} ${formatTime(ritual.endsAt!)}`
    : ritual.endsAt
      ? `${formatTime(ritual.startsAt)} — ${formatTime(ritual.endsAt)}`
      : formatTime(ritual.startsAt);

  const repeats = describeRecurrence(ritual);

  return (
    <article
      id={`ritual-${ritual.occurrenceKey ?? ritual.id}`}
      className={`relative flex gap-3 p-3 md:p-4 border bg-surface-container-low/70 transition-all duration-300 scroll-mt-32 ${cancelled ? 'opacity-60' : ''}`}
      style={{
        borderColor: alpha(style.color, highlighted ? 0.9 : 0.3),
        boxShadow: highlighted
          ? `inset 3px 0 0 ${style.color}, 0 0 22px ${alpha(style.color, 0.3)}`
          : `inset 3px 0 0 ${style.color}`
      }}
    >
      <div
        className="shrink-0 w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center"
        style={{
          background: `radial-gradient(circle at 35% 30%, ${alpha(style.color, 0.45)}, ${alpha(style.color, 0.12)} 70%)`,
          border: `1px solid ${alpha(style.color, 0.6)}`,
          boxShadow: `0 0 14px ${alpha(style.color, 0.25)}`
        }}
      >
        <Icon className="w-5 h-5" style={{ color: style.color }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-display uppercase tracking-[0.18em]" style={{ color: style.color }}>
              {style.label}
            </p>
            <h4 className={`font-body text-lg leading-snug text-on-surface ${cancelled ? 'line-through' : ''}`}>
              {ritual.title}
            </h4>
          </div>

          {editable && (
            <div className="flex gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onEdit(ritual)}
                title="Modificar"
                className="p-1.5 text-on-surface-muted hover:text-theme-main transition-colors"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(ritual)}
                title="Borrar"
                className="p-1.5 text-on-surface-muted hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {cancelled && (
          <p className="inline-flex items-center gap-1 text-xs text-red-300 mt-1">
            <Ban className="w-3.5 h-3.5" /> Cancelado
          </p>
        )}

        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-on-surface-muted">
          <li className="inline-flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> {when}
          </li>
          {repeats && (
            <li className="inline-flex items-center gap-1.5">
              <Repeat className="w-3.5 h-3.5" /> {repeats}
            </li>
          )}
          {ritual.scriptName && (
            <li className="inline-flex items-center gap-1.5">
              <ScrollText className="w-3.5 h-3.5" /> {ritual.scriptName}
            </li>
          )}
          {ritual.storytellerUsername && (
            <li className="inline-flex items-center gap-1.5">
              <Feather className="w-3.5 h-3.5" /> Narra {ritual.storytellerUsername}
            </li>
          )}
          {ritual.maxPlayers && !ritual.signupLists?.length && !ritual.signupsEnabled && (
            <li className="inline-flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> {ritual.maxPlayers} plazas
            </li>
          )}
          {ritual.location && (
            <li className="inline-flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ritual.location)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-theme-main underline-offset-2 hover:underline"
              >
                {ritual.location}
              </a>
            </li>
          )}
        </ul>

        {ritual.signupsEnabled && <RitualAttendees ritual={ritual} color={style.color} actions={signup} />}

        {!!ritual.signupLists?.length && (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-[10px] font-display uppercase tracking-[0.18em] text-on-surface-muted">Inscripción</p>
            {ritual.signupLists.map((list) => {
              const full = isFull(list);
              const ratio = list.maxPlayers ? Math.min(1, list.playerCount / list.maxPlayers) : 0;
              return (
                <div key={`${list.order}-${list.name}`}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="text-on-surface/90 truncate">{list.name}</span>
                    <span className={`tabular-nums text-xs shrink-0 ${full ? 'text-red-300' : 'text-on-surface-muted'}`}>
                      {full ? 'Completa · ' : ''}
                      {formatCount(list)}
                      {list.maxPlayers === undefined ? ' apuntados' : ''}
                    </span>
                  </div>
                  {list.maxPlayers !== undefined && (
                    <div className="mt-1 h-1 bg-outline-ghost/60 overflow-hidden" aria-hidden="true">
                      <div
                        className="h-full transition-all"
                        style={{ width: `${ratio * 100}%`, backgroundColor: full ? '#f87171' : style.color }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {ritual.description && (
          <p className="mt-2 text-sm text-on-surface/80 font-body leading-relaxed whitespace-pre-line">
            {ritual.description}
          </p>
        )}

        {!cancelled && (ritual.link || ritual.villacuervosUrl) && (
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
            {ritual.link && (
              <a
                href={ritual.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
                style={{ color: style.color }}
              >
                {linkLabel(ritual)} <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            {ritual.villacuervosUrl && (
              <a
                href={ritual.villacuervosUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
                style={{ color: VILLACUERVOS_COLOR }}
              >
                <Feather className="w-3.5 h-3.5" /> Ver en Villacuervos <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}
      </div>
    </article>
  );
};

export default RitualCard;
