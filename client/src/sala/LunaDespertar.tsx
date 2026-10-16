import { useId } from 'react';
import { LUNA_CARA, LUNA_CARA_DETALLES } from './trazos';

/**
 * La luna del despertar sobre la ficha: creciente con cara, color hueso con
 * contorno de tinta; `nueva` (mensajes sin ver), dorada y con un halo quieto.
 * Solo el dibujo recibe el ratón (y un margen alrededor del contorno): el resto
 * de la ficha sigue siendo de la ficha. Solo visual: el botón que la lleva dice
 * qué es.
 */
const LunaDespertar = ({ nueva, className = '' }: { nueva: boolean; className?: string }) => {
  const id = useId();
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      className={`${className} ${
        nueva ? 'drop-shadow-[0_0_6px_rgba(236,210,154,0.85)]' : 'drop-shadow-[0_2px_2px_rgba(0,0,0,0.55)]'
      }`}
    >
      <defs>
        <linearGradient id={`${id}-oro`} x1="0" y1="0" x2=".3" y2="1">
          <stop offset="0" stopColor="#f8e9c2" />
          <stop offset=".45" stopColor="#e2bd72" />
          <stop offset="1" stopColor="#9c7536" />
        </linearGradient>
      </defs>
      {/* Centrada en la ficha (el dibujo va de x = 13 a 90) */}
      <g transform="translate(2 0)">
        <path
          d={LUNA_CARA}
          fill={nueva ? `url(#${id}-oro)` : '#efe6d2'}
          stroke="#2b1d0e"
          strokeWidth="3.2"
          strokeLinejoin="round"
          paintOrder="stroke"
          className="pointer-events-auto cursor-pointer"
        />
        <g fill="none" stroke="#2b1d0e" strokeLinecap="round" className="pointer-events-none">
          <path d={LUNA_CARA_DETALLES.ojo} strokeWidth="1.7" />
          <path d={LUNA_CARA_DETALLES.ceja} strokeWidth="1.4" />
          <path d={LUNA_CARA_DETALLES.boca} strokeWidth="1.5" />
        </g>
        {/* Más margen para acertar en el contorno (sin pintar) */}
        <path d={LUNA_CARA} fill="none" stroke="transparent" strokeWidth="8" className="cursor-pointer [pointer-events:stroke]" />
      </g>
    </svg>
  );
};

export default LunaDespertar;
