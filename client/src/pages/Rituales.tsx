import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Loader2, Plus, ScrollText } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Button from '../components/Button';
import RitualCalendar from '../components/rituales/RitualCalendar';
import RitualWeek from '../components/rituales/RitualWeek';
import RitualAgenda from '../components/rituales/RitualAgenda';
import RitualExportMenu from '../components/rituales/RitualExportMenu';
import RitualCard from '../components/rituales/RitualCard';
import RitualFormModal from '../components/rituales/RitualFormModal';
import type { SignupActions } from '../components/rituales/RitualAttendees';
import { RITUAL_KINDS, RITUAL_KIND_ORDER, alpha, kindOf, type RitualKind } from '../components/rituales/ritualKinds';
import {
  addDays,
  compareRituals,
  coversDay,
  expandOccurrences,
  dayKey,
  formatLongDay,
  keyOf,
  monthGrid,
  parseDayKey,
  startOfDay,
  startOfWeek
} from '../components/rituales/ritualDates';
import { useAuth } from '../context/AuthContext';
import {
  createRitual,
  deleteRitual,
  leaveRitual,
  listRituals,
  listStorytellers,
  signUpForRitual,
  updateRitual,
  type Ritual,
  type RitualInput,
  type Storyteller
} from '../utils/ritualsApi';

type View = 'mes' | 'semana' | 'agenda';

const VIEWS = [
  ['mes', 'Mes', CalendarDays],
  ['semana', 'Semana', CalendarRange],
  ['agenda', 'Agenda', ScrollText]
] as const;

/** La vista por defecto es la semana; el mes y la agenda van indicados en la URL. */
const DEFAULT_VIEW: View = 'semana';

function parseView(raw: string | null): View {
  return raw === 'mes' || raw === 'semana' || raw === 'agenda' ? raw : DEFAULT_VIEW;
}

const Rituales = () => {
  const { user, token } = useAuth();
  const canManage = !!token && ((user?.roles || []).includes('narrador') || (user?.roles || []).includes('admin'));
  const [searchParams, setSearchParams] = useSearchParams();

  const initialDay = parseDayKey(searchParams.get('dia')) ?? parseDayKey(searchParams.get('nuevo')) ?? startOfDay(new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(initialDay);
  const [month, setMonth] = useState<Date>(new Date(initialDay.getFullYear(), initialDay.getMonth(), 1));
  const [view, setView] = useState<View>(parseView(searchParams.get('vista')));
  const [hiddenKinds, setHiddenKinds] = useState<Set<RitualKind>>(new Set());

  const [rituals, setRituals] = useState<Ritual[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [storytellers, setStorytellers] = useState<Storyteller[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Ritual | null>(null);
  const [formDay, setFormDay] = useState<Date | null>(null);

  // El ritual pulsado, que se resalta en el detalle del día, y una señal para
  // llevar la vista hasta él (solo tras un clic, no al cargar la página).
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [scrollRequest, setScrollRequest] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  // La partida en la que se está apuntando o desapuntando alguien.
  const [signupBusy, setSignupBusy] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // La semana que se ve en la vista semanal: la del día elegido.
  const weekStart = startOfWeek(selectedDay);
  const weekKey = dayKey(weekStart);

  // Lo que se pide al servidor depende de la vista: la cuadrícula entera del
  // mes (con los días que asoman de los meses vecinos), el mes justo o la
  // semana.
  const range = useMemo(() => {
    if (view === 'agenda') {
      return { from: month, to: new Date(month.getFullYear(), month.getMonth() + 1, 1) };
    }
    if (view === 'semana') {
      const from = parseDayKey(weekKey)!;
      return { from, to: addDays(from, 7) };
    }
    const grid = monthGrid(month);
    return { from: grid[0], to: addDays(grid[grid.length - 1], 1) };
  }, [view, month, weekKey]);

  const fetchRituals = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Las partidas periódicas llegan como serie y aquí se despliegan.
      setRituals(expandOccurrences(await listRituals(range.from, range.to), range.from, range.to));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la agenda.');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchRituals();
  }, [fetchRituals]);

  useEffect(() => {
    if (canManage && token) {
      listStorytellers(token).then(setStorytellers).catch(() => setStorytellers([]));
    }
  }, [canManage, token]);

  // Enlace directo para convocar (desde el widget del Atrio, por ejemplo).
  useEffect(() => {
    const nuevo = parseDayKey(searchParams.get('nuevo'));
    if (nuevo && canManage) {
      openCreate(nuevo);
      writeUrl(nuevo, view);
    }
    // Solo al llegar a la página (o al terminar de cargar la sesión).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  // Tras un clic: en pantallas estrechas el detalle va debajo, así que se baja
  // hasta él; y si se pulsó un ritual concreto, hasta su tarjeta.
  useEffect(() => {
    if (!scrollRequest) return;
    const card = focusedKey ? document.getElementById(`ritual-${focusedKey}`) : null;
    const narrow = window.matchMedia('(max-width: 1023px)').matches;
    if (card) card.scrollIntoView({ behavior: 'smooth', block: narrow ? 'start' : 'nearest' });
    else if (narrow) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [scrollRequest, focusedKey]);

  const visible = rituals.filter((r) => !hiddenKinds.has(kindOf(r)));
  const dayRituals = visible.filter((r) => coversDay(r, selectedDay)).sort(compareRituals);

  // La URL guarda el día y la vista, para poder compartir o recargar sin perderlos.
  function writeUrl(day: Date, v: View) {
    setSearchParams(v === DEFAULT_VIEW ? { dia: dayKey(day) } : { dia: dayKey(day), vista: v }, { replace: true });
  }

  const selectDay = (day: Date) => {
    setSelectedDay(day);
    setFocusedKey(null);
    if (day.getMonth() !== month.getMonth()) setMonth(new Date(day.getFullYear(), day.getMonth(), 1));
    writeUrl(day, view);
  };

  /** Clic en un día del calendario: se muestra su detalle. */
  const pickDay = (day: Date) => {
    selectDay(day);
    setScrollRequest((n) => n + 1);
  };

  /** Clic en un ritual: se muestra su día con él resaltado. */
  const pickRitual = (day: Date, ritual: Ritual) => {
    selectDay(day);
    setFocusedKey(keyOf(ritual));
    setScrollRequest((n) => n + 1);
  };

  const changeView = (v: View) => {
    setView(v);
    writeUrl(selectedDay, v);
  };

  const shiftMonth = (delta: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));

  // En la semana se mueve el día elegido, y con él la semana entera.
  const shiftWeek = (delta: number) => selectDay(addDays(selectedDay, delta * 7));
  const shift = (delta: number) => (view === 'semana' ? shiftWeek(delta) : shiftMonth(delta));

  const goToday = () => {
    const today = startOfDay(new Date());
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    selectDay(today);
  };

  const toggleKind = (kind: RitualKind) =>
    setHiddenKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });

  function openCreate(day: Date | null) {
    setEditing(null);
    setFormDay(day);
    setFormOpen(true);
  }

  const openEdit = (ritual: Ritual) => {
    setEditing(ritual);
    setFormDay(null);
    setFormOpen(true);
  };

  const handleSave = async (input: RitualInput) => {
    const saved = editing ? await updateRitual(token!, editing.id, input) : await createRitual(token!, input);
    await fetchRituals();
    selectDay(startOfDay(new Date(saved.startsAt)));
  };

  const handleDelete = async (ritual: Ritual) => {
    const scope = ritual.recurrenceDays || ritual.recurrenceMonths ? 'y todas sus repeticiones ' : '';
    if (!window.confirm(`¿Borrar «${ritual.title}» ${scope}de la agenda? Si solo se suspende, mejor márcalo como cancelado.`)) return;
    try {
      await deleteRitual(token!, ritual.id);
      await fetchRituals();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo borrar el ritual.');
    }
  };

  // Apuntarse o desapuntarse, y recargar para ver la lista como ha quedado.
  const changeSignup = async (ritual: Ritual, join: boolean) => {
    if (!token) return;
    setSignupBusy(ritual.occurrenceKey ?? ritual.id);
    setError('');
    try {
      await (join ? signUpForRitual(token, ritual) : leaveRitual(token, ritual));
      await fetchRituals();
      setNow(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar la inscripción.');
    } finally {
      setSignupBusy(null);
    }
  };

  const signup: SignupActions = {
    userId: token ? user?.id : undefined,
    now,
    busyKey: signupBusy,
    onSignUp: (r) => changeSignup(r, true),
    onLeave: (r) => changeSignup(r, false)
  };

  const monthName = month.toLocaleDateString('es-ES', { month: 'long' });
  const weekEnd = addDays(weekStart, 6);
  const weekLabel =
    weekStart.getMonth() === weekEnd.getMonth()
      ? `${weekStart.getDate()} – ${weekEnd.getDate()} ${weekEnd.toLocaleDateString('es-ES', { month: 'short' })}`
      : `${weekStart.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`;
  const unit = view === 'semana' ? 'Semana' : 'Mes';

  const dayPanel = (
    <DayPanel
      day={selectedDay}
      rituals={dayRituals}
      focusedKey={focusedKey}
      loading={loading && rituals.length === 0}
      canManage={canManage}
      signup={signup}
      onCreate={() => openCreate(selectedDay)}
      onEdit={openEdit}
      onDelete={handleDelete}
    />
  );

  return (
    <div className="flex flex-col w-full min-h-[80vh]">
      <PageHeader
        title="Rituales"
        subtitle="La agenda del Culto: partidas online y presenciales, eventos y jornadas."
        imageSrc="/calendar_banner_wide.jpg"
        imageAlt="Calendario de rituales"
        maxWidthClass="max-w-6xl"
      />

      <div className="max-w-6xl w-full mx-auto px-0 md:px-8 py-4 md:py-10 relative z-20 -mt-20 flex-1">
        <div className="bg-transparent md:bg-surface border-0 md:border border-transparent md:border-outline-ghost rounded-none md:rounded shadow-none md:shadow-2xl px-4 py-6 md:p-8 relative">
          {/* Cabecera: mes, navegación y vista */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
            <div className="flex items-end gap-4">
              <div>
                <p className="font-teutonic2 text-theme-main/70 text-lg leading-none">
                  {view === 'semana' ? weekEnd.getFullYear() : month.getFullYear()}
                </p>
                <h2 className={`font-display text-3xl md:text-4xl text-on-surface leading-tight ${view === 'semana' ? '' : 'capitalize'}`}>
                  {view === 'semana' ? weekLabel : monthName}
                </h2>
              </div>
              <div className="flex items-center gap-1 pb-1">
                <button
                  type="button"
                  onClick={() => shift(-1)}
                  aria-label={`${unit} anterior`}
                  className="p-1.5 border border-outline-ghost text-on-surface-muted hover:text-theme-main hover:border-theme-main/50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={goToday}
                  className="px-3 py-1 border border-outline-ghost text-xs font-display uppercase tracking-wider text-on-surface-muted hover:text-theme-main hover:border-theme-main/50 transition-colors"
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => shift(1)}
                  aria-label={`${unit} siguiente`}
                  className="p-1.5 border border-outline-ghost text-on-surface-muted hover:text-theme-main hover:border-theme-main/50 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {view === 'agenda' && (
                <RitualExportMenu
                  rituals={visible}
                  month={month}
                  shownKinds={RITUAL_KIND_ORDER.filter((k) => !hiddenKinds.has(k))}
                />
              )}
              <div className="inline-flex border border-outline-ghost">
                {VIEWS.map(([v, label, Icon]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => changeView(v)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-display uppercase tracking-wider transition-colors ${
                      view === v ? 'bg-theme-container/60 text-theme-main' : 'text-on-surface-muted hover:text-on-surface'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" /> {label}
                  </button>
                ))}
              </div>
              {canManage && (
                <Button variant="primary" onClick={() => openCreate(selectedDay)} className="px-4 py-2">
                  <span className="inline-flex items-center gap-2 text-sm">
                    <Plus className="w-4 h-4" /> Convocar
                  </span>
                </Button>
              )}
            </div>
          </div>

          {/* Leyenda: también sirve de filtro */}
          <div className="flex flex-wrap gap-2 mb-6">
            {RITUAL_KIND_ORDER.map((kind) => {
              const style = RITUAL_KINDS[kind];
              const Icon = style.icon;
              const off = hiddenKinds.has(kind);
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => toggleKind(kind)}
                  aria-pressed={!off}
                  title={off ? 'Mostrar' : 'Ocultar'}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs border rounded-full transition-all ${off ? 'opacity-40 grayscale' : ''}`}
                  style={{ color: style.color, borderColor: alpha(style.color, 0.4), backgroundColor: alpha(style.color, 0.08) }}
                >
                  <Icon className="w-3.5 h-3.5" /> {style.label}
                </button>
              );
            })}
          </div>

          {error && (
            <div className="mb-6 p-3.5 rounded bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{error}</div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] gap-8">
            <div className={`min-w-0 transition-opacity ${loading ? 'opacity-60' : ''}`}>
              {view === 'mes' && (
                <RitualCalendar
                  month={month}
                  rituals={visible}
                  selectedDay={selectedDay}
                  canCreate={canManage}
                  onSelectDay={pickDay}
                  onSelectRitual={pickRitual}
                  onCreateOnDay={openCreate}
                />
              )}
              {view === 'semana' && (
                <RitualWeek
                  anchor={selectedDay}
                  rituals={visible}
                  selectedDay={selectedDay}
                  canCreate={canManage}
                  onSelectDay={pickDay}
                  onSelectRitual={pickRitual}
                  onCreateOnDay={openCreate}
                />
              )}
              {view === 'agenda' &&
                (loading && rituals.length === 0 ? (
                  <Loader2 className="w-6 h-6 animate-spin text-theme-main mx-auto my-12" />
                ) : (
                  <RitualAgenda
                    month={month}
                    rituals={visible}
                    selectedDay={selectedDay}
                    focusedKey={focusedKey}
                    onSelectRitual={pickRitual}
                  />
                ))}
            </div>

            {/* El detalle del día elegido, al lado (debajo en pantallas estrechas) */}
            <aside
              ref={panelRef}
              className="flex flex-col gap-3 scroll-mt-32 lg:sticky lg:top-32 lg:self-start lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto lg:pr-1"
            >
              {dayPanel}
            </aside>
          </div>
        </div>
      </div>

      <RitualFormModal
        isOpen={formOpen}
        ritual={editing}
        initialDay={formDay}
        storytellers={storytellers}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
};

interface DayPanelProps {
  day: Date;
  rituals: Ritual[];
  focusedKey: string | null;
  loading: boolean;
  canManage: boolean;
  signup: SignupActions;
  onCreate: () => void;
  onEdit: (ritual: Ritual) => void;
  onDelete: (ritual: Ritual) => void;
}

/** El detalle del día elegido, con todos sus rituales. */
const DayPanel = ({ day, rituals, focusedKey, loading, canManage, signup, onCreate, onEdit, onDelete }: DayPanelProps) => (
  <>
    <div className="pb-3 border-b border-outline-ghost/60">
      <p className="font-display text-lg text-on-surface leading-tight first-letter:uppercase">{formatLongDay(day)}</p>
      <p className="text-xs text-on-surface-muted italic">
        {rituals.length === 0
          ? 'Ningún ritual convocado'
          : rituals.length === 1
            ? 'Un ritual convocado'
            : `${rituals.length} rituales convocados`}
      </p>
    </div>

    {loading ? (
      <Loader2 className="w-5 h-5 animate-spin text-theme-main mx-auto my-6" />
    ) : rituals.length === 0 ? (
      <div className="text-center py-8 px-4 border border-dashed border-outline-ghost/70 text-on-surface-muted">
        <p className="font-body italic mb-3">La noche está en calma.</p>
        {canManage && (
          <button type="button" onClick={onCreate} className="inline-flex items-center gap-1.5 text-sm text-theme-main hover:underline">
            <Plus className="w-4 h-4" /> Convocar un ritual este día
          </button>
        )}
      </div>
    ) : (
      rituals.map((r) => (
        <RitualCard
          key={keyOf(r)}
          ritual={r}
          highlighted={focusedKey === keyOf(r)}
          canManage={canManage}
          signup={signup}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))
    )}
  </>
);

export default Rituales;
