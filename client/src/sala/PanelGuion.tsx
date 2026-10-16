import { Sun, X } from 'lucide-react';
import { Fragment, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { urlDelServidor } from '../utils/api';
import SelectorIdioma from './SelectorIdioma';
import {
  logoDeGuion,
  mostrarPersonajes,
  personajesDeNoche,
  porTipos,
  useTraducciones,
  type Genero,
  type GuionResuelto,
  type PersonajeMostrado,
  type Texto,
} from './guiones';

interface PanelGuionProps {
  /** Qué enseña: la hoja de personajes o el orden de noche. */
  vista: 'guion' | 'noche';
  guion: GuionResuelto;
  /** Idiomas (ids) de los nombres y de las descripciones de los personajes, y el género de los textos. */
  idiomas: { nombres: string; descripciones: string; genero: Genero };
  /** Cambia el de las descripciones (la preferencia, no solo aquí). */
  onCambiarIdiomaDescripciones: (id: string) => void;
  /** Los recordatorios del orden de noche: solo para el narrador (null para los demás). */
  recordatorios: RecordatoriosNoche | null;
  onCerrar: () => void;
}

/**
 * La ficha recordatorio del orden de noche (la estrella blanca): marca lo que
 * actúa. Sale sola en los personajes en juego y vivos (y en Esbirros y Demonios
 * si hay alguno vivo); los narradores la quitan o la ponen a mano, para todos.
 */
export interface RecordatoriosNoche {
  /** ids de los personajes que la llevan. */
  activos: string[];
  onAlternar: (personajeId: string) => void;
}

/** Ancho inicial (px) en resumido y en completo; y límites al redimensionar. */
// El resumido empieza ya a dos columnas (el paso a dos es a 28rem = 448px)
const ANCHO = { resumido: 480, completo: 760, min: 260, paso: 24 };

/** Colores de la hoja (como la impresa): arena, tinta oscura, azul los buenos, rojo los malvados. */
const TINTA = '#2f1d0e';
const colorDe = (tipo: string) =>
  ['minion', 'demon'].includes(tipo)
    ? 'text-[#9b1c1c]'
    : ['townsfolk', 'outsider'].includes(tipo)
      ? 'text-[#1d5d96]'
      : 'text-[#7a5a12]';

/**
 * La hoja de personajes o el orden de noche, como la hoja impresa del guion:
 * papel color arena con un ribete rojo a la izquierda (el nombre del guion en
 * vertical). Sale por la derecha y no es modal: la plaza sigue a la vista.
 *
 * - «Completo»: sin marcar, icono y nombre (hoja estrecha); marcado, también la
 *   habilidad o el recordatorio (hoja ancha). La hoja de personajes va a dos
 *   columnas si cabe; el orden de noche, siempre a una (se sigue de arriba abajo).
 * - Se redimensiona arrastrando el borde izquierdo, o con las flechas sobre él.
 * - Orden de noche: o la primera noche o las demás, con Crepúsculo, esbirros y
 *   demonio (la primera) y Amanecer.
 *
 * - Los nombres y las descripciones, cada uno en el idioma elegido en
 *   Preferencias > Usuario; el de las descripciones se cambia también aquí.
 *
 * Al abrirse el foco va a su título; Escape (con el foco dentro) lo cierra.
 */
const PanelGuion = ({ vista, guion, idiomas, recordatorios, onCambiarIdiomaDescripciones, onCerrar }: PanelGuionProps) => {
  const [completo, setCompleto] = useState(false);
  const traduccionesNombres = useTraducciones(idiomas.nombres, idiomas.genero);
  const traduccionesDescripciones = useTraducciones(idiomas.descripciones, idiomas.genero);
  const personajes = mostrarPersonajes(guion.personajes, traduccionesNombres, traduccionesDescripciones);
  const [noche, setNoche] = useState<'primera' | 'otras'>('primera');
  // Cada modo recuerda su ancho
  const [anchos, setAnchos] = useState({ resumido: ANCHO.resumido, completo: ANCHO.completo });
  const modo = completo ? 'completo' : 'resumido';
  const maximo = () => Math.max(ANCHO.min, window.innerWidth - 16);
  const ancho = Math.min(anchos[modo], maximo());
  // Mientras está abierto, su ancho para lo que se aparta de él (la mesa y el reparto)
  useEffect(() => {
    const raiz = document.documentElement;
    raiz.style.setProperty('--sala-panel-guion-ancho', `${ancho}px`);
    return () => {
      raiz.style.removeProperty('--sala-panel-guion-ancho');
    };
  }, [ancho]);
  const cambiarAncho = (px: number) =>
    setAnchos((a) => ({ ...a, [modo]: Math.round(Math.min(maximo(), Math.max(ANCHO.min, px))) }));

  const tituloRef = useRef<HTMLHeadingElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const titulo = vista === 'guion' ? 'Hoja de personajes' : 'Orden de noche';
  const logo = logoDeGuion(guion);

  useEffect(() => {
    tituloRef.current?.focus();
  }, [vista]);

  useEffect(() => {
    const alPulsar = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && panelRef.current?.contains(document.activeElement)) {
        e.preventDefault();
        onCerrar();
      }
    };
    document.addEventListener('keydown', alPulsar);
    return () => document.removeEventListener('keydown', alPulsar);
  }, [onCerrar]);

  // Redimensionar: el ancho es lo que va del puntero al borde derecho de la ventana.
  const arrastrando = useRef(false);
  const alApretar = (e: PointerEvent<HTMLButtonElement>) => {
    arrastrando.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const alMover = (e: PointerEvent<HTMLButtonElement>) => {
    if (arrastrando.current) cambiarAncho(window.innerWidth - e.clientX);
  };
  const alSoltar = () => {
    arrastrando.current = false;
  };
  const alTeclear = (e: KeyboardEvent<HTMLButtonElement>) => {
    const cambios: Record<string, number> = { ArrowLeft: ANCHO.paso, ArrowRight: -ANCHO.paso };
    if (e.key in cambios) cambiarAncho(ancho + cambios[e.key]);
    else if (e.key === 'Home') cambiarAncho(ANCHO.min);
    else if (e.key === 'End') cambiarAncho(maximo());
    else return;
    e.preventDefault();
  };

  return (
    <section
      ref={panelRef}
      aria-labelledby="sala-panel-guion-titulo"
      style={{ width: ancho, color: TINTA }}
      className="@container fixed bottom-0 right-0 top-[3.6rem] z-40 flex shadow-2xl animate-[entrar-derecha_200ms_ease-out] motion-reduce:animate-none"
    >
      {/* Borde para redimensionar: se arrastra, o con el foco, flechas izquierda (más
          ancho) y derecha (más estrecho), Inicio y Fin. Se dice el ancho en la descripción. */}
      <button
        type="button"
        aria-label={`Cambiar el ancho de la ${titulo.toLocaleLowerCase('es')}`}
        aria-describedby="sala-panel-guion-ancho"
        onPointerDown={alApretar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        onKeyDown={alTeclear}
        className="absolute -left-1.5 top-0 z-10 h-full w-3 cursor-ew-resize touch-none hover:bg-[#9b1c1c]/30 focus:outline-none focus-visible:bg-theme-main/60"
      />
      <span id="sala-panel-guion-ancho" className="sr-only">
        {ancho} píxeles. Flecha izquierda para ensanchar, derecha para estrechar.
      </span>

      {/* Ribete rojo con el nombre del guion en vertical. La textura de la hoja
          (la de botc.app, public/hoja.webp) trae el ribete en su 7,75% izquierdo:
          aquí se escala para que ese trozo mida justo el ribete (36px). */}
      <div
        aria-hidden="true"
        className="flex w-9 shrink-0 items-center justify-center overflow-hidden"
        style={{ background: `url('/hoja.webp') left top / calc(2.25rem / 0.0775) 100% no-repeat, #7d1820` }}
      >
        <span
          className="whitespace-nowrap font-[Georgia,serif] text-sm uppercase tracking-[0.35em] text-[#f3e6d0]"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          {guion.nombre}
        </span>
      </div>

      {/* La hoja: el resto de la textura (sin el ribete, el 9% izquierdo), estirada
          a lo que mida, con el borde envejecido a la derecha */}
      <div
        className="flex min-w-0 flex-1 flex-col"
        style={{ background: `url('/hoja.webp') right top / calc(100% / 0.91) 100% no-repeat, #ebe2cf` }}
      >
        <div className="flex items-start gap-2 px-5 pt-4">
          <div className="min-w-0 flex-1 text-center">
            <h2 id="sala-panel-guion-titulo" ref={tituloRef} tabIndex={-1} className="sr-only focus:outline-none">
              {titulo}
            </h2>
            {logo ? (
              // El logo lleva el nombre escrito: es su texto alternativo
              <img src={logo} alt={guion.nombre} lang="en" className="mx-auto h-28 w-auto object-contain" />
            ) : (
              <p className="font-[Georgia,serif] text-2xl uppercase tracking-wider text-[#5a1416]" lang="en">
                {guion.nombre}
              </p>
            )}
            {guion.autor && <p className="font-[Georgia,serif] text-sm text-[#5a1416]">por {guion.autor}</p>}
            {vista === 'noche' && (
              <p aria-hidden="true" className="mt-1 font-[Georgia,serif] text-base text-[#5a1416] underline">
                {noche === 'primera' ? 'Primera noche' : 'Otras noches'}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label={`Cerrar la ${titulo.toLocaleLowerCase('es')}`}
            onClick={onCerrar}
            className="rounded-full p-1 text-[#5a1416] hover:bg-[#5a1416]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5a1416]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 border-b border-[#5a1416]/40 px-5 py-2 text-sm">
          {/* Interruptor (role=switch): el lector lo anuncia como «activado/desactivado» */}
          <button
            type="button"
            role="switch"
            aria-checked={completo}
            onClick={() => setCompleto((v) => !v)}
            className="group flex items-center gap-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5a1416]"
          >
            <span
              aria-hidden="true"
              className={`relative h-5 w-9 rounded-full border transition-colors motion-reduce:transition-none ${
                completo ? 'border-[#5a1416] bg-[#7d1820]' : 'border-[#5a1416]/50 bg-[#5a1416]/15'
              }`}
            >
              <span
                className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-[#f3e6d0] shadow transition-[left] motion-reduce:transition-none ${
                  completo ? 'left-[1.15rem]' : 'left-0.5'
                }`}
              />
            </span>
            Completo
          </button>
          {/* Las descripciones solo se ven en completo */}
          {completo && (
            <span className="flex items-center gap-2">
              <SelectorIdioma
                id="sala-panel-guion-idioma"
                etiqueta="Descripciones"
                valor={idiomas.descripciones}
                onCambiar={onCambiarIdiomaDescripciones}
                className="max-w-[12rem] rounded border border-[#5a1416]/50 bg-[#f6eedb] px-2 py-1 text-[#2f1d0e] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5a1416]"
              />
            </span>
          )}
          {vista === 'noche' && (
            // Una noche u otra, no las dos a la vez
            <fieldset className="flex items-center gap-1">
              <legend className="sr-only">Noche</legend>
              {(['primera', 'otras'] as const).map((n) => (
                <label
                  key={n}
                  className={`cursor-pointer rounded px-2 py-1 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#5a1416] ${
                    noche === n ? 'bg-[#7d1820] font-semibold text-[#f3e6d0]' : 'hover:bg-[#5a1416]/10'
                  }`}
                >
                  <input
                    type="radio"
                    name="sala-panel-noche"
                    checked={noche === n}
                    onChange={() => setNoche(n)}
                    className="sr-only"
                  />
                  {n === 'primera' ? 'Primera noche' : 'Otras noches'}
                </label>
              ))}
            </fieldset>
          )}
        </div>

        <div className="scroll-arena flex-1 overflow-y-auto px-5 py-2">
          {vista === 'guion' ? (
            <HojaPersonajes personajes={personajes} completo={completo} />
          ) : (
            <OrdenNoche
              guion={guion}
              personajes={personajes}
              noche={noche}
              completo={completo}
              recordatorios={recordatorios}
            />
          )}
        </div>
      </div>
    </section>
  );
};

/** Icono del rol (o un círculo vacío). No se lee: el nombre va al lado. */
const IconoRol = ({ imagen }: { imagen: string | null }) =>
  imagen ? (
    <img src={urlDelServidor(imagen)} alt="" className="h-14 w-14 shrink-0 object-contain" loading="lazy" />
  ) : (
    <span aria-hidden="true" className="h-14 w-14 shrink-0 rounded-full border border-[#5a1416]/40" />
  );

/**
 * Los recordatorios de noche marcan con «:reminder:» dónde se pone una ficha de
 * recordatorio: se pinta una ficha y el lector dice «ficha de recordatorio».
 */
const conMarcas = (texto: string): ReactNode =>
  texto.split(':reminder:').map((trozo, i) => (
    <Fragment key={i}>
      {i > 0 && (
        <>
          <span
            aria-hidden="true"
            className="mx-0.5 inline-block h-3 w-3 rounded-full border border-[#5a1416] bg-[#f6eedb] align-middle"
          />
          <span className="sr-only" lang="es">
            (ficha de recordatorio)
          </span>
        </>
      )}
      {trozo}
    </Fragment>
  ));

/**
 * Una fila: en el orden de noche, primero la ficha recordatorio (para el narrador);
 * luego icono, nombre (con su color) y, en completo, el texto. Cada uno con
 * su `lang`, que pueden ir en idiomas distintos (las entradas fijas, en castellano).
 */
const Fila = ({
  icono,
  nombre,
  color,
  texto,
  recordatorio,
}: {
  icono: ReactNode;
  nombre: Texto;
  color: string;
  texto?: Texto | null;
  /** Orden de noche, para el narrador: si lleva la ficha recordatorio y cómo quitarla o ponerla. */
  recordatorio?: { activo: boolean; onAlternar: () => void };
}) => (
  // Sin texto (resumido), el nombre centrado con el icono; con texto, arriba
  <li className={`flex gap-3 py-1.5 ${texto?.texto ? 'items-start' : 'items-center'}`}>
    {recordatorio && (
      // A la izquierda del rol. La ficha recordatorio de noche de botc.app (public/noche/actua.webp). Sin ella, un
      // hueco punteado donde ponerla. El lector oye «Recordatorio de Imp, presionado» o no.
      <button
        type="button"
        aria-pressed={recordatorio.activo}
        onClick={recordatorio.onAlternar}
        className="h-9 w-9 shrink-0 self-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5a1416] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f3e6d0]"
      >
        <span className="sr-only">
          Recordatorio de <span lang={nombre.lang}>{nombre.texto}</span>
        </span>
        {recordatorio.activo ? (
          <img src="/noche/actua.webp" alt="" className="h-9 w-9 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]" />
        ) : (
          <span aria-hidden="true" className="block h-9 w-9 rounded-full border-2 border-dashed border-[#5a1416]/35 hover:border-[#5a1416]/70" />
        )}
      </button>
    )}
    {icono}
    <p className="min-w-0 flex-1">
      <span className={`font-bold tracking-wide ${color}`} lang={nombre.lang}>
        {nombre.texto}
      </span>
      {texto?.texto && (
        <>
          <span className="sr-only">: </span>
          <span className="block text-sm leading-snug text-[#3a3027]" lang={texto.lang}>
            {conMarcas(texto.texto)}
          </span>
        </>
      )}
    </p>
  </li>
);

/** La hoja de personajes: los roles por tipos, separados por una línea granate; a dos columnas si cabe. */
const HojaPersonajes = ({ personajes, completo }: { personajes: PersonajeMostrado[]; completo: boolean }) => (
  <div className="flex flex-col">
    {porTipos(personajes).map(({ titulo, personajes: grupo }) => (
      <section
        key={titulo}
        aria-labelledby={`sala-hoja-${titulo}`}
        className="border-b-2 border-[#5a1416]/70 py-3 last:border-b-0"
      >
        <h3
          id={`sala-hoja-${titulo}`}
          className="mb-1 font-[Georgia,serif] text-xs uppercase tracking-[0.3em] text-[#5a1416]"
        >
          {titulo}
        </h3>
        {/* Dos columnas cuando la hoja es lo bastante ancha (en completo hace falta más) */}
        <ul className={`grid gap-x-6 ${completo ? '@2xl:grid-cols-2' : '@md:grid-cols-2'}`}>
          {grupo.map((r) => (
            <Fila
              key={r.id}
              icono={<IconoRol imagen={r.icono} />}
              nombre={r.nombre}
              color={colorDe(r.tipo)}
              texto={completo ? r.habilidad : null}
            />
          ))}
        </ul>
      </section>
    ))}
  </div>
);

/** Entradas fijas del orden de noche (no son roles): un círculo con un icono o una letra. */
const IconoFijo = ({ children, claro = false }: { children: ReactNode; claro?: boolean }) => (
  <span
    aria-hidden="true"
    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full font-[Georgia,serif] text-2xl ${
      claro ? 'bg-[#d9932b] text-[#fff3d6]' : 'bg-[#2b2140] text-[#e8e2f4]'
    }`}
  >
    {children}
  </span>
);

/**
 * Entradas fijas con su icono de botc.app (copias locales en public/noche),
 * que ya trae su círculo. No se lee: el nombre va al lado.
 */
const IconoNoche = ({ imagen }: { imagen: string }) => (
  <img src={imagen} alt="" className="h-14 w-14 shrink-0 object-contain" />
);

const TEXTOS_FIJOS = {
  crepusculo: 'Comprueba que todos tengan los ojos cerrados. Algunos Viajeros actúan.',
  esbirros: 'Si hay 7 o más jugadores, despierta a los Esbirros: se ven entre sí y ven quién es el Demonio.',
  demonios:
    'Si hay 7 o más jugadores, despierta al Demonio: ve a sus Esbirros y 3 personajes buenos que no están en juego.',
  amanecer: 'Espera unos segundos. Llama a todos a despertar.',
};

/** El orden de una noche: Crepúsculo, (esbirros y demonio la primera), los roles que se despiertan y Amanecer. */
const OrdenNoche = ({
  guion,
  personajes,
  noche,
  completo,
  recordatorios,
}: {
  guion: GuionResuelto;
  personajes: PersonajeMostrado[];
  noche: 'primera' | 'otras';
  completo: boolean;
  recordatorios: RecordatoriosNoche | null;
}) => {
  // El orden lo calcula el servidor; aquí solo se pintan
  const lista = personajesDeNoche(guion, personajes, noche);
  const conRecordatorio = (id: string) =>
    recordatorios
      ? { activo: recordatorios.activos.includes(id), onAlternar: () => recordatorios.onAlternar(id) }
      : undefined;
  // Esbirros y Demonios también llevan recordatorio: no siempre se despiertan
  const fija = (nombre: string, icono: ReactNode, t: string, recordatorio?: string) => (
    <Fila
      icono={icono}
      nombre={{ texto: nombre, lang: 'es' }}
      color="text-[#5a1416]"
      texto={completo ? { texto: t, lang: 'es' } : null}
      recordatorio={recordatorio ? conRecordatorio(recordatorio) : undefined}
    />
  );
  return (
    <ol className="flex flex-col py-2">
      {fija('Crepúsculo', <IconoNoche imagen="/noche/crepusculo.webp" />, TEXTOS_FIJOS.crepusculo)}
      {noche === 'primera' && (
        <>
          {fija('Esbirros', <IconoFijo>M</IconoFijo>, TEXTOS_FIJOS.esbirros, 'esbirros')}
          {fija('Demonios', <IconoFijo>D</IconoFijo>, TEXTOS_FIJOS.demonios, 'demonios')}
        </>
      )}
      {lista.map((r) => (
        <Fila
          key={r.id}
          icono={<IconoRol imagen={r.icono} />}
          nombre={r.nombre}
          color={colorDe(r.tipo)}
          texto={completo ? (noche === 'primera' ? r.primeraNoche : r.otrasNoches) : null}
          recordatorio={conRecordatorio(r.id)}
        />
      ))}
      {fija(
        'Amanecer',
        <IconoFijo claro>
          <Sun size={20} />
        </IconoFijo>,
        TEXTOS_FIJOS.amanecer,
      )}
    </ol>
  );
};

export default PanelGuion;
