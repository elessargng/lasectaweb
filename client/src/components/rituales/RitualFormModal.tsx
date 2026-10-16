import { useEffect, useState, type FormEvent } from 'react';
import { Feather, Repeat, Sparkles, X } from 'lucide-react';
import Button from '../Button';
import type { Ritual, RitualInput, RitualStatus, RitualType, Storyteller } from '../../utils/ritualsApi';
import { RITUAL_KINDS, kindFromParts } from './ritualKinds';
import { describeMonthlyPosition, toLocalDateInput, toLocalInput } from './ritualDates';
import Dialog from '../Dialog';
import { SALA_LA_SECTA, esSalaLaSecta } from './salaLaSecta';

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

// Estilos de campo y etiqueta compartidos con el resto de la web (index.css).
const inputClass = 'campo';
const labelClass = 'campo-etiqueta';

/**
 * El cursor de un interruptor (igual que src/sala/Interruptor): el `<input>` va
 * aparte, como `peer` (sr-only), justo antes de este `<span>`.
 */
const switchClass =
  'relative h-5 w-9 shrink-0 rounded-full border border-outline-ghost bg-background transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-3.5 after:w-3.5 after:rounded-full after:bg-on-surface-muted after:transition-transform peer-checked:border-theme-main peer-checked:bg-theme-container peer-checked:after:translate-x-4 peer-checked:after:bg-theme-main peer-focus-visible:ring-2 peer-focus-visible:ring-theme-main motion-reduce:transition-none motion-reduce:after:transition-none';

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
  /** Publicada en Villacuervos pero con la inscripción aquí, en La Secta (de entrada, no). */
  const [signupInLaSecta, setSignupInLaSecta] = useState(false);
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
    setSignupInLaSecta(ritual?.signupsInLaSecta ?? false);
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
      if (next !== 'partida_online' && (link === DEFAULT_ONLINE_LINK || esSalaLaSecta(link))) setLink('');
    }
    setType(next);
  };

  const isOnline = type === 'partida_online';
  // Elegir dónde se apunta la gente: al crear una online publicada en Villacuervos,
  // o al modificar una que ya está publicada allí.
  const showSignupToggle = isOnline && (ritual ? !!ritual.villacuervosUrl : alsoInVillacuervos);
  // Jugar en la sala de La Secta (en vez de en botc.app): el enlace es el de la sala
  const enLaSecta = isOnline && esSalaLaSecta(link);
  const isInPerson = type === 'partida_presencial';
  const isGame = type !== 'jornada';
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
        alsoInVillacuervos: !ritual && isOnline && alsoInVillacuervos,
        signupsInLaSecta: showSignupToggle && signupInLaSecta
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
      <Dialog onClose={onClose} labelledBy="ritual-form-titulo" className="modal-cofre max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center gap-4 px-5 sm:px-7 pt-6 pb-5 shrink-0">
          <span className="medallon w-12 h-12">
            <Sparkles className="w-5 h-5 text-theme-main" />
          </span>
          <h3 id="ritual-form-titulo" className="flex-1 font-display text-2xl sm:text-3xl text-gilded leading-tight">
            {ritual ? 'Modificar ritual' : 'Convocar un ritual'}
          </h3>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="btn-sello btn-sello-icono shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div aria-hidden="true" className="hairline-gold shrink-0" />

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 sm:px-7 py-6 flex flex-col gap-5">
          {formError && (
            <div role="alert" className="aviso-error">{formError}</div>
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
                    aria-pressed={active}
                    className="opcion flex sm:flex-col items-center gap-2 sm:gap-1.5 p-3 sm:py-4 text-left sm:text-center"
                  >
                    <span className="medallon w-9 h-9">
                      <Icon className="w-4 h-4" style={{ color: style.color }} />
                    </span>
                    <span className={`font-ui text-[0.78rem] font-semibold tracking-wide ${active ? 'text-gold-bright' : 'text-on-surface'}`}>{opt.label}</span>
                    <span className="text-xs text-on-surface-muted">{opt.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {isOnline && !ritual && (
            <label
              className={`flex items-start gap-3 p-3.5 rounded-sm border cursor-pointer transition-colors ${
                alsoInVillacuervos ? 'border-theme-main/70 bg-theme-main/[0.06]' : 'border-outline-ghost hover:border-theme-main/40'
              }`}
            >
              <input
                type="checkbox"
                role="switch"
                checked={alsoInVillacuervos}
                onChange={(e) => setAlsoInVillacuervos(e.target.checked)}
                className="peer sr-only"
              />
              <span aria-hidden="true" className={`${switchClass} mt-0.5`} />
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

          {showSignupToggle && (
            <label
              className={`${ritual ? '' : 'ml-6'} flex items-start gap-3 p-3.5 rounded-sm border cursor-pointer transition-colors ${
                signupInLaSecta ? 'border-theme-main/70 bg-theme-main/[0.06]' : 'border-outline-ghost hover:border-theme-main/40'
              }`}
            >
              <input
                type="checkbox"
                role="switch"
                checked={signupInLaSecta}
                onChange={(e) => setSignupInLaSecta(e.target.checked)}
                className="peer sr-only"
              />
              <span aria-hidden="true" className={`${switchClass} mt-0.5`} />
              <span>
                <span className="block text-sm font-semibold text-on-surface">Apuntarse en La Secta</span>
                <span className="block text-xs text-on-surface-muted mt-0.5">
                  {signupInLaSecta
                    ? 'La gente se apunta aquí, en La Secta, con su lista de inscripción propia.'
                    : 'Desactivado, la gente se apunta en Villacuervos (con sus listas).'}
                </span>
              </span>
            </label>
          )}

          <div>
            <label htmlFor="ritual-titulo" className={labelClass}>Título</label>
            <input id="ritual-titulo"
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
              <label htmlFor="ritual-convocatoria" className={labelClass}>Convocatoria</label>
              <input id="ritual-convocatoria" type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputClass} />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="ritual-empieza" className={labelClass}>Empieza</label>
                <input id="ritual-empieza" type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="ritual-termina" className={labelClass}>Termina</label>
                <input id="ritual-termina" type="datetime-local" value={endsAt} min={startsAt} onChange={(e) => setEndsAt(e.target.value)} className={inputClass} />
              </div>
            </div>
          )}

          {isInPerson && (
            <div className="flex flex-col gap-3 p-4 rounded-sm border border-outline-ghost/70 bg-background/40">
              <span id="ritual-periodicidad" className="rotulo">
                <Repeat className="w-3.5 h-3.5" /> Periodicidad
              </span>
              <div role="group" aria-labelledby="ritual-periodicidad" className="flex flex-wrap gap-2">
                {RECURRENCE_OPTIONS.map(
                  ([value, label]) => {
                    const active = recurrence === value;
                    return (
                      <button
                        key={value || 'nunca'}
                        type="button"
                        onClick={() => setRecurrence(value)}
                        aria-pressed={active}
                        className={`opcion !rounded-full px-3.5 py-1.5 text-sm ${active ? 'text-gold-bright' : 'text-on-surface/90'}`}
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
                      <label htmlFor="ritual-repetir-cada" className={labelClass}>Repetir cada (días)</label>
                      <input id="ritual-repetir-cada"
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
                    <label htmlFor="ritual-hasta" className={labelClass}>Hasta (opcional)</label>
                    <input id="ritual-hasta"
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
              <label htmlFor="ritual-lugar" className={labelClass}>Lugar</label>
              <input id="ritual-lugar"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Dirección o nombre del local"
                className={inputClass}
              />
            </div>
          )}

          {/* Partida online: en la sala de La Secta o en botc.app (con su enlace) */}
          {isOnline && (
            <div className="flex flex-col gap-1">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  role="switch"
                  checked={enLaSecta}
                  onChange={(e) => setLink(e.target.checked ? SALA_LA_SECTA : DEFAULT_ONLINE_LINK)}
                  aria-describedby="ritual-en-la-secta-ayuda"
                  className="peer sr-only"
                />
                <span aria-hidden="true" className={switchClass} />
                <span className="font-ui text-sm text-on-surface">Jugar en La Secta</span>
              </label>
              <p id="ritual-en-la-secta-ayuda" className="text-xs text-on-surface-muted">
                {enLaSecta
                  ? 'La partida se juega en la sala de La Secta: «Entrar en la sala» llevará a ella.'
                  : 'Desactivado, la partida se juega en botc.app, con el enlace de abajo.'}
              </p>
            </div>
          )}

          {!enLaSecta && (
            <div>
              <label htmlFor="ritual-enlace" className={labelClass}>
                {isOnline ? 'Enlace a la sala de botc.app' : 'Enlace (opcional)'}
              </label>
              <input id="ritual-enlace"
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder={isOnline ? 'https://botc.app/join/...' : 'https://...'}
                className={inputClass}
              />
            </div>
          )}

          {isGame && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1">
                <label htmlFor="ritual-guion" className={labelClass}>Guion</label>
                <input id="ritual-guion"
                  type="text"
                  value={scriptName}
                  onChange={(e) => setScriptName(e.target.value)}
                  placeholder="Trouble Brewing"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="ritual-narrador" className={labelClass}>Narrador</label>
                <select id="ritual-narrador" value={storytellerId} onChange={(e) => setStorytellerId(e.target.value)} className={inputClass}>
                  <option value="">Sin asignar</option>
                  {storytellers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.username}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="ritual-plazas" className={labelClass}>Plazas</label>
                <input id="ritual-plazas"
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
            <label htmlFor="ritual-descripcion" className={labelClass}>Descripción (opcional)</label>
            <textarea id="ritual-descripcion"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Lo que conviene saber antes de acudir..."
              className={inputClass}
            />
          </div>

          {ritual && (
            <label className="inline-flex items-center gap-3 text-sm text-on-surface-muted cursor-pointer">
              <input
                type="checkbox"
                role="switch"
                checked={status === 'cancelado'}
                onChange={(e) => setStatus(e.target.checked ? 'cancelado' : 'programado')}
                className="peer sr-only"
              />
              <span aria-hidden="true" className={switchClass} />
              Ritual cancelado (se sigue viendo en la agenda, tachado)
            </label>
          )}

          <div className="flex justify-end gap-3 pt-5 mt-1 border-t border-outline-ghost/70">
            <Button type="button" variant="outline" onClick={onClose} className="px-5 py-2">
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={submitting} className="px-5 py-2">
              {submitting ? 'Guardando…' : ritual ? 'Guardar cambios' : 'Convocar'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};

export default RitualFormModal;
