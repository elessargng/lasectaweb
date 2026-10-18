import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { SalaFase } from './useSala';

/** Lo que dura el atardecer o el amanecer (sala.css lo reparte entre el cielo, el sol y las luces). */
const DURACION_TRANSICION_MS = 3600;
/** El suelo de la ciudad (alto del dibujo): la cabecera mide más o menos eso. */
const SUELO = 56;

type Tejado = 'dos' | 'plano' | 'aguja' | 'chimenea';
type Casa = [x: number, ancho: number, alto: number, tejado: Tejado];

/** Un número fijo a partir de unos cuantos: así la ciudad es siempre la misma. */
function fijo(...n: number[]): number {
  let x = 2166136261;
  for (const v of n) {
    x ^= v + 0x9e3779b9 + (x << 6) + (x >> 2);
    x = Math.imul(x, 16777619) >>> 0;
  }
  return x;
}

/** Las casas del plano medio; la torre del reloj va en el centro (x = 300). */
const MEDIO: Casa[] = [
  [8, 30, 20, 'dos'], [40, 18, 27, 'plano'], [60, 28, 17, 'dos'], [90, 14, 34, 'aguja'], [106, 36, 22, 'dos'],
  [144, 22, 26, 'chimenea'], [168, 32, 18, 'dos'], [202, 20, 24, 'plano'], [224, 30, 30, 'dos'], [256, 24, 21, 'chimenea'],
  [326, 26, 24, 'dos'], [354, 20, 30, 'plano'], [376, 34, 19, 'dos'], [412, 16, 33, 'aguja'], [430, 30, 22, 'chimenea'],
  [462, 26, 27, 'dos'], [490, 36, 18, 'dos'], [528, 20, 24, 'plano'], [550, 30, 20, 'dos'], [582, 18, 26, 'chimenea'],
];
/** Las casas de delante, bajas. */
const CERCA: Casa[] = [[0, 42, 12, 'dos'], [150, 36, 10, 'dos'], [432, 42, 11, 'dos'], [556, 44, 13, 'dos']];

/** El contorno de una casa, según su tejado. */
function casa([x, w, alto, tejado]: Casa): string {
  const y = SUELO - alto;
  if (tejado === 'dos') return `M${x},${SUELO} V${y} L${x + w / 2},${y - w * 0.42} L${x + w},${y} V${SUELO} Z`;
  if (tejado === 'aguja') return `M${x},${SUELO} V${y} L${x + w / 2},${y - 18} L${x + w},${y} V${SUELO} Z`;
  if (tejado === 'chimenea') {
    const cx = x + w * 0.68;
    return `M${x},${SUELO} V${y} H${cx} V${y - 6} H${cx + 4} V${y} H${x + w} V${SUELO} Z`;
  }
  return `M${x},${SUELO} V${y} H${x + 2} V${y - 2} H${x + w - 2} V${y} H${x + w} V${SUELO} Z`;
}

/** Las casas lejanas: bajas y seguidas, de punta a punta. */
function lejos(): string {
  let d = '';
  for (let x = 0, i = 0; x < 600; i++) {
    const w = 14 + (fijo(i, 3) % 10);
    d += casa([x, w, 9 + (fijo(i, 7) % 9), fijo(i, 11) % 3 === 0 ? 'dos' : 'plano']);
    x += w + 1;
  }
  return d;
}

/** Las ventanas que se encienden de noche (unas cuantas por casa, cada una a su tiempo; algunas titilan). */
function ventanas() {
  const lista: { x: number; y: number; d: number; titila: boolean }[] = [];
  MEDIO.forEach(([x, w, alto], i) => {
    const cols = Math.floor((w - 4) / 6);
    const filas = Math.floor((alto - 7) / 7);
    for (let f = 0; f < filas; f++) {
      for (let c = 0; c < cols; c++) {
        const k = fijo(i, f, c);
        if (k % 100 >= 42) continue;
        lista.push({ x: x + 3 + c * 6, y: SUELO - alto + 4 + f * 7, d: ((k >> 8) % 24) * 0.11, titila: (k >> 4) % 6 === 0 });
      }
    }
  });
  return lista;
}

function estrellas() {
  return Array.from({ length: 38 }, (_, i) => ({
    x: fijo(i, 1) % 600,
    y: 2 + (fijo(i, 2) % 24),
    r: 0.35 + (fijo(i, 3) % 7) / 10,
    d: (fijo(i, 4) % 30) / 10,
    p: 3 + (fijo(i, 5) % 4),
    o: 0.5 + (fijo(i, 6) % 5) / 10,
  }));
}

// Se calcula una vez: la ciudad no cambia
const DIBUJO = {
  lejos: lejos(),
  medio: MEDIO.map(casa).join(' '),
  cerca: CERCA.map(casa).join(' '),
  ventanas: ventanas(),
  estrellas: estrellas(),
  rayos: Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6;
    return { x1: 470 + Math.cos(a) * 9, y1: 13 + Math.sin(a) * 9, x2: 470 + Math.cos(a) * 11.5, y2: 13 + Math.sin(a) * 11.5 };
  }),
};

type Vuelo = { y: number; dur: number; delay: number; escala: number };
const CUERVOS: Vuelo[] = [
  { y: 13, dur: 17, delay: 1, escala: 1 },
  { y: 18, dur: 17, delay: 1.5, escala: 0.8 },
  { y: 10, dur: 23, delay: 9, escala: 0.9 },
];
const PAJAROS: Vuelo[] = [
  { y: 20, dur: 26, delay: 3, escala: 0.6 },
  { y: 24, dur: 26, delay: 3.7, escala: 0.5 },
];
const NUBES = [
  { y: 14, dur: 90, delay: -20, ancho: 60 },
  { y: 9, dur: 120, delay: -70, ancho: 44 },
  { y: 19, dur: 100, delay: -45, ancho: 52 },
];

const Ave = ({ y, dur, delay, escala }: Vuelo) => (
  <g className="vuela" style={{ '--y': `${y}px`, '--dur': `${dur}s`, '--delay': `${delay}s` } as CSSProperties}>
    <g transform={`scale(${escala})`}>
      <path className="ave ala" d="M-5,0 Q-2.5,-3 0,0 Q2.5,-3 5,0" />
    </g>
  </g>
);

/**
 * La ciudad de la cabecera, como un aguafuerte de latón: tejados, agujas y la
 * torre del reloj en el centro. De noche brillan el latón, la esfera (con su halo)
 * y las ventanas, salen las estrellas y la luna y cruzan cuervos; de día, el cielo
 * se templa, el trazo se aclara y hay sol, nubes y pájaros. Al pasar a la noche,
 * atardece; al pasar al día, amanece (sala.css, sala-ciudad). En la preparación,
 * un crepúsculo quieto.
 *
 * Solo visual: no recibe el ratón y el lector no la ve. Con la pestaña oculta,
 * se para; con «menos movimiento», sin animaciones (solo el cambio de luz).
 */
const SkylineCabecera = ({ fase }: { fase: SalaFase['momento'] }) => {
  // Al cambiar de fase, la transición que toca: a la noche, atardecer; de la noche al día, amanecer
  const [transicion, setTransicion] = useState<'atardecer' | 'amanecer' | null>(null);
  const anterior = useRef(fase);
  useEffect(() => {
    const antes = anterior.current;
    anterior.current = fase;
    if (antes === fase) return;
    setTransicion(fase === 'noche' ? 'atardecer' : antes === 'noche' ? 'amanecer' : null);
    const t = window.setTimeout(() => setTransicion(null), DURACION_TRANSICION_MS);
    return () => window.clearTimeout(t);
  }, [fase]);

  // Con la pestaña oculta, quieta (no gasta)
  const [oculta, setOculta] = useState(() => document.hidden);
  useEffect(() => {
    const alCambiar = () => setOculta(document.hidden);
    document.addEventListener('visibilitychange', alCambiar);
    return () => document.removeEventListener('visibilitychange', alCambiar);
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`sala-ciudad ${oculta ? 'sala-ciudad-quieta' : ''}`}
      data-fase={fase}
      data-transicion={transicion ?? undefined}
    >
      <svg viewBox={`0 0 600 ${SUELO}`} preserveAspectRatio="xMidYMax slice" focusable="false">
        <defs>
          <linearGradient id="sala-ciudad-cielo-noche" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#4b3c86" stopOpacity="0" />
            <stop offset="1" stopColor="#4b3c86" stopOpacity=".32" />
          </linearGradient>
          <linearGradient id="sala-ciudad-cielo-dia" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e0a24a" stopOpacity=".08" />
            <stop offset="1" stopColor="#e8a94e" stopOpacity=".38" />
          </linearGradient>
          <linearGradient id="sala-ciudad-cielo-ocaso" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#9e1b25" stopOpacity="0" />
            <stop offset="1" stopColor="#d4643a" stopOpacity=".45" />
          </linearGradient>
          <radialGradient id="sala-ciudad-halo">
            <stop offset="0" stopColor="#ffd27a" stopOpacity=".95" />
            <stop offset=".35" stopColor="#ffb347" stopOpacity=".45" />
            <stop offset="1" stopColor="#ffb347" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sala-ciudad-sol" >
            <stop offset="0" stopColor="#fff0c2" stopOpacity=".95" />
            <stop offset=".3" stopColor="#ffd27a" stopOpacity=".45" />
            <stop offset="1" stopColor="#ffd27a" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sala-ciudad-destello" cx="470" cy="13" r="70" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#fff2c4" stopOpacity=".95" />
            <stop offset=".3" stopColor="#ffd27a" stopOpacity=".5" />
            <stop offset="1" stopColor="#ffd27a" stopOpacity="0" />
          </radialGradient>
          {/* La luna creciente: un círculo al que otro le muerde un lado */}
          <mask id="sala-ciudad-creciente">
            <rect x="0" y="0" width="600" height={SUELO} fill="#fff" />
            <circle cx="113.2" cy="11" r="5.6" fill="#000" />
          </mask>
        </defs>

        {/* El cielo: el de la noche, el del día y el del ocaso (solo al cambiar), que se funden */}
        <rect className="cielo-noche t" width="600" height={SUELO} />
        <rect className="cielo-dia t" width="600" height={SUELO} />
        <rect className="cielo-ocaso" width="600" height={SUELO} />
        <g>
          {DIBUJO.estrellas.map((e, i) => (
            <circle
              key={i}
              className="estrella"
              style={{ '--d': `${e.d}s`, '--p': `${e.p}s`, '--o': e.o } as CSSProperties}
              cx={e.x}
              cy={e.y}
              r={e.r}
            />
          ))}
        </g>
        <g className="luna t">
          <circle className="luna-disco" cx="110" cy="14" r="6" mask="url(#sala-ciudad-creciente)" />
        </g>
        <g className="sol t">
          <g className="rayos">
            {DIBUJO.rayos.map((r, i) => (
              <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} />
            ))}
          </g>
          <circle className="sol-brillo t" cx="470" cy="13" r="26" fill="url(#sala-ciudad-sol)" />
          <circle className="sol-disco t" cx="470" cy="13" r="6.5" />
        </g>
        <rect className="destello" width="600" height={SUELO} fill="url(#sala-ciudad-destello)" />
        <g className="nubes">
          {NUBES.map((n, i) => (
            <g key={i} className="nube" style={{ '--dur': `${n.dur}s`, '--delay': `${n.delay}s` } as CSSProperties}>
              <path
                className="nube-trazo"
                d={`M0,${n.y} q${n.ancho * 0.2},-7 ${n.ancho * 0.42},-3 q${n.ancho * 0.18},-6 ${n.ancho * 0.36},0 q${n.ancho * 0.16},1 ${n.ancho * 0.22},3 Z`}
              />
            </g>
          ))}
        </g>

        {/* La ciudad: lejos, en medio (con sus ventanas), la torre del reloj y delante */}
        <g className="lejos lineas">
          <path className="edif t" d={DIBUJO.lejos} />
        </g>
        <g className="medio lineas">
          <path className="edif t" d={DIBUJO.medio} />
          {DIBUJO.ventanas.map((v, i) => (
            <rect
              key={i}
              className={`ventana${v.titila ? ' titila' : ''}`}
              style={{ '--d': `${v.d.toFixed(2)}s` } as CSSProperties}
              x={v.x}
              y={v.y}
              width="2.6"
              height="3.6"
              rx=".4"
            />
          ))}
        </g>
        <g className="lineas">
          <path className="edif t" d={`M289,${SUELO} V20 H311 V${SUELO} Z M292,20 V10 H308 V20 Z M291,10 L300,0.6 L309,10 Z`} />
          <rect className="ventana" style={{ '--d': '.2s' } as CSSProperties} x="295.5" y="40" width="2.6" height="5" rx="1.2" />
          <rect className="ventana titila" style={{ '--d': '.6s' } as CSSProperties} x="301.9" y="40" width="2.6" height="5" rx="1.2" />
          <rect className="ventana" style={{ '--d': '.9s' } as CSSProperties} x="298.6" y="12.5" width="2.8" height="5" rx="1.4" />
        </g>
        {/* La esfera del reloj: de noche se enciende, con su halo; las agujas avanzan */}
        <g className="halo t">
          <circle className="halo-respira" cx="300" cy="28" r="15" fill="url(#sala-ciudad-halo)" />
        </g>
        <circle className="esfera t" cx="300" cy="28" r="6.2" />
        <line className="manecilla aguja-hora t" x1="300" y1="28" x2="300" y2="24.6" />
        <line className="manecilla aguja-min t" x1="300" y1="28" x2="300" y2="22.8" />
        <g className="cerca lineas">
          <path className="edif t" d={DIBUJO.cerca} />
        </g>
        {/* El farol de la calle, que se enciende de noche */}
        <g className="lineas">
          <path className="farol" d={`M266,${SUELO} V39 M263.5,39 H268.5`} />
          <circle className="farol-luz t" cx="266" cy="37.5" r="5" fill="url(#sala-ciudad-halo)" />
          <rect className="ventana" style={{ '--d': '.4s' } as CSSProperties} x="264.6" y="35.6" width="2.8" height="3.4" rx=".5" />
        </g>
        <g className="cuervos">
          {CUERVOS.map((v, i) => (
            <Ave key={i} {...v} />
          ))}
        </g>
        <g className="pajaros">
          {PAJAROS.map((v, i) => (
            <Ave key={i} {...v} />
          ))}
        </g>
      </svg>
    </div>
  );
};

export default SkylineCabecera;
