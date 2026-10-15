import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Ban,
  CalendarDays,
  ExternalLink,
  Feather,
  Link2,
  MapPin,
  Pencil,
  Repeat,
  ScrollText,
  Trash2,
  UserRound,
  Users,
  X
} from 'lucide-react';
import type { Ritual } from '../../utils/ritualsApi';
import Dialog from '../Dialog';
import { RITUAL_KINDS, alpha, kindOf } from './ritualKinds';
import { describeRecurrence, formatLongDay, formatTime, isMultiDay, ritualPath } from './ritualDates';
import { isFull } from './ritualSignups';
import RitualAttendees, { type SignupActions } from './RitualAttendees';

const VILLACUERVOS_COLOR = RITUAL_KINDS.online_villacuervos.color;

function linkLabel(ritual: Ritual): string {
  if (ritual.source === 'villacuervos') return 'Ver en Villacuervos';
  if (ritual.type === 'partida_online') return 'Entrar en la sala';
  return 'Más información';
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "Jueves, 22 de octubre · 21:30 – 00:00", o el intervalo entero si dura varios días. */
function describeWhen(ritual: Ritual): string {
  const start = new Date(ritual.startsAt);
  if (isMultiDay(ritual)) {
    const end = new Date(ritual.endsAt!);
    return `Del ${formatLongDay(start)} a las ${formatTime(ritual.startsAt)} al ${formatLongDay(end)} a las ${formatTime(ritual.endsAt!)}`;
  }
  const hours = ritual.endsAt ? `${formatTime(ritual.startsAt)} – ${formatTime(ritual.endsAt)}` : formatTime(ritual.startsAt);
  return `${capitalize(formatLongDay(start))} · ${hours}`;
}

interface RitualDetailModalProps {
  ritual: Ritual;
  canManage: boolean;
  signup: SignupActions;
  onClose: () => void;
  onEdit: (ritual: Ritual) => void;
  onDelete: (ritual: Ritual) => void;
}

/**
 * Toda la información de un ritual, en un modal con su propia dirección
 * (?dia=…&ritual=…) para poder enlazarlo. Aquí está la lista completa de
 * quién va y el botón para apuntarse o decir que se quiere asistir.
 */
export const RitualDetailModal = ({ ritual, canManage, signup, onClose, onEdit, onDelete }: RitualDetailModalProps) => {
  const style = RITUAL_KINDS[kindOf(ritual)];
  const Icon = style.icon;
  const cancelled = ritual.status === 'cancelado';
  const editable = canManage && ritual.source === 'secta';
  const repeats = describeRecurrence(ritual);
  const lists = [...(ritual.signupLists ?? [])].sort((a, b) => a.order - b.order);
  const titleId = 'ritual-detalle-titulo';

  const [copyStatus, setCopyStatus] = useState('');
  const copyTimer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  const copyLink = async () => {
    const url = `${window.location.origin}${ritualPath(ritual)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus('Enlace copiado');
    } catch {
      setCopyStatus('No se pudo copiar: el enlace está en la barra de direcciones');
    }
    window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopyStatus(''), 4000);
  };

  const details: Array<{ icon: typeof Icon; term: string; value: ReactNode }> = [
    { icon: CalendarDays, term: 'Cuándo', value: describeWhen(ritual) },
    ...(repeats ? [{ icon: Repeat, term: 'Se repite', value: repeats }] : []),
    ...(ritual.location
      ? [
          {
            icon: MapPin,
            term: 'Dónde',
            value: (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ritual.location)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 decoration-outline-ghost hover:text-theme-main"
              >
                {ritual.location}
                <span className="sr-only"> (mapa, se abre en una ventana nueva)</span>
              </a>
            )
          }
        ]
      : []),
    ...(ritual.scriptName ? [{ icon: ScrollText, term: 'Guion', value: ritual.scriptName }] : []),
    ...(ritual.storytellerUsername ? [{ icon: Feather, term: 'Narra', value: ritual.storytellerUsername }] : []),
    ...(ritual.maxPlayers ? [{ icon: Users, term: 'Plazas', value: String(ritual.maxPlayers) }] : []),
    ...(ritual.createdByUsername && ritual.source === 'secta'
      ? [{ icon: UserRound, term: 'Convoca', value: ritual.createdByUsername }]
      : [])
  ];

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <Dialog
        onClose={onClose}
        labelledBy={titleId}
        className="bg-theme-container border border-outline-ghost rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
      >
        <div
          className="flex items-start gap-3 p-5 border-b border-outline-ghost/50 bg-surface-container/40 shrink-0"
          style={{ boxShadow: `inset 0 3px 0 ${style.color}` }}
        >
          <div
            className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center"
            style={{
              background: `radial-gradient(circle at 35% 30%, ${alpha(style.color, 0.45)}, ${alpha(style.color, 0.12)} 70%)`,
              border: `1px solid ${alpha(style.color, 0.6)}`
            }}
          >
            <Icon className="w-5 h-5" style={{ color: style.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-display uppercase tracking-[0.18em]" style={{ color: style.color }}>
              {style.label}
            </p>
            <h2 id={titleId} className={`font-display text-xl sm:text-2xl text-on-surface leading-tight break-words ${cancelled ? 'line-through' : ''}`}>
              {ritual.title}
            </h2>
            {cancelled && (
              <p className="inline-flex items-center gap-1 text-sm text-red-300 mt-1">
                <Ban className="w-4 h-4" /> Cancelado
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="shrink-0 p-1 text-on-surface-muted hover:text-on-surface">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 flex flex-col gap-6">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm">
            {details.map(({ icon: DetailIcon, term, value }) => (
              <div key={term} className="contents">
                <dt className="inline-flex items-center gap-2 text-on-surface-muted">
                  <DetailIcon className="w-4 h-4 shrink-0" style={{ color: style.color }} /> {term}
                </dt>
                <dd className="text-on-surface break-words">{value}</dd>
              </div>
            ))}
          </dl>

          {ritual.description && (
            <section aria-labelledby="ritual-detalle-descripcion">
              <h3 id="ritual-detalle-descripcion" className="sr-only">
                Descripción
              </h3>
              <p className="text-[15px] text-on-surface/90 font-body leading-relaxed whitespace-pre-line">{ritual.description}</p>
            </section>
          )}

          {!cancelled && (ritual.link || ritual.villacuervosUrl) && (
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {ritual.link && (
                <a
                  href={ritual.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
                  style={{ color: style.color }}
                >
                  {linkLabel(ritual)} <ExternalLink className="w-3.5 h-3.5" />
                  <span className="sr-only"> (se abre en una ventana nueva)</span>
                </a>
              )}
              {ritual.villacuervosUrl && ritual.villacuervosUrl !== ritual.link && (
                <a
                  href={ritual.villacuervosUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
                  style={{ color: VILLACUERVOS_COLOR }}
                >
                  <Feather className="w-3.5 h-3.5" /> Ver en Villacuervos <ExternalLink className="w-3.5 h-3.5" />
                  <span className="sr-only"> (se abre en una ventana nueva)</span>
                </a>
              )}
            </div>
          )}

          {ritual.signupsEnabled && (
            <section className="pt-4 border-t border-outline-ghost/50">
              <RitualAttendees ritual={ritual} color={style.color} actions={signup} />
            </section>
          )}

          {lists.length > 0 && (
            <section aria-labelledby="ritual-detalle-listas" className="pt-4 border-t border-outline-ghost/50 flex flex-col gap-2.5">
              <h3 id="ritual-detalle-listas" className="text-xs font-display uppercase tracking-[0.18em] text-on-surface-muted">
                Inscripción en Villacuervos
              </h3>
              <ul className="flex flex-col gap-2.5">
                {lists.map((list) => {
                  const full = isFull(list);
                  const ratio = list.maxPlayers ? Math.min(1, list.playerCount / list.maxPlayers) : 0;
                  return (
                    <li key={`${list.order}-${list.name}`}>
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="text-on-surface/90">{list.name}</span>
                        <span className={`tabular-nums text-xs shrink-0 ${full ? 'text-red-300' : 'text-on-surface-muted'}`}>
                          {full ? 'Completa · ' : ''}
                          {list.maxPlayers === undefined ? `${list.playerCount} apuntados` : `${list.playerCount} de ${list.maxPlayers}`}
                        </span>
                      </div>
                      {list.maxPlayers !== undefined && (
                        <div className="mt-1 h-1.5 bg-outline-ghost/60 overflow-hidden" aria-hidden="true">
                          <div
                            className="h-full transition-all"
                            style={{ width: `${ratio * 100}%`, backgroundColor: full ? '#f87171' : style.color }}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {ritual.villacuervosUrl && (
                <p className="text-xs text-on-surface-muted">Para apuntarte, entra en Villacuervos.</p>
              )}
            </section>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 p-4 sm:px-6 border-t border-outline-ghost/50 bg-surface-container/40 shrink-0">
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-outline-ghost text-xs font-display uppercase tracking-wider text-on-surface-muted hover:text-theme-main hover:border-theme-main/50 transition-colors"
          >
            <Link2 className="w-3.5 h-3.5" /> Copiar enlace
          </button>
          <span role="status" className="text-xs text-on-surface-muted">
            {copyStatus}
          </span>

          {editable && (
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => onEdit(ritual)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-outline-ghost text-xs font-display uppercase tracking-wider text-on-surface-muted hover:text-theme-main hover:border-theme-main/50 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" /> Modificar
              </button>
              <button
                type="button"
                onClick={() => onDelete(ritual)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-outline-ghost text-xs font-display uppercase tracking-wider text-on-surface-muted hover:text-red-400 hover:border-red-400/50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Borrar
              </button>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
};

export default RitualDetailModal;
