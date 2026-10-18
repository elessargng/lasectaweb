import { useEffect, useState } from 'react';
import { BarChart3, Lock, Trophy } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { allBotcCharacters } from '../../data/botcRoles';
import { LOGRO_PLATINO, LOGROS, type Logro, type NivelLogro } from '../../data/logros';
import { urlDelServidor } from '../../utils/api';
import {
  getCatalogoPersonajes,
  getEstadisticas,
  type Participacion,
  type PersonajeDelCatalogo,
  type ResumenEstadisticas,
} from '../../utils/estadisticasApi';

/** El nombre en español de un personaje de la sala (su id: el nombre inglés en minúsculas y sin espacios). */
const NOMBRES_ES = new Map(allBotcCharacters.map((c) => [c.originalName.toLowerCase().replace(/[^a-z0-9]/g, ''), c.name]));

/** Los tipos que se juegan en una ficha, en el orden del grimorio. */
const TIPOS: { tipo: string; titulo: string }[] = [
  { tipo: 'townsfolk', titulo: 'Aldeanos' },
  { tipo: 'outsider', titulo: 'Forasteros' },
  { tipo: 'minion', titulo: 'Esbirros' },
  { tipo: 'demon', titulo: 'Demonios' },
  { tipo: 'traveller', titulo: 'Viajeros' },
];

const porcentaje = (parte: number, total: number) => (total > 0 ? `${Math.round((parte / total) * 100)} %` : '—');
const bando = (b: 'bueno' | 'malvado' | null) => (b === 'bueno' ? 'Bueno' : b === 'malvado' ? 'Malvado' : '—');
const colorBando = (b: 'bueno' | 'malvado' | null) =>
  b === 'bueno' ? 'text-good-bright' : b === 'malvado' ? 'text-blood-bright' : 'text-on-surface-muted';
const titulo = 'text-xl font-display text-theme-main flex items-center gap-2 mb-4';

/**
 * Las estadísticas de alguien, cargadas por su id: las propias, siempre; las de
 * otro, si las tiene públicas (si no, lo dice). Es lo que va en el perfil propio,
 * en el de otro y en la página de estadísticas.
 */
export const EstadisticasDeUsuario = ({ userId }: { userId: string }) => {
  const { user, token } = useAuth();
  const [resumen, setResumen] = useState<ResumenEstadisticas | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setResumen(null);
    setError('');
    getEstadisticas(userId, token)
      .then(setResumen)
      .catch((e: Error) => setError(e.message));
  }, [userId, token]);

  if (error) {
    return (
      <p className="flex items-center gap-2 text-on-surface-muted">
        <Lock className="w-4 h-4" aria-hidden="true" /> {error}
      </p>
    );
  }
  if (!resumen) return <p className="text-on-surface-muted">Cargando estadísticas…</p>;
  return <PanelEstadisticas resumen={resumen} propias={user?.id === userId} />;
};

const PanelEstadisticas = ({ resumen: r, propias }: { resumen: ResumenEstadisticas; propias: boolean }) => {
  const [catalogo, setCatalogo] = useState<PersonajeDelCatalogo[] | null>(null);
  useEffect(() => {
    getCatalogoPersonajes()
      .then(setCatalogo)
      .catch(() => setCatalogo([]));
  }, []);

  const nombre = (id: string) => NOMBRES_ES.get(id) ?? r.personajes[id]?.nombre ?? catalogo?.find((p) => p.id === id)?.nombre ?? id;
  const icono = (id: string) => r.personajes[id]?.icono ?? catalogo?.find((p) => p.id === id)?.icono;
  const veces = new Map(r.roles.map((x) => [x.id, x.veces]));
  const logros = new Map(r.causas.map((x) => [x.id, x.veces]));

  return (
    <div className="space-y-10">
      {propias && (
        <p className="text-sm text-on-surface-muted">
          Tus estadísticas son {r.publicas ? 'públicas: las ve cualquiera' : 'privadas: solo las ves tú'}. Se cambia en tu perfil.
        </p>
      )}

      {/* Lo principal, en cifras */}
      <section aria-labelledby="estadisticas-resumen">
        <h3 id="estadisticas-resumen" className={titulo}>
          <BarChart3 className="w-5 h-5" aria-hidden="true" /> Resumen
        </h3>
        {r.jugadas === 0 && r.narradas === 0 ? (
          <p className="text-on-surface-muted">Todavía no hay ninguna partida terminada en la sala.</p>
        ) : (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Cifra titulo="Partidas jugadas" valor={r.jugadas} />
            <Cifra titulo="Ganadas" valor={r.ganadas} detalle={porcentaje(r.ganadas, r.jugadas)} />
            <Cifra
              titulo="Acabando en el bueno"
              valor={`${r.porBando.bueno.ganadas} / ${r.porBando.bueno.jugadas}`}
              detalle={`ganadas: ${porcentaje(r.porBando.bueno.ganadas, r.porBando.bueno.jugadas)}`}
              clase="text-good-bright"
            />
            <Cifra
              titulo="Acabando en el malvado"
              valor={`${r.porBando.malvado.ganadas} / ${r.porBando.malvado.jugadas}`}
              detalle={`ganadas: ${porcentaje(r.porBando.malvado.ganadas, r.porBando.malvado.jugadas)}`}
              clase="text-blood-bright"
            />
            <Cifra titulo="Empezó en el bueno" valor={r.empezo.bueno} clase="text-good-bright" />
            <Cifra titulo="Empezó en el malvado" valor={r.empezo.malvado} clase="text-blood-bright" />
            <Cifra titulo="Cambios de bando" valor={r.cambiosDeBando} />
            <Cifra titulo="Vivo al final" valor={r.vivoAlFinal} detalle={porcentaje(r.vivoAlFinal, r.jugadas)} />
            <Cifra titulo="Nominaciones hechas" valor={r.nominaciones} />
            <Cifra titulo="Veces nominado" valor={r.nominado} />
            <Cifra titulo="Votos" valor={r.votos} />
            <Cifra titulo="Veces ejecutado" valor={r.ejecutado} />
            <Cifra titulo="Partidas narradas" valor={r.narradas} />
          </dl>
        )}
      </section>

      <Logros conseguidos={logros} />

      {/* Todos los personajes que existen: jugados (con cuántas veces) y por jugar */}
      <section aria-labelledby="estadisticas-personajes">
        <h3 id="estadisticas-personajes" className={titulo}>
          Personajes
        </h3>
        <p className="-mt-2 mb-4 text-xs text-on-surface-muted">
          Cuenta el rol con el que empieza la partida y cada día; los cambios de la noche, no.
        </p>
        {!catalogo ? (
          <p className="text-on-surface-muted">Cargando personajes…</p>
        ) : (
          <div className="space-y-6">
            {TIPOS.map(({ tipo, titulo: t }) => {
              const deTipo = catalogo
                .filter((p) => p.tipo === tipo)
                .sort((a, b) => (veces.get(b.id) ?? 0) - (veces.get(a.id) ?? 0) || nombre(a.id).localeCompare(nombre(b.id), 'es'));
              if (deTipo.length === 0) return null;
              const jugados = deTipo.filter((p) => veces.has(p.id)).length;
              const id = `estadisticas-tipo-${tipo}`;
              return (
                <div key={tipo}>
                  <h4 id={id} className="mb-2 font-ui text-sm font-semibold text-on-surface">
                    {t} <span className="font-normal text-on-surface-muted">· {jugados} de {deTipo.length} jugados</span>
                  </h4>
                  <ul aria-labelledby={id} className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {deTipo.map((p) => {
                      const n = veces.get(p.id) ?? 0;
                      const img = icono(p.id);
                      return (
                        <li
                          key={p.id}
                          className={`flex items-center gap-2 rounded border p-2 ${
                            n > 0 ? 'border-theme-main/50 bg-surface-low' : 'border-outline-ghost/60 opacity-50 grayscale'
                          }`}
                        >
                          {img ? <img src={urlDelServidor(img)} alt="" className="h-9 w-9 object-contain" /> : <span className="h-9 w-9" aria-hidden="true" />}
                          <span className="flex-1 text-sm">{nombre(p.id)}</span>
                          <span className="text-sm tabular-nums text-on-surface-muted">
                            {n > 0 ? (
                              <>
                                × {n}
                                <span className="sr-only">: jugado {n === 1 ? '1 vez' : `${n} veces`}</span>
                              </>
                            ) : (
                              <span className="sr-only">: no jugado</span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {r.guiones.length > 0 && (
        <section aria-labelledby="estadisticas-guiones">
          <h3 id="estadisticas-guiones" className={titulo}>
            Guiones más jugados
          </h3>
          <ul className="flex flex-wrap gap-2">
            {r.guiones.map((g) => (
              <li key={g.id} className="rounded border border-outline-ghost bg-surface-low px-3 py-1.5 text-sm">
                {g.id} <span className="text-on-surface-muted">× {g.veces}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {r.ultimas.length > 0 && (
        <section aria-labelledby="estadisticas-ultimas">
          <h3 id="estadisticas-ultimas" className={titulo}>
            Últimas partidas
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-on-surface-muted">
                <tr className="border-b border-outline-ghost">
                  <th scope="col" className="py-2 pr-3 font-semibold">Fecha</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Guion</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Roles</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Bando</th>
                  <th scope="col" className="py-2 font-semibold">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {r.ultimas.map((p) => (
                  <FilaPartida key={p.partidaId} p={p} nombre={nombre} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};

const COLOR_NIVEL: Record<NivelLogro, string> = {
  bronce: 'text-[#cd8a4f]',
  plata: 'text-[#c9d1d9]',
  oro: 'text-gold-bright',
  platino: 'text-[#a9d4f5]',
};
const NOMBRE_NIVEL: Record<NivelLogro, string> = { bronce: 'Bronce', plata: 'Plata', oro: 'Oro', platino: 'Platino' };

/**
 * Los logros, como los trofeos de una consola: cada vez que su personaje se ha
 * activado (lo que marca el narrador al revelar el grimorio). Los que faltan se
 * ven en gris; el de platino, al tenerlos todos.
 */
const Logros = ({ conseguidos }: { conseguidos: Map<string, number> }) => {
  const total = LOGROS.filter((l) => conseguidos.has(l.id)).length;
  const platino = total === LOGROS.length;
  return (
    <section aria-labelledby="estadisticas-logros">
      <h3 id="estadisticas-logros" className={titulo}>
        <Trophy className="w-5 h-5" aria-hidden="true" /> Logros
        <span className="font-body text-sm font-normal text-on-surface-muted">
          · {total} de {LOGROS.length}
        </span>
      </h3>
      {/* La barra de progreso, como en las consolas */}
      <div
        role="progressbar"
        aria-label="Logros conseguidos"
        aria-valuemin={0}
        aria-valuemax={LOGROS.length}
        aria-valuenow={total}
        className="mb-4 h-2 overflow-hidden rounded-full border border-outline-ghost bg-surface-low"
      >
        <div className="h-full bg-theme-main transition-[width]" style={{ width: `${(total / LOGROS.length) * 100}%` }} />
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {[LOGRO_PLATINO, ...LOGROS].map((l) => (
          <TarjetaLogro key={l.id} logro={l} veces={l.id === 'platino' ? (platino ? 1 : 0) : (conseguidos.get(l.id) ?? 0)} />
        ))}
      </ul>
    </section>
  );
};

const TarjetaLogro = ({ logro, veces }: { logro: Logro; veces: number }) => {
  const conseguido = veces > 0;
  return (
    <li
      className={`flex items-center gap-3 rounded border p-3 ${
        conseguido ? 'border-theme-main/50 bg-surface-low shadow-[0_0_14px_rgba(212,175,106,0.12)]' : 'border-outline-ghost/60 opacity-55'
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border ${
          conseguido ? `border-current ${COLOR_NIVEL[logro.nivel]}` : 'border-outline-ghost text-on-surface-muted'
        }`}
      >
        {conseguido ? <Trophy className="h-6 w-6" /> : <Lock className="h-5 w-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-on-surface">{logro.nombre}</span>
        <span className="block text-xs text-on-surface-muted">{logro.descripcion}</span>
        <span className="mt-0.5 block font-ui text-[0.68rem] font-semibold uppercase tracking-[0.15em]">
          <span className={conseguido ? COLOR_NIVEL[logro.nivel] : 'text-on-surface-muted'}>{NOMBRE_NIVEL[logro.nivel]}</span>
          <span className="text-on-surface-muted">
            {' · '}
            {conseguido ? (logro.id === 'platino' ? 'conseguido' : veces === 1 ? 'conseguido 1 vez' : `conseguido ${veces} veces`) : 'bloqueado'}
          </span>
        </span>
      </span>
    </li>
  );
};

const Cifra = ({ titulo, valor, detalle, clase = 'text-on-surface' }: { titulo: string; valor: number | string; detalle?: string; clase?: string }) => (
  <div className="rounded border border-outline-ghost bg-surface-low p-3">
    <dt className="text-xs text-on-surface-muted">{titulo}</dt>
    <dd className={`font-display text-2xl tabular-nums ${clase}`}>
      {valor}
      {detalle && <span className="block font-body text-xs text-on-surface-muted">{detalle}</span>}
    </dd>
  </div>
);

const FilaPartida = ({ p, nombre }: { p: Participacion; nombre: (id: string) => string }) => {
  const fecha = new Date(p.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  if (p.papel === 'narrador') {
    return (
      <tr className="border-b border-outline-ghost/50">
        <td className="py-2 pr-3 whitespace-nowrap">{fecha}</td>
        <td className="py-2 pr-3">{p.guion ?? '—'}</td>
        <td className="py-2 pr-3 italic text-on-surface-muted" colSpan={2}>
          Narrador
        </td>
        <td className="py-2">Ganó el {p.ganador === 'bueno' ? 'bueno' : 'malvado'}</td>
      </tr>
    );
  }
  const cambio = p.alineamientoInicial && p.alineamientoFinal && p.alineamientoInicial !== p.alineamientoFinal;
  return (
    <tr className="border-b border-outline-ghost/50">
      <td className="py-2 pr-3 whitespace-nowrap">{fecha}</td>
      <td className="py-2 pr-3">{p.guion ?? '—'}</td>
      <td className="py-2 pr-3">{p.roles.length ? p.roles.map(nombre).join(' → ') : '—'}</td>
      <td className="py-2 pr-3 whitespace-nowrap">
        {cambio ? (
          <>
            <span className={colorBando(p.alineamientoInicial)}>{bando(p.alineamientoInicial)}</span> →{' '}
            <span className={colorBando(p.alineamientoFinal)}>{bando(p.alineamientoFinal)}</span>
          </>
        ) : (
          <span className={colorBando(p.alineamientoFinal)}>{bando(p.alineamientoFinal)}</span>
        )}
      </td>
      <td className="py-2 whitespace-nowrap">
        {p.gano === null ? '—' : p.gano ? <span className="text-gold-bright">Ganó</span> : 'Perdió'}
        {p.vivo !== null && <span className="text-on-surface-muted"> · {p.vivo ? 'vivo' : 'muerto'}</span>}
      </td>
    </tr>
  );
};

export default PanelEstadisticas;
