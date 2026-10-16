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
import RitualDetailModal from '../components/rituales/RitualDetailModal';
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

  // El último ritual abierto, que se resalta en el lateral, y una señal para
  // llevar la vista hasta el detalle del día (solo tras un clic en un día).
  const [focusedKey, setFocusedKey] = useState<string | null>(searchParams.get('ritual'));
  const [scrollRequest, setScrollRequest] = useState(0);
  // El ritual con el detalle abierto: va en la URL para poder enlazarlo.
  const openKey = searchParams.get('ritual');
  const panelRef = useRef<HTMLElement>(null);
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

  // Tras elegir un día en el mes, en el móvil su lista va debajo del calendario: se baja hasta ella.
  useEffect(() => {
    if (!scrollRequest) return;
    if (window.matchMedia('(max-width: 767px)').matches) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      panelRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
  }, [scrollRequest]);

  const visible = rituals.filter((r) => !hiddenKinds.has(kindOf(r)));
  const dayRituals = visible.filter((r) => coversDay(r, selectedDay)).sort(compareRituals);
  // Se busca entre todos, no solo los visibles: un enlace abre el ritual aunque su tipo esté filtrado.
  const openRitual = openKey ? rituals.find((r) => keyOf(r) === openKey) : undefined;

  // La URL guarda el día, la vista y el ritual abierto, para poder compartir o recargar sin perderlos.
  function writeUrl(day: Date, v: View, ritualKey: string | null = null) {
    const params: Record<string, string> = { dia: dayKey(day) };
    if (v !== DEFAULT_VIEW) params.vista = v;
    if (ritualKey) params.ritual = ritualKey;
    setSearchParams(params, { replace: true });
  }

  const selectDay = (day: Date, ritualKey: string | null = null) => {
    setSelectedDay(day);
    setFocusedKey(ritualKey);
    if (day.getMonth() !== month.getMonth()) setMonth(new Date(day.getFullYear(), day.getMonth(), 1));
    writeUrl(day, view, ritualKey);
  };

  // Un enlace a un ritual que ya no está en la agenda (borrado, o de otra fecha).
  useEffect(() => {
    if (loading || !openKey || openRitual) return;
    setError('No se ha encontrado ese ritual en la agenda.');
    writeUrl(selectedDay, view);
    // Solo al terminar de cargar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, rituals]);

  /** Clic en un día del calendario: se muestra su detalle. */
  const pickDay = (day: Date) => {
    selectDay(day);
    setScrollRequest((n) => n + 1);
  };

  /** Clic en un ritual: se abre su detalle en el modal, y su día queda elegido. */
  const pickRitual = (day: Date, ritual: Ritual) => selectDay(day, keyOf(ritual));

  /** «+N más» en el mes: la semana de ese día, donde se ven todos sus rituales. */
  const showWeek = (day: Date) => {
    setView('semana');
    setSelectedDay(day);
    setFocusedKey(null);
    writeUrl(day, 'semana');
  };

  /** Clic en un ritual de la lista del día (móvil): ya está en el día elegido. */
  const openFromPanel = (ritual: Ritual) => {
    setFocusedKey(keyOf(ritual));
    writeUrl(selectedDay, view, keyOf(ritual));
  };

  const closeRitual = () => writeUrl(selectedDay, view);

  const changeView = (v: View) => {
    setView(v);
    writeUrl(selectedDay, v, openKey);
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
    closeRitual();
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
    closeRitual();
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
      setError(err instanceof Error ? err.message : 'No se pudo guardar el cambio.');
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
      userId={signup.userId}
      onCreate={() => openCreate(selectedDay)}
      onOpen={openFromPanel}
    />
  );

  return (
    <div className="flex flex-col w-full min-h-[80vh]">
      <PageHeader
        title="Rituales"
        subtitle="La agenda del Culto: partidas online y presenciales, eventos y jornadas."
        imageSrc="/calendar_banner_wide.jpg"
        imageAlt="Calendario de rituales"
        maxWidthClass="max-w-7xl"
      />

      <div className="max-w-7xl w-full mx-auto px-0 md:px-8 py-4 md:py-10 relative z-20 -mt-20 flex-1">
        <div className="panel-premium rounded-sm mx-3 md:mx-0 px-4 py-6 md:p-8">
          {/* Cabecera: mes, navegación y vista */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-7">
            <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
              <div>
                <p className="eyebrow">
                  {view === 'semana' ? weekEnd.getFullYear() : month.getFullYear()}
                </p>
                <h2 className={`mt-1 font-display text-3xl md:text-[2.6rem] text-gilded leading-tight ${view === 'semana' ? '' : 'capitalize'}`}>
                  {view === 'semana' ? weekLabel : monthName}
                </h2>
              </div>
              <div className="flex items-center gap-1.5 pb-1.5">
                <button type="button" onClick={() => shift(-1)} aria-label={`${unit} anterior`} className="btn-sello btn-sello-icono">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button type="button" onClick={goToday} className="btn-sello">
                  Hoy
                </button>
                <button type="button" onClick={() => shift(1)} aria-label={`${unit} siguiente`} className="btn-sello btn-sello-icono">
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
              <div role="group" aria-label="Vista" className="segmentado">
                {VIEWS.map(([v, label, Icon]) => (
                  <button key={v} type="button" onClick={() => changeView(v)} aria-pressed={view === v}>
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
          {/* El color de cada tipo solo vive en su icono; el chip en sí sigue el latón de la web */}
          <div role="group" aria-label="Mostrar tipos de ritual" className="flex flex-wrap gap-2 mb-7 pb-6 border-b border-outline-ghost/60">
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
                  className={`inline-flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full border text-[0.85rem] transition-all motion-reduce:transition-none cursor-pointer ${
                    off
                      ? 'border-outline-ghost/60 text-on-surface-muted/60 line-through decoration-on-surface-muted/50'
                      : 'border-theme-main/30 bg-background/50 text-on-surface hover:border-theme-main/70'
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center border ${off ? 'opacity-40 grayscale' : ''}`}
                    style={{ borderColor: alpha(style.color, 0.55), backgroundColor: alpha(style.color, 0.12) }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: style.color }} />
                  </span>
                  {style.label}
                </button>
              );
            })}
          </div>

          {error && (
            <div role="alert" className="aviso-error mb-6">{error}</div>
          )}

          {/* El calendario ocupa todo el ancho; cada ritual abre su detalle en el modal */}
          <div className="flex flex-col gap-8">
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
                  onShowWeek={showWeek}
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

            {/* Solo en el móvil y en la vista de mes, donde las casillas no caben más que sellos:
                la lista del día elegido, debajo del calendario */}
            {view === 'mes' && (
              <section ref={panelRef} aria-label="Rituales del día elegido" className="md:hidden flex flex-col gap-3 scroll-mt-32">
                {dayPanel}
              </section>
            )}
          </div>
        </div>

        {/* La sala de juego se abre siempre en una ventana aparte. rel="opener" para
            que herede la sesión sin «Recordarme», que vive en sessionStorage */}
        <div className="flex justify-center mt-10 px-4">
          <Button variant="primary" href="/sala.html" target="_blank" rel="opener" className="px-8 py-3 text-lg">
            Entrar en la sala de juegos
            <span className="sr-only"> (se abre en una ventana nueva)</span>
          </Button>
        </div>
      </div>

      {openRitual && (
        <RitualDetailModal
          ritual={openRitual}
          canManage={canManage}
          signup={signup}
          onClose={closeRitual}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      )}

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
  userId?: string;
  onCreate: () => void;
  onOpen: (ritual: Ritual) => void;
}

/** El día elegido, con el resumen de sus rituales; cada uno abre su detalle. */
const DayPanel = ({ day, rituals, focusedKey, loading, canManage, userId, onCreate, onOpen }: DayPanelProps) => (
  <>
    <div className="pb-3 mb-1 border-b border-theme-main/25">
      <h3 className="font-display text-xl text-gilded leading-tight first-letter:uppercase">{formatLongDay(day)}</h3>
      <p className="mt-1 text-sm text-on-surface-muted italic">
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
      <div className="text-center py-10 px-4 border border-dashed border-theme-main/25 rounded-sm bg-[radial-gradient(ellipse_at_center,rgba(18,26,51,0.6),transparent_70%)] text-on-surface-muted">
        <div aria-hidden="true" className="ornament-divider w-24 mx-auto mb-4"><span className="ornament-diamond" /></div>
        <p className="font-['Cormorant_Garamond',serif] italic text-lg mb-4">La noche está en calma.</p>
        {canManage && (
          <button type="button" onClick={onCreate} className="btn-sello">
            <Plus className="w-3.5 h-3.5" /> Convocar un ritual este día
          </button>
        )}
      </div>
    ) : (
      rituals.map((r) => (
        <RitualCard
          key={keyOf(r)}
          ritual={r}
          highlighted={focusedKey === keyOf(r)}
          userId={userId}
          onOpen={onOpen}
        />
      ))
    )}
  </>
);

export default Rituales;
