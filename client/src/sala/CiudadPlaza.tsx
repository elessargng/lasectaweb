import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { SalaFase } from './useSala';

/** Lo que dura el atardecer o el amanecer (sala.css lo reparte entre el cielo, el sol y las luces). */
const DURACION_TRANSICION_MS = 3600;
/** Lo que tarda en aparecer (aún con la fase de antes) y en irse (sala.css, sala-ciudad-marco). */
const ENTRADA_MS = 800;
const SALIDA_MS = 1000;
/** Lo que se queda a la vista con la fase nueva, ya acabado el cambio, antes de irse. */
const ESPERA_MS = 1800;

/**
 * Por dónde va: oculta (casi siempre), entrando (aparece con la fase de antes),
 * cambiando (atardece o amanece y se queda un poco) y saliendo (se desvanece).
 */
type Paso = 'oculta' | 'entrando' | 'cambiando' | 'saliendo';

/**
 * La audiodescripción de lo que se ve al cambiar (para el lector: la animación no
 * está en el árbol de accesibilidad). Sin el poblado, solo el cielo.
 */
function describir(transicion: 'atardecer' | 'amanecer', poblado: boolean): string {
  if (transicion === 'atardecer') {
    return poblado
      ? 'En la plaza, anochece sobre el pueblo: el cielo se tiñe de ocaso y oscurece, se encienden la esfera del reloj de la torre, el farol y las ventanas, salen la luna y las estrellas, y cruzan unos cuervos.'
      : 'En la plaza, anochece: el cielo se tiñe de ocaso y oscurece, salen la luna y las estrellas, y cruzan unos cuervos.';
  }
  return poblado
    ? 'En la plaza, amanece sobre el pueblo: un destello, el sol asoma por el este y sube, el cielo se aclara, se apagan las luces y las casas se iluminan, pasan las nubes y cruzan unas golondrinas.'
    : 'En la plaza, amanece: un destello, el sol asoma por el este y sube, el cielo se aclara, pasan las nubes y cruzan unas golondrinas.';
}

/** Las ilustraciones, en public/ciudad (la ciudad de día, de noche y sus luces encajan al píxel). */
const img = (nombre: string) => `/ciudad/${nombre}.webp`;

/** Un número fijo a partir de unos cuantos: así las estrellas están siempre en el mismo sitio. */
function fijo(...n: number[]): number {
  let x = 2166136261;
  for (const v of n) {
    x ^= v + 0x9e3779b9 + (x << 6) + (x >> 2);
    x = Math.imul(x, 16777619) >>> 0;
  }
  return x;
}

/** Destellos sobre las estrellas pintadas del cielo de noche: titilan cada uno a su ritmo. */
const ESTRELLAS = Array.from({ length: 14 }, (_, i) => ({
  x: 4 + (fijo(i, 1) % 92),
  y: 4 + (fijo(i, 2) % 36),
  d: (fijo(i, 4) % 30) / 10,
  p: 3 + (fijo(i, 5) % 4),
}));

/** Las luces de la ciudad, por tandas: primero la esfera del reloj, luego el farol y las ventanas. */
const LUCES = ['reloj', 'farol', 'v1', 'v2', 'v3'] as const;

/** Todo lo que pinta (las aves van por sala.css). */
const PRECARGA = [
  'cielo-noche', 'cielo-dia', 'cielo-ocaso', 'luna', 'sol', 'nube-1', 'nube-2', 'nube-3',
  'ciudad-noche', 'ciudad-dia', ...LUCES.map((l) => `luces-${l}`), 'cuervo', 'golondrina',
];

type Vuelo = { y: number; dur: number; delay: number; escala: number };
/* Alturas en cqh (la plaza es redonda: lo de arriba del todo queda fuera del círculo) */
const CUERVOS: Vuelo[] = [
  { y: 24, dur: 17, delay: 1, escala: 1 },
  { y: 30, dur: 17, delay: 1.6, escala: 0.8 },
  { y: 18, dur: 23, delay: 9, escala: 0.9 },
];
const GOLONDRINAS: Vuelo[] = [
  { y: 26, dur: 14, delay: 3, escala: 0.85 },
  { y: 32, dur: 14, delay: 3.5, escala: 0.7 },
];
const NUBES = [
  { y: 16, dur: 90, delay: -20, alto: 11 },
  { y: 10, dur: 120, delay: -70, alto: 9 },
  { y: 24, dur: 100, delay: -45, alto: 10 },
];

const Ave = ({ clase, y, dur, delay, escala }: Vuelo & { clase: string }) => (
  <span
    className={`ave ${clase}`}
    style={{ '--y': `${y}cqh`, '--dur': `${dur}s`, '--delay': `${delay}s`, '--escala': escala } as CSSProperties}
  />
);

/**
 * La ciudad en la plaza (el centro de la mesa, dentro del corro de fichas), ilustrada:
 * tejados, agujas y la torre del reloj en el centro, vista por una ventana redonda.
 * De entrada no está siempre: solo al pasar a la noche (atardece) o de la noche al día
 * (amanece). Aparece con la fase de antes, hace el cambio, se queda un poco y se
 * desvanece. Con `siempre`, está a la vista todo el rato y cambia en su sitio.
 * De noche se enciende la esfera, luego el farol y las ventanas por tandas
 * (algunas titilan), salen la luna y las estrellas y cruzan cuervos; de día, la
 * ciudad se ilumina y hay sol, nubes y golondrinas (sala.css, sala-ciudad).
 *
 * Solo visual: no recibe el ratón y el lector no la ve; al empezar el cambio pasa
 * su audiodescripción a `onDescribir`. Si la fase cambia con la pestaña oculta, no
 * sale (nadie la vería); con «menos movimiento», sin animaciones (solo el cambio de luz).
 */
const CiudadPlaza = ({
  fase,
  poblado = true,
  siempre = false,
  onDescribir,
}: {
  fase: SalaFase['momento'];
  poblado?: boolean;
  /** Siempre a la vista (Preferencias), no solo al cambiar: atardece y amanece en su sitio. */
  siempre?: boolean;
  /** La audiodescripción del atardecer o el amanecer, cuando empieza a verse. */
  onDescribir?: (texto: string) => void;
}) => {
  // La fase que se pinta: al entrar, aún la de antes; luego, la nueva
  const [faseVista, setFaseVista] = useState(fase);
  const [paso, setPaso] = useState<Paso>('oculta');
  // Cada cambio de fase la reinicia (aunque llegue otro con ella a la vista)
  const [vez, setVez] = useState(0);
  // Al cambiar de fase, la transición que toca: a la noche, atardecer; de la noche al día, amanecer
  const [transicion, setTransicion] = useState<'atardecer' | 'amanecer' | null>(null);
  const [anterior, setAnterior] = useState(fase);
  if (anterior !== fase) {
    setAnterior(fase);
    const toca = fase === 'noche' ? 'atardecer' : anterior === 'noche' ? 'amanecer' : null;
    if (siempre) {
      // Ya a la vista: cambia en su sitio, sin entrar ni salir
      setFaseVista(fase);
      setTransicion(toca);
      setVez((v) => v + 1);
    } else if (!toca || document.hidden) {
      // Sin cambio que enseñar: si estaba a la vista, sigue con la fase nueva
      setFaseVista(fase);
    } else if (paso === 'oculta') {
      setTransicion(toca);
      setPaso('entrando');
      setVez((v) => v + 1);
    } else {
      // Ya a la vista: cambia directamente
      setFaseVista(fase);
      setTransicion(toca);
      setPaso('cambiando');
      setVez((v) => v + 1);
    }
  }

  useEffect(() => {
    if (paso === 'oculta') return;
    const siguiente: Record<Exclude<Paso, 'oculta'>, [number, () => void]> = {
      entrando: [ENTRADA_MS, () => { setFaseVista(fase); setPaso('cambiando'); }],
      cambiando: [DURACION_TRANSICION_MS + ESPERA_MS, () => setPaso('saliendo')],
      saliendo: [SALIDA_MS, () => { setPaso('oculta'); setTransicion(null); }],
    };
    const [ms, hacer] = siguiente[paso];
    const t = window.setTimeout(hacer, ms);
    return () => window.clearTimeout(t);
    // Solo al cambiar de paso o volver a empezar (la fase se lee al acabar la entrada)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso, vez]);

  // Siempre a la vista: acabado el cambio, se queda con la fase nueva
  useEffect(() => {
    if (!siempre || !transicion) return;
    const t = window.setTimeout(() => setTransicion(null), DURACION_TRANSICION_MS);
    return () => window.clearTimeout(t);
  }, [siempre, transicion, vez]);

  // La audiodescripción, cuando el cambio empieza a verse (no mientras aparece con la fase de antes)
  const empieza = transicion && (siempre || paso === 'cambiando') ? `${vez}:${transicion}` : null;
  const onDescribirRef = useRef(onDescribir);
  useEffect(() => {
    onDescribirRef.current = onDescribir;
  });
  useEffect(() => {
    if (empieza && transicion) onDescribirRef.current?.(describir(transicion, poblado));
    // Solo una vez por cambio
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empieza]);

  // Las ilustraciones, cargadas de antemano: cuando sale, ya están
  useEffect(() => {
    for (const nombre of PRECARGA) new Image().src = img(nombre);
  }, []);

  // Con la pestaña oculta, quieta (no gasta)
  const [oculta, setOculta] = useState(() => document.hidden);
  useEffect(() => {
    const alCambiar = () => setOculta(document.hidden);
    document.addEventListener('visibilitychange', alCambiar);
    return () => document.removeEventListener('visibilitychange', alCambiar);
  }, []);

  if (!siempre && paso === 'oculta') return null;

  return (
    // El marco: el fundido de entrada y salida y el filo de latón
    <div className="sala-ciudad-marco" data-saliendo={(!siempre && paso === 'saliendo') || undefined}>
      <div
        aria-hidden="true"
        className={`sala-ciudad ${oculta ? 'sala-ciudad-quieta' : ''}`}
        data-fase={faseVista}
        // Al entrar, aún sin la transición (que empiece a la vista)
        data-transicion={paso === 'entrando' ? undefined : transicion ?? undefined}
      >
        {/* El cielo: el de la noche, el del día y el del ocaso (al cambiar y en la preparación), que se funden */}
        <div className="cielo cielo-noche" style={{ backgroundImage: `url(${img('cielo-noche')})` }} />
        <div className="cielo cielo-dia" style={{ backgroundImage: `url(${img('cielo-dia')})` }} />
        <div className="cielo cielo-ocaso" style={{ backgroundImage: `url(${img('cielo-ocaso')})` }} />
        <div className="estrellas">
          {ESTRELLAS.map((e, i) => (
            <span
              key={i}
              className="estrella"
              style={{ left: `${e.x}%`, top: `${e.y}%`, '--d': `${e.d}s`, '--p': `${e.p}s` } as CSSProperties}
            />
          ))}
        </div>
        <img className="astro luna" src={img('luna')} alt="" decoding="async" />
        <img className="astro sol" src={img('sol')} alt="" decoding="async" />
        <div className="destello" />
        <div className="nubes">
          {NUBES.map((n, i) => (
            <img
              key={i}
              className="nube"
              src={img(`nube-${i + 1}`)}
              alt=""
              decoding="async"
              style={{ '--y': `${n.y}cqh`, '--alto': `${n.alto}cqh`, '--dur': `${n.dur}s`, '--delay': `${n.delay}s` } as CSSProperties}
            />
          ))}
        </div>
  
        {/* La ciudad, de noche debajo y de día encima (se funde); sus luces, sobre las dos. Sin
            el poblado (Preferencias), solo el cielo */}
        {poblado && (
          <div className="pueblo">
            <img src={img('ciudad-noche')} alt="" decoding="async" />
            <img className="pueblo-dia" src={img('ciudad-dia')} alt="" decoding="async" />
            {LUCES.map((l) => (
              <img key={l} className={`luz luz-${l}`} src={img(`luces-${l}`)} alt="" decoding="async" />
            ))}
          </div>
        )}
  
        <div className="cuervos">
          {CUERVOS.map((v, i) => (
            <Ave key={i} clase="cuervo" {...v} />
          ))}
        </div>
        <div className="golondrinas">
          {GOLONDRINAS.map((v, i) => (
            <Ave key={i} clase="golondrina" {...v} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default CiudadPlaza;
