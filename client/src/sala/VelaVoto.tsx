import { useId, useState } from 'react';

interface VelaVotoProps {
  /** Le queda el voto: la vela arde. Si no, está apagada. */
  encendida: boolean;
  className?: string;
}

/**
 * La vela negra de un muerto, como en las partidas en persona: encendida
 * mientras le queda el único voto que tiene; al gastarlo (o al quitárselo el
 * narrador), la llama se encoge y se apaga dejando un hilo de humo, y queda el
 * pabilo. Si lo recupera (el Barquero, o el narrador), se vuelve a encender.
 *
 * Es como las de las partidas: corta y ancha, de cera negra brillante, con el
 * borde derretido y goterones que caen por los lados; encendida, la llama
 * titila (quieta si se pide menos movimiento) y su luz se transparenta por el
 * borde. El humo solo sale al apagarse delante de quien mira, no al
 * cargar la sala con la vela ya apagada.
 *
 * Solo visual (aria-hidden): quien la use dice al lector si le queda el voto.
 */
const VelaVoto = ({ encendida, className = '' }: VelaVotoProps) => {
  const id = useId().replace(/:/g, '');
  // El humo, solo al pasar de encendida a apagada (con la sala ya cargada)
  const [antes, setAntes] = useState(encendida);
  const [humo, setHumo] = useState(0);
  if (antes !== encendida) {
    setAntes(encendida);
    if (antes) setHumo((n) => n + 1);
  }

  return (
    <span aria-hidden="true" className={`pointer-events-none block ${className}`}>
      <svg viewBox="0 0 60 64" className="block h-full w-full overflow-visible">
        <defs>
          {/* Cera negra, con el brillo a la izquierda */}
          <linearGradient id={`${id}-cera`} x1="0" x2="1">
            <stop offset="0" stopColor="#050408" />
            <stop offset="0.18" stopColor="#2c2934" />
            <stop offset="0.3" stopColor="#15131a" />
            <stop offset="0.75" stopColor="#0d0c11" />
            <stop offset="0.9" stopColor="#24212b" />
            <stop offset="1" stopColor="#040306" />
          </linearGradient>
          {/* Los goterones, algo más claros que el cuerpo para que se distingan */}
          <linearGradient id={`${id}-gota`} x1="0" x2="1">
            <stop offset="0" stopColor="#0a090d" />
            <stop offset="0.35" stopColor="#3a3644" />
            <stop offset="1" stopColor="#0a090d" />
          </linearGradient>
          {/* La luz de la llama, que se transparenta por el borde de la cera */}
          <radialGradient id={`${id}-brillo`} cx="0.5" cy="0.15" r="0.7">
            <stop offset="0" stopColor="#ffd98a" stopOpacity="0.95" />
            <stop offset="0.35" stopColor="#e3913a" stopOpacity="0.55" />
            <stop offset="1" stopColor="#7a3510" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-llama`} cx="0.5" cy="0.72" r="0.65">
            <stop offset="0" stopColor="#fffbe8" />
            <stop offset="0.35" stopColor="#ffe29a" />
            <stop offset="0.75" stopColor="#f2a33a" />
            <stop offset="1" stopColor="#c45a14" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-halo`}>
            <stop offset="0" stopColor="#ffcf6b" stopOpacity="0.6" />
            <stop offset="1" stopColor="#ffcf6b" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Halo de la llama, sobre la mesa */}
        <circle
          cx="30"
          cy="20"
          r="26"
          fill={`url(#${id}-halo)`}
          className={`sala-vela-halo transition-opacity duration-500 motion-reduce:transition-none ${encendida ? 'opacity-100' : 'opacity-0'}`}
        />

        {/* El cuerpo: corto y ancho, con el borde de arriba derretido */}
        <path
          d="M8 30 Q8 26.5 12 26 Q16 24.5 20 26.5 Q24 25 29 26 Q34 24.6 38 26.3 Q43 25 47 26.5 Q52 26.5 52 30 L52 57 Q30 63 8 57 Z"
          fill={`url(#${id}-cera)`}
          stroke="#000"
          strokeWidth="0.6"
        />
        {/* El filo del borde derretido: que se lea también apagada, sobre la mesa oscura */}
        <path
          d="M8.4 29.5 Q8.6 26.8 12 26.4 Q16 25 20 27 Q24 25.5 29 26.5 Q34 25.1 38 26.8 Q43 25.5 47 27 Q51.6 27 51.6 29.5"
          fill="none"
          stroke="#8a8396"
          strokeOpacity="0.7"
          strokeWidth="0.9"
          strokeLinecap="round"
        />
        {/* Brillo de la cera */}
        <path d="M14.5 34 Q13.8 45 15 55" fill="none" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M45.5 33 Q46.3 43 45.4 52" fill="none" stroke="#ffffff" strokeOpacity="0.08" strokeWidth="1.4" strokeLinecap="round" />

        {/* Los goterones: caen desde el borde y acaban en gota */}
        <g fill={`url(#${id}-gota)`} stroke="#000" strokeWidth="0.5">
          <path d="M10.5 28 Q9.6 34 10.4 40.5 Q11 44.6 13.6 44.4 Q16.2 44.1 15.8 39.5 Q15.3 33.5 16 27.4 Z" />
          <path d="M23.5 26.6 Q23 36 23.6 47.5 Q24.1 51.6 27.2 51.5 Q30.3 51.3 29.9 46.4 Q29.4 36 30 26.4 Z" />
          <path d="M37.5 26.6 Q37 31 37.6 35.4 Q38.1 38.6 40.6 38.5 Q43.2 38.3 42.8 34.6 Q42.4 30.8 43 26.4 Z" />
          <path d="M47 27 Q46.8 35.5 47.2 42.2 Q47.6 46.2 49.9 45.8 Q51.8 45.4 51.6 41.2 L51.8 28.6 Z" />
        </g>
        {/* El brillo de cada gota */}
        <g fill="#ffffff" fillOpacity="0.35">
          <ellipse cx="12.4" cy="41.6" rx="0.9" ry="1.4" />
          <ellipse cx="25.8" cy="48.4" rx="1" ry="1.6" />
          <ellipse cx="39.5" cy="35.8" rx="0.8" ry="1.2" />
          <ellipse cx="48.8" cy="42.8" rx="0.7" ry="1.2" />
        </g>

        {/* Arriba, el pozo de cera derretida; encendida, iluminado por la llama */}
        <ellipse cx="30" cy="29.5" rx="19" ry="3.6" fill="#060509" />
        <path
          d="M8 30 Q8 26.5 12 26 Q16 24.5 20 26.5 Q24 25 29 26 Q34 24.6 38 26.3 Q43 25 47 26.5 Q52 26.5 52 30 L52 44 Q30 48 8 44 Z"
          fill={`url(#${id}-brillo)`}
          className={`transition-opacity duration-500 motion-reduce:transition-none ${encendida ? 'opacity-100' : 'opacity-0'}`}
        />

        {/* El pabilo */}
        <path d="M30 29.5 Q30.6 27.5 29.6 25.4" fill="none" stroke="#14110d" strokeWidth="1.3" strokeLinecap="round" />

        {/* La llama */}
        <g className={`sala-vela-llama ${encendida ? 'sala-vela-llama-encendida' : 'sala-vela-llama-apagada'}`}>
          <path d="M30 5 C33.6 11 35.6 16.5 34.9 21 C34.3 25 32.3 27.6 30 27.6 C27.7 27.6 25.7 25 25.1 21 C24.4 16.5 26.4 11 30 5 Z" fill={`url(#${id}-llama)`} />
          <ellipse cx="30" cy="22.5" rx="2.1" ry="3.4" fill="#fffef6" opacity="0.9" />
          <ellipse cx="30" cy="26.3" rx="1.4" ry="1.1" fill="#4c7fd1" opacity="0.5" />
        </g>

        {/* Humo al apagarse: cada vez que se apaga, uno nuevo */}
        {humo > 0 && !encendida && (
          <path
            key={humo}
            d="M30 25 C26 19 34 14 29.5 8 C26 3 32 -1 29 -9"
            fill="none"
            stroke="#c9c2b4"
            strokeWidth="1.8"
            strokeLinecap="round"
            className="sala-vela-humo"
          />
        )}
      </svg>
    </span>
  );
};

export default VelaVoto;
