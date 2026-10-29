import { MousePointerClick, X } from 'lucide-react';
import { Fragment, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { urlDelServidor } from '../utils/api';
import { useAriaLive } from './avisosConfig';
import { nombreFase } from './avisosSala';
import {
  autorDe,
  NOMBRE_BANDO,
  FICHAS_DESPERTAR,
  fichaDespertar,
  nombreDeAsiento,
  TARJETAS_DESPERTAR,
  tarjetaDespertar,
  textoEleccion,
  type AdjuntoDespertar,
  type Envio,
  type TarjetaDespertar,
} from './despertar';
import { botonPrincipal, botonSecundario, campo } from './estilos';
import { useElegirEnPlaza } from './elegirEnPlaza';
import { alineamientoDe, iconoDe } from './fichas';
import { porTipos, type PersonajeMostrado } from './guiones';
import type { MensajeDespertar, SalaAlineamiento, SalaEstado, SalaResultado } from './useSala';

const foco = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main';
const MAX_TEXTO = 200;

/** La tarjeta pintada: fondo de su color, marco de latón, icono y su texto en mayúsculas. */
export const TarjetaVisual = ({ tarjeta, grande = false }: { tarjeta: TarjetaDespertar; grande?: boolean }) => (
  <span
    className={`flex flex-col items-center justify-between gap-2 rounded-lg border-2 border-gold/80 bg-gradient-to-b ${tarjeta.fondo} p-2 text-center font-ui font-semibold uppercase leading-tight text-on-surface-bright shadow-lg ${
      grande ? 'h-64 w-44 text-lg' : 'h-36 w-24 text-[0.7rem]'
    }`}
  >
    <tarjeta.Icono aria-hidden="true" size={grande ? 64 : 36} strokeWidth={1.25} className="mt-2 text-parchment/80" />
    <span>{tarjeta.texto}</span>
  </span>
);

/** Un personaje con su icono (el de su alineamiento, si se dice) y su nombre (en su idioma). */
const PersonajeVisto = ({
  personaje,
  alineamiento = null,
  grande,
}: {
  personaje: PersonajeMostrado;
  alineamiento?: SalaAlineamiento | null;
  grande?: boolean;
}) => {
  // Sin alineamiento (no se le dice), el icono de por defecto: el de su bando lo diría
  const icono = alineamiento ? iconoDe(personaje, alineamiento) : (personaje.icono ?? iconoDe(personaje, null));
  return (
    <span className="inline-flex flex-col items-center gap-1 text-center">
      {icono ? (
        <img src={urlDelServidor(icono)} alt="" className={grande ? 'h-20 w-20 object-contain' : 'h-8 w-8 object-contain'} />
      ) : null}
      <span lang={personaje.nombre.lang} className={grande ? 'text-base' : 'text-xs'}>
        {personaje.nombre.texto}
      </span>
    </span>
  );
};

interface MensajeVistoProps {
  mensaje: MensajeDespertar;
  estado: SalaEstado;
  personajes: Map<string, PersonajeMostrado>;
  /** En grande: lo último que muestra el narrador al jugador despierto. */
  grande?: boolean;
}

/** Lo que dice un mensaje: su tarjeta o su ficha, y los jugadores, personajes o texto que lleva. */
export const MensajeVisto = ({ mensaje, estado, personajes, grande = false }: MensajeVistoProps) => {
  const tarjeta = tarjetaDespertar(mensaje.tarjeta);
  const ficha = fichaDespertar(mensaje.ficha);
  const elegidos = mensaje.personajes.map((id) => personajes.get(id)).filter((p): p is PersonajeMostrado => !!p);
  return (
    <span className={`flex flex-wrap items-center ${grande ? 'justify-center gap-4' : 'gap-2'}`}>
      {tarjeta && (grande ? <TarjetaVisual tarjeta={tarjeta} grande /> : <span className="font-ui text-sm font-semibold">{tarjeta.texto}</span>)}
      {ficha && mensaje.ficha !== 'personalizado' && (
        <span className={`inline-flex items-center gap-1 font-ui ${grande ? 'flex-col text-xl' : 'text-sm'}`}>
          <ficha.Icono aria-hidden="true" size={grande ? 72 : 18} strokeWidth={1.25} />
          {ficha.etiqueta}
        </span>
      )}
      {mensaje.jugadores.length > 0 && (
        <span className={grande ? 'text-xl' : 'text-sm'}>
          {mensaje.jugadores.map((id) => nombreDeAsiento(estado, id)).join(', ')}
        </span>
      )}
      {elegidos.length > 0 && (
        <span className="flex flex-wrap items-start gap-2">
          {elegidos.map((p) => (
            <PersonajeVisto key={p.id} personaje={p} alineamiento={mensaje.alineamiento} grande={grande} />
          ))}
        </span>
      )}
      {mensaje.alineamiento && (
        <span
          className={`font-ui font-semibold ${grande ? 'text-xl' : 'text-sm'} ${
            mensaje.alineamiento === 'bueno' ? 'text-good-bright' : 'text-blood-bright'
          }`}
        >
          {NOMBRE_BANDO[mensaje.alineamiento]}
        </span>
      )}
      {mensaje.texto && <span className={grande ? 'text-xl' : 'text-sm'}>{mensaje.texto}</span>}
      {mensaje.eleccion && <span className={grande ? 'text-xl' : 'text-sm'}>{textoEleccion(mensaje.eleccion.cantidad)}</span>}
    </span>
  );
};

interface HistorialProps {
  mensajes: MensajeDespertar[];
  estado: SalaEstado;
  personajes: Map<string, PersonajeMostrado>;
  /** id del título que lo nombra. */
  tituloId: string;
}

/**
 * Lo que se han dicho, del más antiguo al más reciente. No es una región viva:
 * lo nuevo ya se avisa una vez (ver SalaJuego).
 */
export const HistorialDespertar = ({ mensajes, estado, personajes, tituloId }: HistorialProps) => {
  const listaRef = useRef<HTMLOListElement>(null);
  // Se ve siempre lo último
  useEffect(() => {
    const lista = listaRef.current;
    if (lista) lista.scrollTop = lista.scrollHeight;
  }, [mensajes.length]);
  if (!mensajes.length) return <p className="text-sm text-on-surface-muted">Aún no os habéis dicho nada.</p>;
  return (
    // Puede tener scroll: se enfoca para moverlo con el teclado
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
    <ol ref={listaRef} tabIndex={0} aria-labelledby={tituloId} className={`flex max-h-40 shrink-0 flex-col gap-1 overflow-y-auto rounded ${foco}`}>
      {mensajes.map((m, i) => {
        // Cada vez que cambia la noche (o el día), su nombre delante: «Noche 2»
        const fase = nombreFase({ ...m.fase, reinicios: 0 });
        const anterior = mensajes[i - 1];
        const nuevaFase = !anterior || nombreFase({ ...anterior.fase, reinicios: 0 }) !== fase;
        return (
          <Fragment key={m.id}>
            {nuevaFase && (
              <li className="pt-1 font-ui text-xs uppercase tracking-wide text-on-surface-muted">{fase}</li>
            )}
            <li className="flex flex-wrap items-center gap-x-2 border-b border-outline-ghost/60 py-1 last:border-0">
              <span className="text-xs font-semibold text-theme-main">{autorDe(m, estado)}:</span>
              <MensajeVisto mensaje={m} estado={estado} personajes={personajes} />
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
};

/** Lo que se está a punto de mandar y falta por elegir. */
export interface Pendiente {
  base: Envio;
  titulo: string;
  adjunto: AdjuntoDespertar;
  /** Lo que ya va puesto al abrir (p. ej. «Tú eres»: el personaje y el alineamiento del despierto). */
  iniciales?: { jugadores?: string[]; personajes?: string[]; alineamiento?: SalaAlineamiento | null; texto?: string };
}

interface EditorAdjuntoProps {
  pendiente: Pendiente;
  /** Los asientos (también los libres: cuentan como jugadores), para elegir jugadores. */
  asientos: { id: string; nombre: string }[];
  personajes: PersonajeMostrado[];
  onEnviar: (envio: Envio) => Promise<SalaResultado>;
  /** Sin él, no hay «Cancelar» (lo que pide la habilidad del jugador: tiene que elegir). */
  onCancelar?: () => void;
  /** Cuántos jugadores hay que elegir, justo (la habilidad del jugador); sin él, al menos uno. */
  cantidad?: number;
  /** Asientos que no se pueden elegir (el suyo, si su habilidad no le deja elegirse). */
  excluidos?: string[];
  /** Si no es para mandar algo (elegir a quiénes despertar): el botón y el rótulo de lo elegido. */
  textos?: { enviar: string; cartas: string };
}

/**
 * Confirmar una ficha o tarjeta antes de mandarla, eligiendo lo que lleve
 * (jugadores, personajes, alineamiento o un texto). Cada jugador o personaje que
 * se pulsa en la lista se añade, como una carta, a «Se enviará», en el orden en
 * que se pulsa; se quita pulsando su carta. Los jugadores, según Preferencias >
 * Accesibilidad, se eligen en la plaza (al abrirse, si aún no lleva ninguno, la
 * ventana se esconde sola, se pulsa su ficha y vuelve aquí con él añadido; para
 * añadir más, «Elegir otro jugador en la plaza») o en una lista. Va dentro de la misma ventana (no es
 * otro diálogo): al abrirse, el foco va a su título; al cerrarse, vuelve a la
 * ficha que lo abrió.
 */
export const EditorAdjunto = ({
  pendiente,
  asientos: todos,
  personajes,
  onEnviar,
  onCancelar,
  cantidad,
  excluidos = [],
  textos = { enviar: 'Enviar', cartas: 'Se enviará' },
}: EditorAdjuntoProps) => {
  const asientos = todos.filter((a) => !excluidos.includes(a.id));
  const base = useId();
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const [jugadores, setJugadores] = useState<string[]>(pendiente.iniciales?.jugadores ?? []);
  const [elegidos, setElegidos] = useState<string[]>(pendiente.iniciales?.personajes ?? []);
  const [bando, setBando] = useState<SalaAlineamiento | null>(pendiente.iniciales?.alineamiento ?? null);
  const [texto, setTexto] = useState(pendiente.iniciales?.texto ?? '');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const ariaLive = useAriaLive('errores');
  const { adjunto } = pendiente;
  const elegirEnPlaza = useElegirEnPlaza();

  const enviarRef = useRef<HTMLButtonElement>(null);
  const sinAdjunto = !adjunto.jugadores && !adjunto.personajes && !adjunto.texto && !adjunto.alineamiento;
  // Con algo que elegir, el foco va al título; si no, directo a «Enviar» (que dice qué se envía)
  useEffect(() => (sinAdjunto ? enviarRef.current : tituloRef.current)?.focus(), [sinAdjunto]);
  const tarjeta = tarjetaDespertar(pendiente.base.tarjeta ?? null);
  const ficha = fichaDespertar(pendiente.base.ficha ?? null);

  // Añadir y quitar se confirman al lector (los botones no cambian de nombre)
  const [aviso, setAviso] = useState('');
  const ariaLiveAviso = useAriaLive('despertar');
  const nombreJugador = (id: string) => asientos.find((a) => a.id === id)?.nombre ?? id;
  const nombrePersonaje = (id: string) => personajes.find((p) => p.id === id)?.nombre.texto ?? id;
  const anadir = (tipo: 'jugador' | 'personaje', id: string) => {
    const [lista, poner, nombre] =
      tipo === 'jugador' ? [jugadores, setJugadores, nombreJugador(id)] : [elegidos, setElegidos, nombrePersonaje(id)];
    if (lista.includes(id)) return;
    if (tipo === 'jugador' && cantidad !== undefined && jugadores.length >= cantidad) {
      setAviso(`Ya has elegido ${cantidad === 1 ? 'uno' : cantidad}: quita uno para cambiarlo.`);
      return;
    }
    poner([...lista, id]);
    setAviso(`Añadido: ${nombre}.`);
  };
  // En la plaza: quien elige ahí avisa al lector (esta ventana estaba escondida y no se oiría)
  const idPlaza = `${base}-plaza`;
  const completos = cantidad !== undefined && jugadores.length >= cantidad;
  // Completos al volver de la plaza: su botón desaparece y el foco va a «Enviar»
  const completosAntes = useRef(completos);
  useEffect(() => {
    if (completos && !completosAntes.current && elegirEnPlaza) enviarRef.current?.focus();
    completosAntes.current = completos;
  }, [completos, elegirEnPlaza]);
  // Con un número justo (el despertar guiado), se eligen seguidos todos los que faltan
  const faltan = cantidad !== undefined ? Math.max(1, cantidad - jugadores.length) : 1;
  const elegirJugadorEnPlaza = () =>
    elegirEnPlaza?.({
      titulo: pendiente.titulo,
      excluidos,
      elegidos: jugadores,
      cuantos: faltan,
      aviso: cantidad !== undefined ? textoEleccion(faltan) : undefined,
      onElegido: (id) => setJugadores((l) => (l.includes(id) ? l : [...l, id])),
      onQuitado: (id) => setJugadores((l) => l.filter((x) => x !== id)),
      // Al volver, el foco en el botón: para añadir otro o seguir a «Enviar»
      volver: idPlaza,
    });
  // Lleva jugadores y aún no hay ninguno: directamente a la plaza, sin pasar por el botón
  // (una vez, al abrirse; si se cancela, se queda aquí con el botón)
  const plazaAbiertaRef = useRef(false);
  useEffect(() => {
    if (plazaAbiertaRef.current || !elegirEnPlaza || !adjunto.jugadores || jugadores.length > 0) return;
    plazaAbiertaRef.current = true;
    elegirJugadorEnPlaza();
    // Solo al abrirse
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Al quitar una carta, el foco pasa a la siguiente (o a la anterior; si no queda ninguna, al título)
  const idCarta = (tipo: string, id: string) => `${base}-carta-${tipo}-${id}`;
  const focoTrasQuitar = useRef<string | null>(null);
  useEffect(() => {
    if (!focoTrasQuitar.current) return;
    (document.getElementById(focoTrasQuitar.current) ?? tituloRef.current)?.focus();
    focoTrasQuitar.current = null;
  });
  const quitar = (tipo: 'jugador' | 'personaje', id: string) => {
    const cartas = [...jugadores.map((j) => ['jugador', j]), ...elegidos.map((p) => ['personaje', p])];
    const i = cartas.findIndex(([t, x]) => t === tipo && x === id);
    const vecina = cartas[i + 1] ?? cartas[i - 1];
    focoTrasQuitar.current = vecina ? idCarta(vecina[0], vecina[1]) : `${base}-titulo`;
    if (tipo === 'jugador') setJugadores((l) => l.filter((x) => x !== id));
    else setElegidos((l) => l.filter((x) => x !== id));
    setAviso(`Quitado: ${tipo === 'jugador' ? nombreJugador(id) : nombrePersonaje(id)}.`);
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    if (adjunto.jugadores && cantidad !== undefined && jugadores.length !== cantidad) return setError(`${textoEleccion(cantidad)}.`);
    if (adjunto.jugadores && !jugadores.length) return setError('Elige al menos un jugador.');
    if (adjunto.personajes && !elegidos.length) return setError('Elige al menos un personaje.');
    if (adjunto.texto && !texto.trim()) return setError('Escribe el mensaje.');
    setEnviando(true);
    setError('');
    const r = await onEnviar({
      ...pendiente.base,
      ...(adjunto.jugadores ? { jugadores } : {}),
      ...(adjunto.personajes ? { personajes: elegidos } : {}),
      ...(adjunto.texto ? { texto } : {}),
      ...(adjunto.alineamiento ? { alineamiento: bando } : {}),
    });
    if (!r.ok) {
      setError(r.error);
      setEnviando(false);
    }
  };

  // En la lista, lo ya añadido se ve apagado y no hace nada (se quita desde su carta)
  const opcion = `flex flex-col items-center gap-1 rounded border border-transparent p-2 text-center text-sm hover:border-theme-main/60 aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:border-transparent ${foco}`;
  const porId = new Map(personajes.map((p) => [p.id, p]));
  const conCartas = !!adjunto.jugadores || !!adjunto.personajes;
  const carta = `relative flex w-24 flex-col items-center gap-1 rounded-lg border-2 border-gold/70 bg-surface-high p-2 pt-3 text-center text-xs text-on-surface-bright shadow hover:border-blood-bright ${foco}`;
  return (
    // shrink-0: dentro de una ventana con altura máxima, nada del editor se encoge (se desplaza la ventana)
    <form onSubmit={enviar} className="flex shrink-0 flex-col gap-3">
      <div className="flex items-center gap-3">
        {tarjeta && <TarjetaVisual tarjeta={tarjeta} />}
        {ficha && <ficha.Icono aria-hidden="true" size={48} strokeWidth={1.25} className="text-on-surface-bright" />}
        <h3
          id={`${base}-titulo`}
          ref={tituloRef}
          tabIndex={-1}
          className="font-ui text-base font-semibold text-theme-main focus:outline-none"
        >
          {pendiente.titulo}
        </h3>
      </div>
      {conCartas && (
        // Lo que se va a enviar, como cartas en el orden en que se añadió; pulsar una la quita
        <div className="flex flex-col gap-2 rounded border border-dashed border-outline-ghost p-3">
          <p id={`${base}-cartas`} className="font-ui text-sm font-semibold text-theme-main">
            {textos.cartas}
          </p>
          {jugadores.length + elegidos.length === 0 ? (
            <p className="text-sm text-on-surface-muted">
              {adjunto.personajes ? (adjunto.jugadores ? 'Añade abajo un jugador o un personaje.' : 'Añade abajo un personaje.') : 'Añade abajo un jugador.'}
            </p>
          ) : (
            <ul aria-labelledby={`${base}-cartas`} className="flex flex-wrap gap-2">
              {jugadores.map((id) => (
                <li key={`j-${id}`}>
                  <button id={idCarta('jugador', id)} type="button" onClick={() => quitar('jugador', id)} className={carta}>
                    <X aria-hidden="true" size={12} className="absolute right-1 top-1 text-on-surface-muted" />
                    <span className="sr-only">Quitar </span>
                    {nombreJugador(id)}
                  </button>
                </li>
              ))}
              {elegidos.map((id) => {
                const p = porId.get(id);
                const icono = p ? iconoDe(p, bando) : null;
                return (
                  <li key={`p-${id}`}>
                    <button id={idCarta('personaje', id)} type="button" onClick={() => quitar('personaje', id)} className={carta}>
                      <X aria-hidden="true" size={12} className="absolute right-1 top-1 text-on-surface-muted" />
                      {icono && <img src={urlDelServidor(icono)} alt="" className="h-12 w-12 object-contain" />}
                      <span className="sr-only">Quitar </span>
                      <span lang={p?.nombre.lang}>{p?.nombre.texto ?? id}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div aria-live={ariaLiveAviso} className="sr-only">
            {aviso}
          </div>
        </div>
      )}
      {/* shrink-0: con max-h y scroll propio, si no, se encogería hasta no verse */}
      <div className="flex max-h-[45vh] shrink-0 flex-col gap-4 overflow-y-auto">
        {adjunto.alineamiento && (
          <fieldset className="flex flex-wrap items-center gap-3">
            <legend className="mb-2 text-sm text-on-surface-muted">Alineamiento</legend>
            {([null, 'bueno', 'malvado'] as const).map((a) => (
              <label key={a ?? 'nada'} className="flex items-center gap-1 text-sm">
                <input
                  type="radio"
                  name={`${base}-bando`}
                  checked={bando === a}
                  onChange={() => setBando(a)}
                  className="accent-[var(--color-theme-main)]"
                />
                {a ? NOMBRE_BANDO[a] : 'No decir el alineamiento'}
              </label>
            ))}
          </fieldset>
        )}
        {adjunto.jugadores && elegirEnPlaza && !completos && (
          <div>
            <button id={idPlaza} type="button" onClick={elegirJugadorEnPlaza} className={`${botonSecundario} flex items-center gap-2`}>
              <MousePointerClick size={16} />
              {jugadores.length > 0 ? 'Elegir otro jugador en la plaza' : 'Elegir jugador en la plaza'}
            </button>
          </div>
        )}
        {adjunto.jugadores && !elegirEnPlaza && (
          <fieldset>
            <legend className="mb-2 text-sm text-on-surface-muted">Jugadores para añadir</legend>
            <ul className="flex flex-wrap gap-2">
              {asientos.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    aria-disabled={jugadores.includes(a.id) || undefined}
                    onClick={() => anadir('jugador', a.id)}
                    className={`${botonSecundario} aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:border-outline-ghost`}
                  >
                    {a.nombre}
                  </button>
                </li>
              ))}
            </ul>
          </fieldset>
        )}
        {adjunto.personajes && (
          <fieldset>
            <legend className="mb-2 text-sm text-on-surface-muted">Personajes para añadir</legend>
            {personajes.length === 0 ? (
              <p className="text-sm text-on-surface-muted">Aún no hay guion: no hay personajes que elegir.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {porTipos(personajes).map(({ titulo, personajes: grupo }) => (
                  <div key={titulo}>
                    <h4 className="rotulo mb-1">{titulo}</h4>
                    <ul className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-1">
                      {grupo.map((p) => {
                        const icono = iconoDe(p, null);
                        return (
                          <li key={p.id}>
                            <button
                              type="button"
                              aria-disabled={elegidos.includes(p.id) || undefined}
                              onClick={() => anadir('personaje', p.id)}
                              className={`w-full ${opcion}`}
                            >
                              {icono ? (
                                <img src={urlDelServidor(icono)} alt="" className="h-10 w-10 object-contain" loading="lazy" />
                              ) : (
                                <span aria-hidden="true" className="h-10 w-10 rounded-full border border-outline-ghost" />
                              )}
                              <span lang={p.nombre.lang}>{p.nombre.texto}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </fieldset>
        )}
        {adjunto.texto && (
          <div className="flex flex-col gap-1">
            <label htmlFor={`${base}-texto`} className="text-sm text-on-surface-muted">
              Mensaje
            </label>
            <input
              id={`${base}-texto`}
              value={texto}
              maxLength={MAX_TEXTO}
              onChange={(e) => setTexto(e.target.value)}
              autoComplete="off"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${base}-error` : undefined}
              className={campo}
            />
          </div>
        )}
      </div>
      <div aria-live={ariaLive}>
        {error && (
          <p id={`${base}-error`} className="text-sm text-blood-pale">
            {error}
          </p>
        )}
      </div>
      <div className="flex gap-3">
        <button
          ref={enviarRef}
          type="submit"
          aria-disabled={enviando}
          aria-describedby={sinAdjunto ? `${base}-titulo` : undefined}
          className={botonPrincipal}
        >
          {textos.enviar}
        </button>
        {onCancelar && (
          <button type="button" onClick={onCancelar} className={botonSecundario}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
};

interface BotoneraDespertarProps {
  estado: SalaEstado;
  /** El narrador: el asiento del despertar al que manda. El jugador: null (va al suyo). */
  asientoId: string | null;
  /** Todos los personajes del guion. */
  personajes: PersonajeMostrado[];
  /** Con las tarjetas (el narrador) o solo las fichas (el jugador despierto). */
  conTarjetas: boolean;
  /** Título de la fila de fichas («Fichas», «Contestar»). */
  tituloFichas: string;
  pedir: (accion: string, datos?: unknown) => Promise<SalaResultado>;
  onError: (mensaje: string) => void;
  /** Confirmar al lector lo que se acaba de mandar. */
  onEnviado: (texto: string) => void;
  /**
   * El despertar guiado, para revisar (el narrador): lo que se manda va por
   * 'narrador:resolverHabilidad' con ese personaje, y encima de las fichas, lo que
   * se propone mandar (ver Propuesta).
   */
  revision?: { personajeId: string; propuestas: Propuesta[] };
  /** El narrador: otros asientos a los que se manda lo mismo (y se despierta, si aún no lo están). */
  conjunto?: string[];
  /** Solo estas fichas (las ids): el jugador, a lo que le manda el despertar guiado. Sin ellas, todas. */
  soloFichas?: readonly string[];
}

/** Una respuesta propuesta por el despertar guiado: lo que se manda y por qué (cómo registra alguien), en palabras. */
export interface Propuesta {
  envio: Envio;
  mensaje: string;
  registros: string;
}

/** El título de lo que se manda: el de su tarjeta o su ficha. */
const tituloDe = (envio: Envio) => tarjetaDespertar(envio.tarjeta ?? null)?.texto ?? fichaDespertar(envio.ficha ?? null)?.etiqueta ?? '';
const adjuntoDe = (envio: Envio) => tarjetaDespertar(envio.tarjeta ?? null)?.adjunto ?? fichaDespertar(envio.ficha ?? null)?.adjunto ?? {};

/**
 * Las fichas (y, para el narrador, las tarjetas) que se pueden mandar. Pulsar
 * una abre el editor: se elige lo que lleve (si lleva algo) y se confirma con «Enviar».
 * Al revisar un despertar guiado, antes, lo propuesto: se manda tal cual o se cambia antes.
 */
export const BotoneraDespertar = ({
  estado,
  asientoId,
  personajes,
  conTarjetas,
  tituloFichas,
  pedir,
  onError,
  onEnviado,
  revision,
  conjunto = [],
  soloFichas,
}: BotoneraDespertarProps) => {
  const base = useId();
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);

  // Lo que el narrador ya sabe va puesto: «Tú eres», el personaje y el alineamiento del
  // despierto; «Este es el demonio» y «Estos son los esbirros», quiénes lo son.
  const porId = new Map(personajes.map((p) => [p.id, p]));
  const asientosDeTipo = (tipo: string) =>
    estado.asientos.filter((a) => a.personaje && porId.get(a.personaje)?.tipo === tipo).map((a) => a.id);
  const iniciales = (tarjeta?: string): Pendiente['iniciales'] => {
    if (tarjeta === 'demonio') return { jugadores: asientosDeTipo('demon') };
    if (tarjeta === 'esbirros') return { jugadores: asientosDeTipo('minion') };
    // «No están en juego»: los faroles que el narrador ha preparado para el demonio
    if (tarjeta === 'noEnJuego') {
      const faroles = estado.faroles.filter((id): id is string => !!id && porId.has(id));
      return faroles.length > 0 ? { personajes: faroles } : undefined;
    }
    if (tarjeta === 'tuEres') {
      const asiento = estado.asientos.find((a) => a.id === asientoId);
      const personaje = asiento?.personaje ? porId.get(asiento.personaje) : undefined;
      if (!asiento || !personaje) return undefined;
      return { personajes: [personaje.id], alineamiento: alineamientoDe(personaje, asiento.alineamiento) };
    }
    return undefined;
  };
  // Al cerrar el editor, el foco vuelve a la ficha o tarjeta que lo abrió
  const volverRef = useRef<string | null>(null);
  useEffect(() => {
    if (pendiente || !volverRef.current) return;
    document.getElementById(volverRef.current)?.focus();
    volverRef.current = null;
  }, [pendiente]);

  const mandar = async (envio: Envio, titulo: string) => {
    const r = revision
      ? await pedir('narrador:resolverHabilidad', { ...envio, personajeId: revision.personajeId })
      : await pedir(
          'despertar:enviar',
          asientoId ? (conjunto.length ? { ...envio, asientoIds: [asientoId, ...conjunto] } : { ...envio, asientoId }) : envio,
        );
    if (r.ok) {
      onEnviado(conjunto.length ? `Enviado a los ${conjunto.length + 1}: ${titulo}.` : `Enviado: ${titulo}.`);
      setPendiente(null);
    } else if (!pendiente) onError(r.error);
    return r;
  };

  // «Entendido» se manda al pulsarlo; lo demás pasa por «Enviar» (también lo que no lleva
  // nada): así un clic de más no manda nada. Mientras se manda, otro clic no lo repite
  const mandandoRef = useRef(false);
  const pulsar = (envio: Envio, titulo: string, idBoton: string, adjunto?: AdjuntoDespertar) => {
    if (envio.ficha === 'entendido' && !revision) {
      if (mandandoRef.current) return;
      mandandoRef.current = true;
      void mandar(envio, titulo).finally(() => (mandandoRef.current = false));
      return;
    }
    volverRef.current = idBoton;
    setPendiente({ base: envio, titulo, adjunto: adjunto ?? {}, iniciales: iniciales(envio.tarjeta) });
  };

  if (pendiente) {
    const asientos = estado.asientos.map((a) => ({ id: a.id, nombre: nombreDeAsiento(estado, a.id) }));
    return (
      <EditorAdjunto
        pendiente={pendiente}
        asientos={asientos}
        personajes={personajes}
        onEnviar={(envio) => mandar(envio, pendiente.titulo)}
        onCancelar={() => setPendiente(null)}
      />
    );
  }

  const idFicha = (id: string) => `${base}-ficha-${id}`;
  const idTarjeta = (id: string) => `${base}-tarjeta-${id}`;
  const idPropuesta = (i: number) => `${base}-propuesta-${i}`;
  return (
    <div className="flex flex-col gap-3">
      {revision && revision.propuestas.length > 0 && (
        <>
          <h3 id={`${base}-propuestas`} className="font-ui text-sm font-semibold text-theme-main">
            {revision.propuestas.length === 1 ? 'Lo que se propone mandar' : 'Lo que se puede mandar'}
          </h3>
          <ul aria-labelledby={`${base}-propuestas`} className="flex flex-col gap-2">
            {revision.propuestas.map((p, i) => (
              <li key={i} className="flex flex-wrap items-center gap-3 rounded border border-gold/30 bg-theme-container/40 px-3 py-2">
                <p id={idPropuesta(i)} className="min-w-0 flex-1 text-sm">
                  <span className="text-on-surface-bright">{p.mensaje}</span>
                  {p.registros && <span className="block text-xs text-on-surface-muted">{p.registros}</span>}
                </p>
                <button
                  type="button"
                  aria-describedby={idPropuesta(i)}
                  onClick={() => void mandar(p.envio, tituloDe(p.envio))}
                  className={`${botonPrincipal} px-3 py-1.5 text-xs`}
                >
                  Enviar
                </button>
                <button
                  id={`${idPropuesta(i)}-cambiar`}
                  type="button"
                  aria-describedby={idPropuesta(i)}
                  onClick={() => {
                    volverRef.current = `${idPropuesta(i)}-cambiar`;
                    setPendiente({
                      base: { ficha: p.envio.ficha, tarjeta: p.envio.tarjeta },
                      titulo: tituloDe(p.envio),
                      adjunto: adjuntoDe(p.envio),
                      iniciales: { jugadores: p.envio.jugadores, personajes: p.envio.personajes, alineamiento: p.envio.alineamiento, texto: p.envio.texto },
                    });
                  }}
                  className={`${botonSecundario} px-3 py-1.5 text-xs`}
                >
                  Cambiar
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <h3 id={`${base}-fichas`} className="font-ui text-sm font-semibold text-theme-main">
        {tituloFichas}
      </h3>
      <ul aria-labelledby={`${base}-fichas`} className="flex flex-wrap justify-center gap-x-2 gap-y-3">
        {FICHAS_DESPERTAR.filter((f) => !soloFichas || soloFichas.includes(f.id)).map((f) => (
          <li key={f.id}>
            <button
              id={idFicha(f.id)}
              type="button"
              onClick={() => pulsar({ ficha: f.id }, f.etiqueta, idFicha(f.id), f.adjunto)}
              className={`flex w-[4.5rem] flex-col items-center gap-1 rounded p-1 text-on-surface-bright hover:bg-theme-main/15 ${foco}`}
            >
              <f.Icono aria-hidden="true" size={40} strokeWidth={1.25} />
              <span className="w-full truncate text-center text-sm">{f.etiqueta}</span>
            </button>
          </li>
        ))}
      </ul>
      {conTarjetas && (
        <>
          <h3 id={`${base}-tarjetas`} className="font-ui text-sm font-semibold text-theme-main">
            Tarjetas
          </h3>
          <ul aria-labelledby={`${base}-tarjetas`} className="flex flex-wrap justify-center gap-2">
            {TARJETAS_DESPERTAR.map((t) => (
              <li key={t.id}>
                <button
                  id={idTarjeta(t.id)}
                  type="button"
                  onClick={() => pulsar({ tarjeta: t.id }, t.texto, idTarjeta(t.id), t.adjunto)}
                  className={`block rounded-lg transition-transform hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${foco} focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
                >
                  <TarjetaVisual tarjeta={t} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};
