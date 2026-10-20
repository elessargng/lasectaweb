import { BarChart3, History, Lock, ScrollText, Trophy, Users } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { LOGRO_PLATINO, LOGROS, type Logro, type NivelLogro } from '../../data/logros';
import { urlDelServidor } from '../../utils/api';
import type { ResumenEstadisticas } from '../../utils/estadisticasApi';
import HistorialPartidas from './HistorialPartidas';
import Pestanas from './Pestanas';
import NombrePersonaje from './NombrePersonaje';
import TextoLogro from './TextoLogro';
import { porcentaje, TIPOS, usePersonajes, veces, type DatosPersonajes } from './personajes';

const titulo = 'text-xl font-display text-theme-main flex items-center gap-2 mb-4';
const PESTANAS = ['general', 'roles', 'logros', 'historial'] as const;

/**
 * Las estadísticas de alguien, en pestañas: General (las cifras), Roles (los
 * personajes jugados), Logros e Historial (cada partida). La pestaña va en la
 * dirección (?pestana=historial), así que se puede enlazar y volver a ella.
 */
const PanelEstadisticas = ({ resumen: r, propias }: { resumen: ResumenEstadisticas; propias: boolean }) => {
  const [params, setParams] = useSearchParams();
  const pedida = params.get('pestana');
  const activa = PESTANAS.find((p) => p === pedida) ?? 'general';
  const personajes = usePersonajes(r);
  const logros = new Map(r.causas.map((x) => [x.id, x.veces]));
  const conseguidos = LOGROS.filter((l) => logros.has(l.id)).length;

  return (
    <div className="space-y-6">
      {propias && (
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-on-surface-muted">
          <Lock className="h-4 w-4" aria-hidden="true" />
          Tus estadísticas son {r.publicas ? 'públicas: las ve cualquiera' : 'privadas: solo las ves tú'}.
          <Link to="/profile" className="text-theme-main hover:underline">
            Cambiarlo en tu perfil
          </Link>
        </p>
      )}
      <Pestanas
        etiqueta="Estadísticas"
        activa={activa}
        onCambiar={(id) => setParams(id === 'general' ? {} : { pestana: id }, { replace: true })}
        pestanas={[
          { id: 'general', titulo: 'General', icono: <BarChart3 className="h-4 w-4" aria-hidden="true" />, contenido: <General r={r} /> },
          { id: 'roles', titulo: 'Roles', icono: <Users className="h-4 w-4" aria-hidden="true" />, contenido: <Roles r={r} personajes={personajes} /> },
          {
            id: 'logros',
            titulo: 'Logros',
            contador: `${conseguidos}/${LOGROS.length}`,
            contadorLector: `${conseguidos} de ${LOGROS.length}`,
            icono: <Trophy className="h-4 w-4" aria-hidden="true" />,
            contenido: <Logros conseguidos={logros} personajes={personajes} />,
          },
          {
            id: 'historial',
            titulo: 'Historial',
            icono: <History className="h-4 w-4" aria-hidden="true" />,
            contenido: <HistorialPartidas usuario={r.usuario} propias={propias} personajes={personajes} />,
          },
        ]}
      />
    </div>
  );
};

/** La pestaña General: lo principal en grande, cómo le va en cada bando y el resto de cifras. */
const General = ({ r }: { r: ResumenEstadisticas }) => {
  if (r.jugadas === 0 && r.narradas === 0) {
    return <p className="text-on-surface-muted">Todavía no hay ninguna partida terminada en la sala.</p>;
  }
  return (
    <div className="space-y-10">
      <section aria-labelledby="estadisticas-resumen">
        <h3 id="estadisticas-resumen" className="sr-only">
          Resumen
        </h3>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Medallon titulo="Partidas jugadas" valor={r.jugadas} />
          <Medallon titulo="Victorias" valor={porcentaje(r.ganadas, r.jugadas)} detalle={`${r.ganadas} de ${r.jugadas}`} />
          <Medallon titulo="Partidas narradas" valor={r.narradas} />
        </dl>
      </section>

      <section aria-labelledby="estadisticas-bandos">
        <h3 id="estadisticas-bandos" className={titulo}>
          Por bando
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <BarraBando bando="bueno" titulo="En el bien" ganadas={r.porBando.bueno.ganadas} jugadas={r.porBando.bueno.jugadas} empezo={r.empezo.bueno} />
          <BarraBando
            bando="malvado"
            titulo="En el mal"
            ganadas={r.porBando.malvado.ganadas}
            jugadas={r.porBando.malvado.jugadas}
            empezo={r.empezo.malvado}
          />
        </div>
      </section>

      <section aria-labelledby="estadisticas-cifras">
        <h3 id="estadisticas-cifras" className={titulo}>
          En la plaza
        </h3>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Cifra titulo="Vivo al final" valor={r.vivoAlFinal} detalle={porcentaje(r.vivoAlFinal, r.jugadas)} />
          <Cifra titulo="Cambios de bando" valor={r.cambiosDeBando} />
          <Cifra titulo="Nominaciones hechas" valor={r.nominaciones} />
          <Cifra titulo="Veces nominado" valor={r.nominado} />
          <Cifra titulo="Votos" valor={r.votos} />
          <Cifra titulo="Veces ejecutado" valor={r.ejecutado} />
        </dl>
      </section>

      {r.guiones.length > 0 && (
        <section aria-labelledby="estadisticas-guiones">
          <h3 id="estadisticas-guiones" className={titulo}>
            <ScrollText className="h-5 w-5" aria-hidden="true" /> Guiones más jugados
          </h3>
          <ol className="space-y-2">
            {r.guiones.slice(0, 8).map((g) => (
              <li key={g.id} className="relative overflow-hidden rounded border border-outline-ghost bg-surface-low px-4 py-2.5">
                {/* La barra, proporcional al más jugado (solo visual: el número ya lo dice) */}
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-gold/15 to-gold/5"
                  style={{ width: `${(g.veces / r.guiones[0].veces) * 100}%` }}
                />
                <span className="relative flex items-center justify-between gap-3">
                  <span className="font-display text-on-surface">{g.id}</span>
                  <span className="text-sm tabular-nums text-on-surface-muted">{g.veces === 1 ? '1 partida' : `${g.veces} partidas`}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
};

/** Una cifra principal, grande, en un medallón con filo de latón. */
const Medallon = ({ titulo: t, valor, detalle }: { titulo: string; valor: number | string; detalle?: string }) => (
  <div className="panel-premium flex flex-col items-center rounded-sm px-4 py-6 text-center">
    <dt className="font-ui text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-on-surface-muted">{t}</dt>
    <dd className="mt-2">
      <span className="text-gilded block font-display text-5xl leading-none tabular-nums">{valor}</span>
      {detalle && <span className="mt-2 block text-xs text-on-surface-muted">{detalle}</span>}
    </dd>
  </div>
);

/** Cómo le va en un bando: partidas acabadas en él, cuántas ganadas (con su barra) y cuántas empezó en él. */
const BarraBando = ({ bando, titulo: t, ganadas, jugadas, empezo }: { bando: 'bueno' | 'malvado'; titulo: string; ganadas: number; jugadas: number; empezo: number }) => {
  const color = bando === 'bueno' ? 'text-good-bright' : 'text-blood-bright';
  const relleno = bando === 'bueno' ? 'from-good to-good-bright' : 'from-blood to-blood-bright';
  const ancho = jugadas > 0 ? (ganadas / jugadas) * 100 : 0;
  return (
    <div className="rounded border border-outline-ghost bg-surface-low p-4">
      <p className={`font-display text-lg ${color}`}>{t}</p>
      <p className="mt-1 text-sm text-on-surface">
        Ganadas <span className="tabular-nums">{ganadas}</span> de <span className="tabular-nums">{jugadas}</span>
        <span className="text-on-surface-muted"> · {porcentaje(ganadas, jugadas)}</span>
      </p>
      <div aria-hidden="true" className="mt-3 h-2 overflow-hidden rounded-full bg-background/60">
        <div className={`h-full rounded-full bg-gradient-to-r ${relleno}`} style={{ width: `${ancho}%` }} />
      </div>
      <p className="mt-2 text-xs text-on-surface-muted">Empezó en este bando {veces(empezo)}.</p>
    </div>
  );
};

/** La pestaña Roles: los favoritos y todos los personajes que existen, jugados (con cuántas veces) o por jugar. */
const Roles = ({ r, personajes }: { r: ResumenEstadisticas; personajes: DatosPersonajes }) => {
  const { catalogo, nombre, icono } = personajes;
  const vecesRol = new Map(r.roles.map((x) => [x.id, x.veces]));
  const favoritos = r.roles.slice(0, 3);
  return (
    <div className="space-y-10">
      {favoritos.length > 0 && (
        <section aria-labelledby="estadisticas-favoritos">
          <h3 id="estadisticas-favoritos" className={titulo}>
            Los más jugados
          </h3>
          <ol className="grid gap-4 sm:grid-cols-3">
            {favoritos.map((f, i) => {
              const img = icono(f.id);
              return (
                <li key={f.id} className="panel-premium flex flex-col items-center rounded-sm p-5 text-center">
                  <span aria-hidden="true" className="font-ui text-xs font-semibold uppercase tracking-[0.3em] text-gold">
                    {['I', 'II', 'III'][i]}
                  </span>
                  {img ? (
                    <img src={urlDelServidor(img)} alt="" className="my-2 h-20 w-20 object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.7)]" />
                  ) : (
                    <span className="my-2 h-20 w-20" aria-hidden="true" />
                  )}
                  <NombrePersonaje id={f.id} personajes={personajes} className="font-display text-lg text-on-surface-bright" />
                  <span className="text-sm text-on-surface-muted">{veces(f.veces)}</span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section aria-labelledby="estadisticas-personajes">
        <h3 id="estadisticas-personajes" className={titulo}>
          Todos los personajes
        </h3>
        <p className="-mt-2 mb-4 text-xs text-on-surface-muted">Cuenta el rol con el que empieza la partida y cada día; los cambios de la noche, no.</p>
        {!catalogo ? (
          <p className="text-on-surface-muted">Cargando personajes…</p>
        ) : (
          <div className="space-y-6">
            {TIPOS.map(({ tipo, titulo: t }) => {
              const deTipo = catalogo
                .filter((p) => p.tipo === tipo)
                .sort((a, b) => (vecesRol.get(b.id) ?? 0) - (vecesRol.get(a.id) ?? 0) || nombre(a.id).localeCompare(nombre(b.id), 'es'));
              if (deTipo.length === 0) return null;
              const jugados = deTipo.filter((p) => vecesRol.has(p.id)).length;
              const id = `estadisticas-tipo-${tipo}`;
              return (
                <div key={tipo}>
                  <h4 id={id} className="mb-2 font-ui text-sm font-semibold text-on-surface">
                    {t}{' '}
                    <span className="font-normal text-on-surface-muted">
                      · {jugados} de {deTipo.length} jugados
                    </span>
                  </h4>
                  <ul aria-labelledby={id} className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {deTipo.map((p) => {
                      const n = vecesRol.get(p.id) ?? 0;
                      const img = icono(p.id);
                      return (
                        <li
                          key={p.id}
                          className={`flex items-center gap-2 rounded border p-2 ${
                            n > 0 ? 'border-theme-main/50 bg-surface-low' : 'border-outline-ghost/60 opacity-50 grayscale'
                          }`}
                        >
                          {img ? <img src={urlDelServidor(img)} alt="" className="h-9 w-9 object-contain" /> : <span className="h-9 w-9" aria-hidden="true" />}
                          <NombrePersonaje id={p.id} personajes={personajes} className="flex-1 text-sm" />
                          <span className="text-sm tabular-nums text-on-surface-muted">
                            {n > 0 ? (
                              <>
                                <span aria-hidden="true">× {n}</span>
                                <span className="sr-only">: jugado {veces(n)}</span>
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
 * La pestaña Logros, como los trofeos de una consola: cada vez que su personaje se
 * ha activado (lo que marca el narrador al revelar el grimorio). Los que faltan se
 * ven en gris; el de platino, al tenerlos todos.
 */
const Logros = ({ conseguidos, personajes }: { conseguidos: Map<string, number>; personajes: DatosPersonajes }) => {
  const total = LOGROS.filter((l) => conseguidos.has(l.id)).length;
  const platino = total === LOGROS.length;
  return (
    <section aria-labelledby="estadisticas-logros">
      <h3 id="estadisticas-logros" className={titulo}>
        <Trophy className="h-5 w-5" aria-hidden="true" /> Logros
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
        className="mb-6 h-2 overflow-hidden rounded-full border border-outline-ghost bg-surface-low"
      >
        <div className="h-full bg-gradient-to-r from-gold-deep to-gold-bright" style={{ width: `${(total / LOGROS.length) * 100}%` }} />
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {[LOGRO_PLATINO, ...LOGROS].map((l) => (
          <TarjetaLogro
            key={l.id}
            logro={l}
            veces={l.id === 'platino' ? (platino ? 1 : 0) : (conseguidos.get(l.id) ?? 0)}
            personajes={personajes}
          />
        ))}
      </ul>
    </section>
  );
};

const TarjetaLogro = ({ logro, veces: n, personajes }: { logro: Logro; veces: number; personajes: DatosPersonajes }) => {
  const conseguido = n > 0;
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
        <span className="block text-xs text-on-surface-muted">
          <TextoLogro texto={logro.descripcion} personajes={personajes} />
          {logro.exigeVictoria && <span className="italic"> Solo cuenta si ganas.</span>}
        </span>
        <span className="mt-0.5 block font-ui text-[0.68rem] font-semibold uppercase tracking-[0.15em]">
          <span className={conseguido ? COLOR_NIVEL[logro.nivel] : 'text-on-surface-muted'}>{NOMBRE_NIVEL[logro.nivel]}</span>
          <span className="text-on-surface-muted">
            {' · '}
            {conseguido ? (logro.id === 'platino' ? 'conseguido' : `conseguido ${veces(n)}`) : 'bloqueado'}
          </span>
        </span>
      </span>
    </li>
  );
};

const Cifra = ({ titulo: t, valor, detalle, clase = 'text-on-surface' }: { titulo: string; valor: number | string; detalle?: string; clase?: string }) => (
  <div className="rounded border border-outline-ghost bg-surface-low p-3">
    <dt className="text-xs text-on-surface-muted">{t}</dt>
    <dd className={`font-display text-2xl tabular-nums ${clase}`}>
      {valor}
      {detalle && <span className="block font-body text-xs text-on-surface-muted">{detalle}</span>}
    </dd>
  </div>
);

export default PanelEstadisticas;
