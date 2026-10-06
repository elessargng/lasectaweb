import { useEffect, useState, type FormEvent } from 'react';
import { Feather, Repeat, Sparkles, X } from 'lucide-react';
import Button from '../Button';
import type { Ritual, RitualInput, RitualStatus, RitualType, Storyteller } from '../../utils/ritualsApi';
import { RITUAL_KINDS, alpha, kindFromParts } from './ritualKinds';
import { describeMonthlyPosition, toLocalDateInput, toLocalInput } from './ritualDates';

interface RitualFormModalProps {
  isOpen: boolean;
  ritual: Ritual | null;
  /** Día propuesto al convocar desde una casilla del calendario. */
  initialDay: Date | null;
  storytellers: Storyteller[];
  onClose: () => void;
  onSave: (input: RitualInput) => Promise<void>;
}

const TYPE_OPTIONS: Array<{ type: RitualType; label: string; hint: string }> = [
  { type: 'partida_online', label: 'Partida online', hint: 'En botc.app' },
  { type: 'partida_presencial', label: 'Partida presencial', hint: 'Cara a cara' },
  { type: 'jornada', label: 'Evento / Jornadas', hint: 'Uno o varios días' }
];

/** Periodicidades habituales en días; cualquier otra se escribe a mano. */
const RECURRENCE_PRESETS = [7, 14];

const RECURRENCE_OPTIONS: Array<[string, string]> = [
  ['', 'No se repite'],
  ...RECURRENCE_PRESETS.map((d): [string, string] => [String(d), `Cada ${d} días`]),
  ['mes', 'Cada mes'],
  ['otra', 'Otra']
];

const inputClass =
  'w-full bg-surface-container border border-outline-ghost rounded-xl px-4 py-2.5 text-on-surface focus:outline-none focus:border-theme-main transition-colors text-sm';
const labelClass = 'block text-xs font-display tracking-wider text-on-surface-muted uppercase mb-1';

/** Sala de La Secta en botc.app: el enlace que se propone al convocar una partida online. */
const DEFAULT_ONLINE_LINK = 'https://botc.app/join/lasecta';

/** Hora que se propone al convocar: las partidas online, a las 22:00; el resto, a las 21:30. */
function defaultTime(type: RitualType): string {
  return type === 'partida_online' ? '22:00' : '21:30';
}

function defaultStart(day: Date | null, type: RitualType): string {
  const base = day ? new Date(day) : new Date();
  const [h, m] = defaultTime(type).split(':').map(Number);
  base.setHours(h, m, 0, 0);
  return toLocalInput(base);
}

export const RitualFormModal = ({ isOpen, ritual, initialDay, storytellers, onClose, onSave }: RitualFormModalProps) => {
  const [type, setType] = useState<RitualType>('partida_online');
  const [alsoInVillacuervos, setAlsoInVillacuervos] = useState(false);
  /** '' no se repite, un número de días, 'mes', u 'otra' para escribir los días a mano. */
  const [recurrence, setRecurrence] = useState('');
  const [customDays, setCustomDays] = useState('');
  const [recurrenceUntil, setRecurrenceUntil] = useState('');
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [location, setLocation] = useState('');
  const [link, setLink] = useState('');
  const [scriptName, setScriptName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('');
  const [storytellerId, setStorytellerId] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<RitualStatus>('programado');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setType(ritual?.type ?? 'partida_online');
    setAlsoInVillacuervos(false);
    const days = ritual?.recurrenceDays;
    setRecurrence(ritual?.recurrenceMonths ? 'mes' : !days ? '' : RECURRENCE_PRESETS.includes(days) ? String(days) : 'otra');
    setCustomDays(days && !RECURRENCE_PRESETS.includes(days) ? String(days) : '');
    setRecurrenceUntil(toLocalDateInput(ritual?.recurrenceUntil));
    setTitle(ritual?.title ?? '');
    // Al modificar una repetición de una serie se modifica la serie entera.
    setStartsAt(ritual ? toLocalInput(ritual.seriesStartsAt ?? ritual.startsAt) : defaultStart(initialDay, 'partida_online'));
    setEndsAt(toLocalInput(ritual?.endsAt));
    setLocation(ritual?.location ?? '');
    setLink(ritual ? ritual.link ?? '' : DEFAULT_ONLINE_LINK);
    setScriptName(ritual?.scriptName ?? '');
    setMaxPlayers(ritual?.maxPlayers ? String(ritual.maxPlayers) : '');
    setStorytellerId(ritual?.storytellerId ?? '');
    setDescription(ritual?.description ?? '');
    setStatus(ritual?.status ?? 'programado');
    setFormError(null);
  }, [isOpen, ritual, initialDay]);

  if (!isOpen) return null;

  /**
   * Al convocar, los valores propuestos (hora y enlace) siguen al tipo
   * mientras no se hayan tocado: lo que se haya escrito a mano se respeta.
   */
  const changeType = (next: RitualType) => {
    if (!ritual) {
      if (startsAt.endsWith(`T${defaultTime(type)}`)) setStartsAt(`${startsAt.slice(0, 10)}T${defaultTime(next)}`);
      if (next === 'partida_online' && !link.trim()) setLink(DEFAULT_ONLINE_LINK);
      if (next !== 'partida_online' && link === DEFAULT_ONLINE_LINK) setLink('');
    }
    setType(next);
  };

  const isOnline = type === 'partida_online';
  const isInPerson = type === 'partida_presencial';
  const isGame = type !== 'jornada';
  const accent = RITUAL_KINDS[kindFromParts(type, 'secta')].color;
  const villacuervosColor = RITUAL_KINDS.online_villacuervos.color;
  const recurrenceDays =
    !isInPerson || !recurrence || recurrence === 'mes' ? null : Number(recurrence === 'otra' ? customDays : recurrence);
  const recurrenceMonths = isInPerson && recurrence === 'mes' ? 1 : null;
  const startDate = startsAt ? new Date(startsAt) : null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!title.trim()) return setFormError('El ritual necesita un título.');
    if (!startsAt) return setFormError(isGame ? 'Indica cuándo se convoca.' : 'Indica cuándo empieza.');
    if (recurrenceDays !== null && (!Number.isInteger(recurrenceDays) || recurrenceDays < 1)) {
      return setFormError('Indica cada cuántos días se repite.');
    }

    try {
      setSubmitting(true);
      await onSave({
        type,
        title: title.trim(),
        description: description.trim() || null,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: !isGame && endsAt ? new Date(endsAt).toISOString() : null,
        location: isOnline ? null : location.trim() || null,
        link: link.trim() || null,
        scriptName: isGame ? scriptName.trim() || null : null,
        maxPlayers: isGame && maxPlayers ? Number(maxPlayers) : null,
        storytellerId: isGame ? storytellerId || null : null,
        recurrenceDays,
        recurrenceMonths,
        // Hasta el final de ese día, en hora local.
        recurrenceUntil:
          (recurrenceDays || recurrenceMonths) && recurrenceUntil ? new Date(`${recurrenceUntil}T23:59:59`).toISOString() : null,
        status,
        alsoInVillacuervos: !ritual && isOnline && alsoInVillacuervos
      });
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el ritual.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <div className="bg-theme-container border border-outline-ghost rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-outline-ghost/50 bg-surface-container/40 shrink-0">
          <h3 className="text-xl font-display text-on-surface font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5" style={{ color: accent }} />
            <span>{ritual ? 'Modificar ritual' : 'Convocar un ritual'}</span>
          </h3>
          <button onClick={onClose} className="text-on-surface-muted hover:text-on-surface">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 flex flex-col gap-5">
          {formError && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{formError}</div>
          )}

          {/* Clase de ritual */}
          <div>
            <span className={labelClass}>Tipo de ritual</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {TYPE_OPTIONS.map((opt) => {
                const style = RITUAL_KINDS[kindFromParts(opt.type, 'secta')];
                const Icon = style.icon;
                const active = type === opt.type;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => changeType(opt.type)}
                    className="flex sm:flex-col items-center gap-2 sm:gap-1 p-3 rounded-xl border text-left sm:text-center transition-all"
                    style={{
                      borderColor: active ? style.color : 'var(--color-outline-ghost)',
                      backgroundColor: active ? alpha(style.color, 0.12) : 'transparent',
                      boxShadow: active ? `0 0 16px ${alpha(style.color, 0.2)}` : 'none'
                    }}
                  >
                    <Icon className="w-5 h-5 shrink-0" style={{ color: style.color }} />
                    <span className="text-sm font-semibold text-on-surface">{opt.label}</span>
                    <span className="text-xs text-on-surface-muted">{opt.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {isOnline && !ritual && (
            <label
              className="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors"
              style={{
                borderColor: alsoInVillacuervos ? villacuervosColor : 'var(--color-outline-ghost)',
                backgroundColor: alsoInVillacuervos ? alpha(villacuervosColor, 0.08) : 'transparent'
              }}
            >
              <input
                type="checkbox"
                checked={alsoInVillacuervos}
                onChange={(e) => setAlsoInVillacuervos(e.target.checked)}
                className="mt-1 accent-sky-300"
              />
              <span>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-on-surface">
                  <Feather className="w-4 h-4" style={{ color: villacuervosColor }} />
                  Crear también en Villacuervos
                </span>
                <span className="block text-xs text-on-surface-muted mt-0.5">
                  Se publica la partida en Villacuervos con el mismo título, fecha, enlace y plazas.
                </span>
              </span>
            </label>
          )}

          {isOnline && ritual?.villacuervosUrl && (
            <p className="flex items-center gap-1.5 text-xs text-on-surface-muted">
              <Feather className="w-3.5 h-3.5" style={{ color: villacuervosColor }} />
              Publicada también en Villacuervos. Los cambios que hagas aquí no se trasladan allí.
            </p>
          )}

          <div>
            <label className={labelClass}>Título</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isGame ? 'Ej: Noche de Trouble Brewing' : 'Ej: Jornadas de otoño en el Ateneo'}
              className={inputClass}
            />
          </div>

          {isGame ? (
            <div>
              <label className={labelClass}>Convocatoria</label>
              <input type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputClass} />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Empieza</label>
                <input type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Termina</label>
                <input type="datetime-local" value={endsAt} min={startsAt} onChange={(e) => setEndsAt(e.target.value)} className={inputClass} />
              </div>
            </div>
          )}

          {isInPerson && (
            <div className="flex flex-col gap-3 p-4 rounded-xl border border-outline-ghost/60 bg-surface-container/30">
              <span className="flex items-center gap-1.5 text-xs font-display tracking-wider uppercase text-on-surface-muted">
                <Repeat className="w-3.5 h-3.5" style={{ color: accent }} /> Periodicidad
              </span>
              <div className="flex flex-wrap gap-2">
                {RECURRENCE_OPTIONS.map(
                  ([value, label]) => {
                    const active = recurrence === value;
                    return (
                      <button
                        key={value || 'nunca'}
                        type="button"
                        onClick={() => setRecurrence(value)}
                        className="px-3 py-1.5 text-sm rounded-full border transition-colors"
                        style={{
                          borderColor: active ? accent : 'var(--color-outline-ghost)',
                          color: active ? accent : undefined,
                          backgroundColor: active ? alpha(accent, 0.12) : 'transparent'
                        }}
                      >
                        {label}
                      </button>
                    );
                  }
                )}
              </div>
              {recurrence === 'mes' && startDate && !isNaN(startDate.getTime()) && (
                <p className="text-xs text-on-surface-muted">
                  Se repetirá {describeMonthlyPosition(startDate)} de cada mes, a la misma hora.
                </p>
              )}
              {recurrence && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {recurrence === 'otra' && (
                    <div>
                      <label className={labelClass}>Repetir cada (días)</label>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={customDays}
                        onChange={(e) => setCustomDays(e.target.value)}
                        placeholder="21"
                        className={inputClass}
                      />
                    </div>
                  )}
                  <div>
                    <label className={labelClass}>Hasta (opcional)</label>
                    <input
                      type="date"
                      value={recurrenceUntil}
                      min={startsAt.slice(0, 10)}
                      onChange={(e) => setRecurrenceUntil(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {!isOnline && (
            <div>
              <label className={labelClass}>Lugar</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Dirección o nombre del local"
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label className={labelClass}>
              {isOnline ? 'Enlace a la sala de botc.app' : 'Enlace (opcional)'}
            </label>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder={isOnline ? 'https://botc.app/join/...' : 'https://...'}
              className={inputClass}
            />
          </div>

          {isGame && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1">
                <label className={labelClass}>Guion</label>
                <input
                  type="text"
                  value={scriptName}
                  onChange={(e) => setScriptName(e.target.value)}
                  placeholder="Trouble Brewing"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Narrador</label>
                <select value={storytellerId} onChange={(e) => setStorytellerId(e.target.value)} className={inputClass}>
                  <option value="">Sin asignar</option>
                  {storytellers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.username}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Plazas</label>
                <input
                  type="number"
                  min={1}
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(e.target.value)}
                  placeholder="15"
                  className={inputClass}
                />
              </div>
            </div>
          )}

          <div>
            <label className={labelClass}>Descripción (opcional)</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Lo que conviene saber antes de acudir..."
              className={inputClass}
            />
          </div>

          {ritual && (
            <label className="inline-flex items-center gap-2 text-sm text-on-surface-muted cursor-pointer">
              <input
                type="checkbox"
                checked={status === 'cancelado'}
                onChange={(e) => setStatus(e.target.checked ? 'cancelado' : 'programado')}
                className="accent-red-400"
              />
              Ritual cancelado (se sigue viendo en la agenda, tachado)
            </label>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-outline-ghost/40">
            <Button type="button" variant="outline" onClick={onClose} className="px-5 py-2">
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={submitting} className="px-5 py-2">
              {submitting ? 'Guardando…' : ritual ? 'Guardar cambios' : 'Convocar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RitualFormModal;
