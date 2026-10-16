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
import { RUTA_SALA, esSalaLaSecta } from './salaLaSecta';

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
 *
 * El color del tipo de ritual solo identifica (medallón y rótulo); el resto
 * del modal usa el latón de la web.
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
                className="underline underline-offset-4 decoration-theme-main/40 hover:text-gold-bright hover:decoration-theme-main"
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
      <Dialog onClose={onClose} labelledBy={titleId} className="modal-cofre max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Cabecera: medallón con el icono del tipo, rótulo y título */}
        <div className="relative flex items-start gap-4 px-5 sm:px-7 pt-6 pb-5 shrink-0">
          {/* Halo tenue del color del tipo detrás del medallón */}
          <div
            aria-hidden="true"
            className="absolute -left-10 -top-16 w-64 h-48 pointer-events-none"
            style={{ background: `radial-gradient(ellipse at center, ${alpha(style.color, 0.16)}, transparent 70%)` }}
          />
          <span className="medallon relative w-14 h-14">
            <Icon className="w-6 h-6" style={{ color: style.color }} />
          </span>
          <div className="relative flex-1 min-w-0 pt-0.5">
            <p className="flex items-center gap-2 font-ui text-[0.68rem] font-semibold uppercase tracking-[0.22em]" style={{ color: style.color }}>
              <span aria-hidden="true" className="w-1.5 h-1.5 rotate-45" style={{ backgroundColor: style.color }} />
              {style.label}
            </p>
            <h2 id={titleId} className={`mt-1 font-display text-2xl sm:text-3xl leading-tight text-gilded break-words ${cancelled ? 'line-through opacity-70' : ''}`}>
              {ritual.title}
            </h2>
            {cancelled && (
              <p className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 font-ui text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[#f3c4c7] bg-blood/30 border border-blood-bright/50 rounded-sm">
                <Ban className="w-3.5 h-3.5" /> Cancelado
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="relative btn-sello btn-sello-icono shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div aria-hidden="true" className="hairline-gold shrink-0" />

        <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-6 flex flex-col gap-7">
          {/* Ficha: cada dato con su icono dorado */}
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-3 p-4 sm:p-5 bg-background/40 border border-outline-ghost/70 rounded-sm">
            {details.map(({ icon: DetailIcon, term, value }) => (
              <div key={term} className="contents">
                <dt className="inline-flex items-center gap-2 font-ui text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-on-surface-muted pt-1">
                  <DetailIcon className="w-4 h-4 shrink-0 text-theme-main" /> {term}
                </dt>
                <dd className="text-[1.02rem] text-on-surface break-words">{value}</dd>
              </div>
            ))}
          </dl>

          {ritual.description && (
            <section aria-labelledby="ritual-detalle-descripcion">
              <h3 id="ritual-detalle-descripcion" className="sr-only">
                Descripción
              </h3>
              <p className="pl-4 border-l-2 border-theme-main/40 font-['Cormorant_Garamond',serif] italic text-lg text-on-surface/90 leading-relaxed whitespace-pre-line">
                {ritual.description}
              </p>
            </section>
          )}

          {!cancelled && (ritual.link || ritual.villacuervosUrl) && (
            <div className="flex flex-wrap gap-3">
              {ritual.link && (
                // La sala de La Secta se abre en esta web, con rel="opener" para que herede la
                // sesión sin «Recordarme» (vive en sessionStorage), como el botón de Rituales
                <a
                  href={esSalaLaSecta(ritual.link) ? RUTA_SALA : ritual.link}
                  target="_blank"
                  rel={esSalaLaSecta(ritual.link) ? 'opener' : 'noopener noreferrer'}
                  className="btn-runic btn-runic-primary px-4 py-2 text-xs gap-2"
                >
                  {linkLabel(ritual)} <ExternalLink className="w-3.5 h-3.5" />
                  <span className="sr-only"> (se abre en una ventana nueva)</span>
                </a>
              )}
              {ritual.villacuervosUrl && ritual.villacuervosUrl !== ritual.link && (
                <a href={ritual.villacuervosUrl} target="_blank" rel="noopener noreferrer" className="btn-sello">
                  <Feather className="w-3.5 h-3.5" style={{ color: VILLACUERVOS_COLOR }} /> Ver en Villacuervos <ExternalLink className="w-3.5 h-3.5" />
                  <span className="sr-only"> (se abre en una ventana nueva)</span>
                </a>
              )}
            </div>
          )}

          {ritual.signupsEnabled && (
            <section>
              <RitualAttendees ritual={ritual} actions={signup} />
            </section>
          )}

          {lists.length > 0 && (
            <section aria-labelledby="ritual-detalle-listas" className="flex flex-col gap-3">
              <h3 id="ritual-detalle-listas" className="rotulo">
                Inscripción en Villacuervos
              </h3>
              <ul className="flex flex-col gap-3">
                {lists.map((list) => {
                  const full = isFull(list);
                  const ratio = list.maxPlayers ? Math.min(1, list.playerCount / list.maxPlayers) : 0;
                  return (
                    <li key={`${list.order}-${list.name}`}>
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="text-on-surface/90">{list.name}</span>
                        <span className={`tabular-nums text-xs shrink-0 ${full ? 'text-blood-bright' : 'text-on-surface-muted'}`}>
                          {full ? 'Completa · ' : ''}
                          {list.maxPlayers === undefined ? `${list.playerCount} apuntados` : `${list.playerCount} de ${list.maxPlayers}`}
                        </span>
                      </div>
                      {list.maxPlayers !== undefined && (
                        <div className="mt-1.5 h-1.5 bg-background/70 border border-outline-ghost/60 rounded-full overflow-hidden" aria-hidden="true">
                          <div
                            className={`h-full rounded-full transition-all ${full ? 'bg-blood-bright' : 'bg-gradient-to-r from-gold-deep to-gold-bright'}`}
                            style={{ width: `${ratio * 100}%` }}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {ritual.villacuervosUrl && <p className="text-xs italic text-on-surface-muted">Para apuntarte, entra en Villacuervos.</p>}
            </section>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 px-5 sm:px-7 py-4 border-t border-outline-ghost/70 bg-background/50 shrink-0">
          <button type="button" onClick={copyLink} className="btn-sello">
            <Link2 className="w-3.5 h-3.5" /> Copiar enlace
          </button>
          <span role="status" className="text-xs italic text-on-surface-muted">
            {copyStatus}
          </span>

          {editable && (
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={() => onEdit(ritual)} className="btn-sello">
                <Pencil className="w-3.5 h-3.5" /> Modificar
              </button>
              <button type="button" onClick={() => onDelete(ritual)} className="btn-sello btn-sello-peligro">
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
