import { ChevronDown, Crown, Feather, Gavel, Skull, Trophy, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LOGROS } from '../../data/logros';
import { CAUSAS_FINAL } from '../../sala/causasFinal';
import NombrePersonaje, { CadenaRoles } from './NombrePersonaje';
import TextoLogro from './TextoLogro';
import { getAvatarUrl, urlDelServidor } from '../../utils/api';
import { getHistorial, type AsientoHistorial, type PartidaHistorial, type ParticipanteHistorial } from '../../utils/estadisticasApi';
import { colorBando, fechaLarga, nombreBando, type Bando, type DatosPersonajes } from './personajes';

interface HistorialPartidasProps {
  /** De quién es el historial. */
  usuario: { userId: string; username: string };
  /** Es el de quien mira: se le habla de tú. */
  propias: boolean;
  personajes: DatosPersonajes;
}

type Filtro = 'todas' | 'jugadas' | 'narradas';
const POR_PAGINA = 8;
const idTitulo = (p: PartidaHistorial) => `historial-${p.partidaId}-titulo`;

/**
 * La pestaña Historial: cada partida que ha jugado o narrado, de la más reciente
 * a la más antigua, como una ficha de crónica. A la vista, el guion, la fecha, los
 * días, quién ganó y lo suyo (sus roles y si ganó); al abrirla («Ver la partida»),
 * la mesa entera (quién jugó, qué era, su bando y si acabó vivo), quién narró, los
 * NPCs, lo que pasó (los logros) y las nominaciones. De las partidas de antes de
 * guardar la mesa entera, solo se sabe de quienes tenían cuenta.
 *
 * Se filtra por jugadas o narradas y se cargan de 8 en 8 («Mostrar más»: el foco
 * va a la primera nueva).
 */
const HistorialPartidas = ({ usuario, propias, personajes }: HistorialPartidasProps) => {
  const { token } = useAuth();
  const [partidas, setPartidas] = useState<PartidaHistorial[] | null>(null);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [cuantas, setCuantas] = useState(POR_PAGINA);
  const focoRef = useRef<string | null>(null);

  useEffect(() => {
    getHistorial(usuario.userId, token)
      .then((h) => setPartidas(h.partidas))
      .catch((e: Error) => setError(e.message));
  }, [usuario.userId, token]);

  // Tras «Mostrar más», el foco va al título de la primera partida nueva
  useEffect(() => {
    const id = focoRef.current;
    if (!id) return;
    focoRef.current = null;
    document.getElementById(id)?.focus();
  });

  if (error) return <p className="text-on-surface-muted">{error}</p>;
  if (!partidas) return <p className="text-on-surface-muted">Cargando el historial…</p>;
  if (partidas.length === 0) {
    return <p className="text-on-surface-muted">{propias ? 'Todavía no has terminado ninguna partida en la sala.' : 'Todavía no hay partidas terminadas.'}</p>;
  }

  const filtradas = partidas.filter((p) => filtro === 'todas' || (filtro === 'jugadas' ? p.propia?.papel === 'jugador' : p.propia?.papel === 'narrador'));
  const visibles = filtradas.slice(0, cuantas);
  const cuenta = (f: Filtro) =>
    f === 'todas' ? partidas.length : partidas.filter((p) => p.propia?.papel === (f === 'jugadas' ? 'jugador' : 'narrador')).length;

  return (
    <section aria-labelledby="historial-titulo">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h3 id="historial-titulo" className="flex items-center gap-2 font-display text-xl text-theme-main">
          Crónica de partidas
        </h3>
        <div role="group" aria-label="Mostrar" className="flex rounded-full border border-gold/25 bg-surface-low p-1">
          {(['todas', 'jugadas', 'narradas'] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filtro === f}
              onClick={() => {
                setFiltro(f);
                setCuantas(POR_PAGINA);
              }}
              className="rounded-full px-3 py-1 font-ui text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-muted transition-colors hover:text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main aria-pressed:bg-gold/20 aria-pressed:text-gold-bright motion-reduce:transition-none"
            >
              {f === 'todas' ? 'Todas' : f === 'jugadas' ? 'Jugadas' : 'Narradas'}{' '}
              <span className="tabular-nums opacity-70">{cuenta(f)}</span>
            </button>
          ))}
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="text-on-surface-muted">No hay partidas {filtro === 'jugadas' ? 'jugadas' : 'narradas'}.</p>
      ) : (
        <ol className="space-y-5">
          {visibles.map((p) => (
            <li key={p.partidaId}>
              <TarjetaPartida partida={p} usuario={usuario} propias={propias} personajes={personajes} />
            </li>
          ))}
        </ol>
      )}

      {filtradas.length > cuantas && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => {
              focoRef.current = idTitulo(filtradas[cuantas]);
              setCuantas(cuantas + POR_PAGINA);
            }}
            className="btn-runic btn-runic-secondary px-5 py-2 text-sm"
          >
            Mostrar más ({filtradas.length - cuantas} más)
          </button>
        </div>
      )}
    </section>
  );
};

interface TarjetaPartidaProps {
  partida: PartidaHistorial;
  usuario: { userId: string; username: string };
  propias: boolean;
  personajes: DatosPersonajes;
}

/** Una partida del historial: su cabecera siempre a la vista y, desplegada, todo lo demás. */
const TarjetaPartida = ({ partida: p, usuario, propias, personajes }: TarjetaPartidaProps) => {
  const [abierta, setAbierta] = useState(false);
  const { icono } = personajes;
  const yo = p.propia;
  const narro = yo?.papel === 'narrador';
  const rolFinal = yo?.rolFinal ?? yo?.roles[yo.roles.length - 1] ?? null;
  const imagen = rolFinal ? icono(rolFinal) : null;
  const idDetalle = `historial-${p.partidaId}-detalle`;
  // Quién habla: «Ganaste» o «Ganó»
  const tu = (segunda: string, tercera: string) => (propias ? segunda : tercera);
  const resultado = narro
    ? { texto: tu('Narraste', 'Narró'), clase: 'border-gold/40 text-gold-bright' }
    : yo?.gano === true
      ? { texto: 'Victoria', clase: 'border-gold-bright/60 bg-gold/10 text-gold-bright' }
      : yo?.gano === false
        ? { texto: 'Derrota', clase: 'border-outline-ghost text-on-surface-muted' }
        : null;

  return (
    <article
      aria-labelledby={idTitulo(p)}
      className="panel-premium relative overflow-hidden rounded-sm"
    >
      {/* El bando ganador, como un filo de color a la izquierda */}
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${p.ganador === 'bueno' ? 'bg-good' : 'bg-blood'}`} />
      <div className="flex flex-col gap-4 p-5 pl-6 sm:flex-row sm:items-center">
        {/* Su personaje (el último) o la pluma del narrador, en un medallón */}
        <span
          aria-hidden="true"
          className="flex h-20 w-20 shrink-0 items-center justify-center self-center rounded-full border border-gold/30 bg-[radial-gradient(circle_at_50%_35%,rgba(212,175,106,0.18),transparent_70%)] shadow-[inset_0_0_12px_rgba(0,0,0,0.6)]"
        >
          {narro ? (
            <Feather className="h-9 w-9 text-gold-bright" strokeWidth={1.5} />
          ) : imagen ? (
            <img src={urlDelServidor(imagen)} alt="" className="h-16 w-16 object-contain drop-shadow-[0_3px_6px_rgba(0,0,0,0.8)]" />
          ) : (
            <Users className="h-8 w-8 text-on-surface-muted" strokeWidth={1.5} />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-ui text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-on-surface-muted">
            {fechaLarga(p.fecha)} · {p.dias === 1 ? '1 día' : `${p.dias} días`}
          </p>
          <h4 id={idTitulo(p)} tabIndex={-1} className="mt-1 font-display text-2xl leading-tight text-on-surface-bright focus:outline-none">
            {p.guion ?? 'Partida sin guion'}
          </h4>
          <p className="mt-1 text-sm">
            <span className={colorBando(p.ganador)}>Ganó el {p.ganador === 'bueno' ? 'bien' : 'mal'}</span>
            {yo && !narro && yo.roles.length > 0 && (
              <>
                <span className="text-on-surface-muted"> · </span>
                <span className="text-on-surface">
                  <CadenaRoles roles={yo.roles} personajes={personajes} />
                  {yo.alineamientoFinal && (
                    <span className={colorBando(yo.alineamientoFinal)}> ({nombreBando(yo.alineamientoFinal).toLocaleLowerCase('es')})</span>
                  )}
                </span>
                {yo.vivo !== null && <span className="text-on-surface-muted"> · {yo.vivo ? tu('acabaste vivo', 'acabó vivo') : tu('acabaste muerto', 'acabó muerto')}</span>}
              </>
            )}
          </p>
        </div>

        <div className="flex shrink-0 flex-row items-center gap-3 sm:flex-col sm:items-end">
          {resultado && (
            <span className={`rounded-full border px-3 py-1 font-ui text-xs font-semibold uppercase tracking-[0.18em] ${resultado.clase}`}>
              {yo?.gano && <Crown className="mr-1 inline h-3.5 w-3.5 -translate-y-px" aria-hidden="true" />}
              {resultado.texto}
            </span>
          )}
          <button
            type="button"
            aria-expanded={abierta}
            aria-controls={idDetalle}
            onClick={() => setAbierta(!abierta)}
            className="flex items-center gap-1 rounded px-2 py-1 font-ui text-xs font-semibold uppercase tracking-[0.14em] text-theme-main hover:bg-theme-main/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main"
          >
            Ver la partida
            <ChevronDown className={`h-4 w-4 transition-transform motion-reduce:transition-none ${abierta ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div id={idDetalle} hidden={!abierta} className="border-t border-gold/15 bg-background/30 px-5 py-6 sm:px-8">
        {abierta && <DetallePartida partida={p} usuario={usuario} propias={propias} personajes={personajes} />}
      </div>
    </article>
  );
};

const subtitulo = 'mb-3 flex items-center gap-2 font-ui text-xs font-semibold uppercase tracking-[0.2em] text-gold';

/** Lo de dentro de una partida: la mesa, la narración, los NPCs, lo que pasó, las nominaciones y sus cifras. */
const DetallePartida = ({ partida: p, usuario, propias, personajes }: TarjetaPartidaProps) => {
  const yo = p.propia;
  const narradores = p.narradoresNombres ?? [
    ...(yo?.papel === 'narrador' ? [usuario.username] : []),
    ...p.participantes.filter((x) => x.papel === 'narrador').map((x) => x.username),
  ];
  // Lo que pasó (lo que marcó el narrador) y si le dio el logro (los que exigen ganar, solo si ganó)
  const pasado = p.causas.flatMap((c) => {
    const causa = CAUSAS_FINAL.find((x) => x.personaje === c);
    if (!causa) return [];
    const logro = LOGROS.find((x) => x.id === c);
    const conseguido = !!logro && !!yo?.causas.includes(c) && (!logro.exigeVictoria || !!yo.gano);
    return [{ id: c, texto: causa.texto, logro: conseguido ? logro : null }];
  });
  const dias = [...new Set((p.votaciones ?? []).map((v) => v.dia))].sort((a, b) => a - b);

  return (
    <div className="space-y-8">
      <section aria-labelledby={`${p.partidaId}-mesa`}>
        <h5 id={`${p.partidaId}-mesa`} className={subtitulo}>
          <Users className="h-4 w-4" aria-hidden="true" /> La mesa
        </h5>
        {p.mesa ? (
          <ol className="grid gap-2 sm:grid-cols-2">
            {p.mesa.map((a) => (
              <AsientoMesa key={a.numero} asiento={a} ganador={p.ganador} esSuyo={a.userId === usuario.userId} propias={propias} personajes={personajes} />
            ))}
          </ol>
        ) : (
          <>
            <ul className="grid gap-2 sm:grid-cols-2">
              {[...(yo?.papel === 'jugador' ? [{ ...yo, username: usuario.username, userId: usuario.userId }] : []), ...p.participantes]
                .filter((x) => x.papel === 'jugador')
                .map((x) => (
                  <JugadorConCuenta key={x.userId} jugador={x} esSuyo={x.userId === usuario.userId} propias={propias} ganador={p.ganador} personajes={personajes} />
                ))}
            </ul>
            <p className="mt-3 text-xs text-on-surface-muted">
              De esta partida solo se guardó a quienes jugaban con cuenta
              {p.ocultos > 0 && ` (y ${p.ocultos === 1 ? 'otra persona tiene' : `otras ${p.ocultos} personas tienen`} las estadísticas privadas)`}.
            </p>
          </>
        )}
      </section>

      <div className="grid gap-8 sm:grid-cols-2">
        <section aria-labelledby={`${p.partidaId}-narracion`}>
          <h5 id={`${p.partidaId}-narracion`} className={subtitulo}>
            <Feather className="h-4 w-4" aria-hidden="true" /> Narración
          </h5>
          <p className="text-sm text-on-surface">{narradores.length ? narradores.join(', ') : 'Sin datos'}</p>
        </section>

        {p.npcs && p.npcs.length > 0 && (
          <section aria-labelledby={`${p.partidaId}-npcs`}>
            <h5 id={`${p.partidaId}-npcs`} className={subtitulo}>
              NPCs
            </h5>
            <ul className="flex flex-wrap gap-2">
              {p.npcs.map((id) => (
                <li key={id} className="flex items-center gap-1.5 rounded-full border border-gold/25 py-0.5 pl-1 pr-3 text-sm">
                  <IconoPersonaje id={id} personajes={personajes} clase="h-6 w-6" />
                  <NombrePersonaje id={id} personajes={personajes} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {pasado.length > 0 && (
        <section aria-labelledby={`${p.partidaId}-logros`}>
          <h5 id={`${p.partidaId}-logros`} className={subtitulo}>
            <Trophy className="h-4 w-4" aria-hidden="true" /> Lo que pasó
          </h5>
          <ul className="space-y-3">
            {pasado.map(({ id, texto, logro }) => (
              <li key={id} className="flex items-start gap-3 text-sm">
                <IconoPersonaje id={id} personajes={personajes} clase="h-8 w-8" />
                <span className="min-w-0 flex-1">
                  <span className="text-on-surface">
                    <NombrePersonaje id={id} personajes={personajes} destacado />: {texto.charAt(0).toLocaleLowerCase('es') + texto.slice(1)}.
                  </span>
                  {logro && (
                    <span className="mt-1 flex items-center gap-1.5 text-xs text-on-surface-muted">
                      <Trophy className="h-3.5 w-3.5 shrink-0 text-gold-bright" aria-hidden="true" />
                      <span>
                        {propias ? 'Conseguiste' : 'Consiguió'} el logro <span className="font-display text-on-surface-bright">«{logro.nombre}»</span>:{' '}
                        <TextoLogro texto={logro.descripcion} personajes={personajes} />
                      </span>
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {p.votaciones && p.votaciones.length > 0 && (
        <section aria-labelledby={`${p.partidaId}-nominaciones`}>
          <h5 id={`${p.partidaId}-nominaciones`} className={subtitulo}>
            <Gavel className="h-4 w-4" aria-hidden="true" /> Nominaciones
          </h5>
          <div className="space-y-4">
            {dias.map((dia) => (
              <div key={dia}>
                <p className="mb-1 font-display text-on-surface">Día {dia}</p>
                <ul className="space-y-1.5 border-l border-gold/20 pl-4">
                  {p.votaciones!
                    .filter((v) => v.dia === dia)
                    .map((v) => (
                      <li key={v.hora} className="text-sm">
                        <span className="text-on-surface">
                          {mayuscula(v.nomina)} nomina a {v.nominado}
                        </span>
                        <span className="text-on-surface-muted">
                          {' · '}
                          {v.votos === null ? 'sin votación' : v.votos === 1 ? '1 voto' : `${v.votos} votos`}
                          {v.votantes && v.votantes.length > 0 && ` (${v.votantes.join(', ')})`}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {yo?.papel === 'jugador' && (
        <section aria-labelledby={`${p.partidaId}-cifras`}>
          <h5 id={`${p.partidaId}-cifras`} className={subtitulo}>
            {propias ? 'Tus cifras' : 'Sus cifras'}
          </h5>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['Nominaciones hechas', yo.nominaciones],
              ['Veces nominado', yo.nominado],
              ['Votos', yo.votos],
              ['Ejecutado', yo.ejecutado],
            ].map(([t, n]) => (
              <div key={t} className="rounded border border-outline-ghost bg-surface-low px-3 py-2">
                <dt className="text-xs text-on-surface-muted">{t}</dt>
                <dd className="font-display text-xl tabular-nums text-on-surface">{n}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
};

const mayuscula = (t: string) => t.charAt(0).toLocaleUpperCase('es') + t.slice(1);

/** El icono de un personaje (decorativo: su nombre va al lado), o un hueco del mismo tamaño. */
const IconoPersonaje = ({ id, personajes, clase }: { id: string | null; personajes: DatosPersonajes; clase: string }) => {
  const img = id ? personajes.icono(id) : null;
  return img ? <img src={urlDelServidor(img)} alt="" className={`${clase} shrink-0 object-contain`} /> : <span aria-hidden="true" className={`${clase} shrink-0`} />;
};

/** Un asiento de la mesa guardada: número, quién, qué era (y qué creía ser), su bando y si acabó muerto. */
const AsientoMesa = ({
  asiento: a,
  ganador,
  esSuyo,
  propias,
  personajes,
}: {
  asiento: AsientoHistorial;
  ganador: Bando;
  esSuyo: boolean;
  propias: boolean;
  personajes: DatosPersonajes;
}) => {
  const gano = !!a.alineamiento && a.alineamiento === ganador;
  return (
    <li
      className={`flex items-center gap-3 rounded border p-2 pr-3 ${
        esSuyo ? 'border-gold-bright/60 bg-gold/10' : 'border-outline-ghost bg-surface-low'
      } ${a.muerto ? 'opacity-75' : ''}`}
    >
      <span aria-hidden="true" className="w-5 shrink-0 text-center font-ui text-xs text-on-surface-muted tabular-nums">
        {a.numero}
      </span>
      <span className="sr-only">Asiento {a.numero}:</span>
      <IconoPersonaje id={a.personaje} personajes={personajes} clase="h-10 w-10" />
      <span className="min-w-0 flex-1 text-sm">
        {a.oculto ? (
          <span className="italic text-on-surface-muted">Estadísticas privadas</span>
        ) : (
          <>
            <span className="block truncate font-semibold text-on-surface">
              {a.nombre ?? <span className="font-normal italic text-on-surface-muted">Libre</span>}
              {esSuyo && propias && <span className="font-normal text-on-surface-muted"> (tú)</span>}
            </span>
            {a.personaje && (
              <span className="block truncate">
                <NombrePersonaje id={a.personaje} personajes={personajes} className={colorBando(a.alineamiento)} />
                {a.ficha && (
                  <span className="text-on-surface-muted">
                    {' · se creía '}
                    <NombrePersonaje id={a.ficha} personajes={personajes} />
                  </span>
                )}
                <span className="sr-only">, {nombreBando(a.alineamiento).toLocaleLowerCase('es')}</span>
              </span>
            )}
          </>
        )}
      </span>
      {a.muerto && (
        <>
          <Skull className="h-4 w-4 shrink-0 text-on-surface-muted" aria-hidden="true" />
          <span className="sr-only">, muerto</span>
        </>
      )}
      {gano && !a.oculto && (
        <>
          <Crown className="h-4 w-4 shrink-0 text-gold-bright" aria-hidden="true" />
          <span className="sr-only">, ganó</span>
        </>
      )}
    </li>
  );
};

/** Un jugador con cuenta de una partida de antes de guardar la mesa entera. */
const JugadorConCuenta = ({
  jugador: x,
  esSuyo,
  propias,
  ganador,
  personajes,
}: {
  jugador: ParticipanteHistorial;
  esSuyo: boolean;
  propias: boolean;
  ganador: Bando;
  personajes: DatosPersonajes;
}) => {
  const rol = x.rolFinal ?? x.roles[x.roles.length - 1] ?? null;
  return (
    <li className={`flex items-center gap-3 rounded border p-2 pr-3 ${esSuyo ? 'border-gold-bright/60 bg-gold/10' : 'border-outline-ghost bg-surface-low'}`}>
      <img src={getAvatarUrl(x.profilePicture)} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
      <span className="min-w-0 flex-1 text-sm">
        <span className="block truncate font-semibold text-on-surface">
          {x.username}
          {esSuyo && propias && <span className="font-normal text-on-surface-muted"> (tú)</span>}
        </span>
        <span className="block truncate">
          <span className={colorBando(x.alineamientoFinal)}>{x.roles.length ? <CadenaRoles roles={x.roles} personajes={personajes} /> : '—'}</span>
          <span className="sr-only">, {nombreBando(x.alineamientoFinal).toLocaleLowerCase('es')}</span>
        </span>
      </span>
      <IconoPersonaje id={rol} personajes={personajes} clase="h-8 w-8" />
      {x.vivo === false && (
        <>
          <Skull className="h-4 w-4 shrink-0 text-on-surface-muted" aria-hidden="true" />
          <span className="sr-only">, muerto</span>
        </>
      )}
      {x.alineamientoFinal === ganador && (
        <>
          <Crown className="h-4 w-4 shrink-0 text-gold-bright" aria-hidden="true" />
          <span className="sr-only">, ganó</span>
        </>
      )}
    </li>
  );
};

export default HistorialPartidas;
