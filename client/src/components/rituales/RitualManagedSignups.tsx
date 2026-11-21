import { useEffect, useState } from 'react';
import { CalendarCheck, Check, ClipboardCheck, Hourglass, Loader2, UserMinus, UserPlus, X } from 'lucide-react';
import type { Ritual, RitualAttendee, RitualSignupCandidate } from '../../utils/ritualsApi';
import { getAvatarUrl } from '../../utils/api';
import type { SignupActions } from './RitualAttendees';

const avatarClass = 'w-7 h-7 rounded-full object-cover ring-1 ring-theme-main/40 ring-offset-1 ring-offset-surface';
const nota = 'text-xs italic text-on-surface-muted';
const marca = 'inline-flex items-center gap-1.5 font-ui text-xs font-semibold uppercase tracking-[0.14em]';

const Tu = () => (
  <span className="px-1.5 py-px font-ui text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-theme-main border border-theme-main/40 rounded-sm shrink-0">
    tú
  </span>
);

/** "3 nov, 18:40": cuándo se pidió la inscripción. */
function cuando(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '');
}

interface RitualManagedSignupsProps {
  ritual: Ritual;
  actions?: SignupActions;
  /** Si ya no se puede pedir la inscripción (el evento ha terminado). */
  ended: boolean;
}

/**
 * Un evento gestionado: quien se apunta pide la inscripción, que queda pendiente hasta que
 * quien organiza la acepta (el pago suele ir por fuera, un Bizum…). Todo el mundo ve solo las
 * inscripciones aceptadas, numeradas en el orden en que se aceptaron; quien tiene la suya
 * pendiente lo ve aquí, y quien organiza acepta, rechaza e inscribe a quien quiera.
 */
export const RitualManagedSignups = ({ ritual, actions, ended }: RitualManagedSignupsProps) => {
  const inscritos = ritual.attendees ?? [];
  const pendientes = ritual.pendingAttendees ?? [];
  const userId = actions?.userId;
  const key = ritual.occurrenceKey ?? ritual.id;
  const busy = actions?.busyKey === key;
  const aceptada = !!userId && inscritos.some((a) => a.userId === userId);
  const pendiente = !aceptada && !!userId && pendientes.some((a) => a.userId === userId);
  const cancelled = ritual.status === 'cancelado';
  const organiza = !!ritual.canManageSignups && !!actions?.onAcceptSignup;

  // Lo que hace quien organiza: qué fila está guardándose y el último error
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [fallo, setFallo] = useState('');
  const gestionar = async (id: string, hacer: () => Promise<void>) => {
    setTrabajando(id);
    setFallo('');
    try {
      await hacer();
    } catch (err) {
      setFallo(err instanceof Error ? err.message : 'No se pudo guardar el cambio.');
    } finally {
      setTrabajando(null);
    }
  };
  const aceptar = (a: Pick<RitualAttendee, 'userId'>) => gestionar(a.userId, () => actions!.onAcceptSignup!(ritual, a.userId));
  const quitar = (a: RitualAttendee, rechazo: boolean) => {
    const pregunta = rechazo
      ? `¿Rechazar la solicitud de inscripción de ${a.username}?`
      : `¿Quitar a ${a.username} de los inscritos? Si ya había pagado, recuerda devolvérselo.`;
    if (!window.confirm(pregunta)) return;
    void gestionar(a.userId, () => actions!.onRemoveSignup!(ritual, a.userId));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <h3 className="rotulo">
          Inscritos · <span className="tabular-nums">{inscritos.length}</span>
        </h3>

        {inscritos.length === 0 ? (
          <p className="text-sm italic text-on-surface-muted">Todavía no hay nadie inscrito.</p>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {inscritos.map((a, i) => (
              <li key={a.userId} className="flex items-center gap-2.5 text-[0.98rem]">
                <span className="w-6 text-right font-ui text-xs tabular-nums text-theme-main/70">{i + 1}</span>
                <img src={getAvatarUrl(a.profilePicture)} alt="" className={avatarClass} loading="lazy" />
                <span className={`truncate ${a.userId === userId ? 'text-on-surface-bright font-semibold' : 'text-on-surface/90'}`}>
                  {a.username}
                </span>
                {a.userId === userId && <Tu />}
                {organiza && (
                  <button
                    type="button"
                    onClick={() => quitar(a, false)}
                    disabled={trabajando === a.userId}
                    aria-label={`Quitar a ${a.username} de los inscritos`}
                    title="Quitar de los inscritos"
                    className="ml-auto btn-sello btn-sello-icono btn-sello-peligro shrink-0"
                  >
                    {trabajando === a.userId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserMinus className="w-3.5 h-3.5" />}
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Lo que puede hacer quien mira con su propia inscripción */}
      {!cancelled &&
        (aceptada ? (
          <div className="flex flex-col gap-1">
            <p className={`${marca} text-gold-bright`}>
              <CalendarCheck className="w-4 h-4" /> Inscripción confirmada
            </p>
            <p className={nota}>Para borrarte, habla con quien organiza el evento.</p>
          </div>
        ) : ended ? (
          <p className={nota}>Ya ha terminado.</p>
        ) : !userId ? (
          <p className={nota}>Identifícate para pedir la inscripción.</p>
        ) : pendiente ? (
          <div className="flex flex-col gap-2 p-3.5 rounded-sm border border-theme-main/40 bg-theme-main/[0.05]">
            <p className={`${marca} text-theme-main`}>
              <Hourglass className="w-4 h-4" /> Inscripción pendiente
            </p>
            <p className="text-sm text-on-surface/90">
              Estás apuntado, pero la inscripción no está terminada: aparecerás en la lista cuando quien organiza la
              confirme (por ejemplo, al recibir el pago). Hasta entonces, el resto no ve que vas.
            </p>
            <button
              type="button"
              aria-busy={busy || undefined}
              disabled={busy}
              onClick={() => actions!.onLeave(ritual)}
              className="self-start btn-sello btn-sello-peligro gap-2"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
              Retirar la solicitud
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              aria-busy={busy || undefined}
              disabled={busy}
              onClick={() => actions!.onSignUp(ritual)}
              className="self-start btn-runic btn-runic-primary px-5 py-2 text-xs gap-2"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Pedir inscripción
            </button>
            <p className={nota}>Quedará pendiente hasta que quien organiza la confirme.</p>
          </div>
        ))}

      {organiza && (
        <section
          aria-labelledby="gestion-inscripcion"
          className="flex flex-col gap-4 p-4 rounded-sm border border-outline-ghost/80 bg-background/40"
        >
          <h3 id="gestion-inscripcion" className="rotulo">
            <ClipboardCheck className="w-3.5 h-3.5" /> Gestión de la inscripción
          </h3>

          {fallo && (
            <div role="alert" className="aviso-error">
              {fallo}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <h4 className="font-ui text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-on-surface-muted">
              Pendientes de confirmar · <span className="tabular-nums">{pendientes.length}</span>
            </h4>
            {pendientes.length === 0 ? (
              <p className={nota}>No hay solicitudes pendientes.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {pendientes.map((a) => (
                  <li key={a.userId} className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                    <img src={getAvatarUrl(a.profilePicture)} alt="" className={avatarClass} loading="lazy" />
                    <span className="text-on-surface/90 truncate">{a.username}</span>
                    <span className="text-xs text-on-surface-muted">pidió el {cuando(a.signedUpAt)}</span>
                    <span className="ml-auto flex gap-2">
                      <button
                        type="button"
                        onClick={() => void aceptar(a)}
                        disabled={trabajando === a.userId}
                        aria-label={`Aceptar la inscripción de ${a.username}`}
                        className="btn-sello gap-1.5"
                      >
                        {trabajando === a.userId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        Aceptar
                      </button>
                      <button
                        type="button"
                        onClick={() => quitar(a, true)}
                        disabled={trabajando === a.userId}
                        aria-label={`Rechazar la solicitud de ${a.username}`}
                        className="btn-sello btn-sello-peligro gap-1.5"
                      >
                        <X className="w-3.5 h-3.5" /> Rechazar
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className={nota}>Los inscritos salen en el orden en que los aceptas.</p>
          </div>

          <InscribirAMano ritual={ritual} actions={actions!} trabajando={trabajando} onInscribir={(id) => gestionar(id, () => actions!.onAcceptSignup!(ritual, id))} />
        </section>
      )}
    </div>
  );
};

interface InscribirAManoProps {
  ritual: Ritual;
  actions: SignupActions;
  trabajando: string | null;
  onInscribir: (userId: string) => Promise<void>;
}

/** Quien organiza inscribe a alguien que no lo pidió desde la web: elige su cuenta y queda inscrito. */
const InscribirAMano = ({ ritual, actions, trabajando, onInscribir }: InscribirAManoProps) => {
  const [candidatas, setCandidatas] = useState<RitualSignupCandidate[] | null>(null);
  const [elegida, setElegida] = useState('');
  const inscritos = ritual.attendees?.length ?? 0;

  // Cada vez que cambian los inscritos, la lista de a quién se puede inscribir
  useEffect(() => {
    let vigente = true;
    actions
      .loadSignupCandidates?.(ritual)
      .then((lista) => vigente && setCandidatas(lista))
      .catch(() => vigente && setCandidatas([]));
    return () => {
      vigente = false;
    };
  }, [ritual.id, inscritos]); // eslint-disable-line react-hooks/exhaustive-deps

  const enviar = async () => {
    if (!elegida) return;
    await onInscribir(elegida);
    setElegida('');
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="inscribir-a-mano" className="font-ui text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-on-surface-muted">
        Inscribir a alguien
      </label>
      <div className="flex flex-wrap gap-2">
        <select
          id="inscribir-a-mano"
          value={elegida}
          onChange={(e) => setElegida(e.target.value)}
          disabled={!candidatas}
          className="campo w-auto min-w-[12rem] flex-1"
        >
          <option value="">{candidatas ? 'Elige una persona…' : 'Cargando…'}</option>
          {candidatas?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.username}
              {ritual.pendingAttendees?.some((p) => p.userId === c.id) ? ' (pendiente)' : ''}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void enviar()}
          disabled={!elegida || trabajando === elegida}
          className="btn-runic btn-runic-primary px-4 py-2 text-xs gap-2"
        >
          {trabajando === elegida && elegida ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          Inscribir
        </button>
      </div>
      <p className={nota}>Para quien se inscribe por otra vía: queda inscrito directamente, el último de la lista.</p>
    </div>
  );
};

export default RitualManagedSignups;
