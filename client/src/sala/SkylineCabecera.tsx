import { useEffect, useState, type CSSProperties } from 'react';
import type { SalaFase } from './useSala';

/** Lo que dura el atardecer o el amanecer (sala.css lo reparte entre el cielo, el sol y las luces). */
const DURACION_TRANSICION_MS = 3600;

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

type Vuelo = { y: number; dur: number; delay: number; escala: number };
const CUERVOS: Vuelo[] = [
  { y: 10, dur: 17, delay: 1, escala: 1 },
  { y: 22, dur: 17, delay: 1.6, escala: 0.8 },
  { y: 4, dur: 23, delay: 9, escala: 0.9 },
];
const GOLONDRINAS: Vuelo[] = [
  { y: 14, dur: 14, delay: 3, escala: 0.85 },
  { y: 22, dur: 14, delay: 3.5, escala: 0.7 },
];
const NUBES = [
  { y: 6, dur: 90, delay: -20, alto: 26 },
  { y: 0, dur: 120, delay: -70, alto: 20 },
  { y: 14, dur: 100, delay: -45, alto: 22 },
];

const Ave = ({ clase, y, dur, delay, escala }: Vuelo & { clase: string }) => (
  <span
    className={`ave ${clase}`}
    style={{ '--y': `${y}cqh`, '--dur': `${dur}s`, '--delay': `${delay}s`, '--escala': escala } as CSSProperties}
  />
);

/**
 * La ciudad de la cabecera, ilustrada: tejados, agujas y la torre del reloj en el
 * centro. De noche se enciende la esfera, luego el farol y las ventanas por tandas
 * (algunas titilan), salen la luna y las estrellas y cruzan cuervos; de día, la
 * ciudad se ilumina y hay sol, nubes y golondrinas. Al pasar a la noche, atardece;
 * al pasar al día, amanece (sala.css, sala-ciudad). En la preparación, un crepúsculo quieto.
 *
 * Solo visual: no recibe el ratón y el lector no la ve. Con la pestaña oculta,
 * se para; con «menos movimiento», sin animaciones (solo el cambio de luz).
 */
const SkylineCabecera = ({ fase, poblado = true }: { fase: SalaFase['momento']; poblado?: boolean }) => {
  // Al cambiar de fase, la transición que toca: a la noche, atardecer; de la noche al día, amanecer
  const [transicion, setTransicion] = useState<'atardecer' | 'amanecer' | null>(null);
  const [anterior, setAnterior] = useState(fase);
  if (anterior !== fase) {
    setAnterior(fase);
    setTransicion(fase === 'noche' ? 'atardecer' : anterior === 'noche' ? 'amanecer' : null);
  }
  useEffect(() => {
    if (!transicion) return;
    const t = window.setTimeout(() => setTransicion(null), DURACION_TRANSICION_MS);
    return () => window.clearTimeout(t);
  }, [transicion]);

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
  );
};

export default SkylineCabecera;
