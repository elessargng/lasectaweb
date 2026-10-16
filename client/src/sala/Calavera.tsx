import { useId } from 'react';
import { useMarcas, type EstiloCalavera } from './marcas';
import { BORDE_LACRE, CALAVERA_CARACTER, CALAVERA_GRABADA, CALAVERA_REDONDA } from './trazos';

/**
 * La calavera que marca una ficha en una nominación, en el estilo que haya
 * elegido cada uno (Preferencias > Interfaz) o en el que se le pase. Solo
 * visual: quien la usa dice para el lector que la ficha está marcada.
 */
const Calavera = ({ estilo, className = '' }: { estilo?: EstiloCalavera; className?: string }) => {
  const elegido = useMarcas().calavera;
  // Los degradados necesitan un id propio en cada calavera de la página
  const id = useId();
  const comun = { 'aria-hidden': true, focusable: false, className } as const;

  switch (estilo ?? elegido) {
    case 'lacre':
      // Un sello de cera roja con la calavera en relieve (una copia clara arriba a la
      // izquierda y otra oscura abajo a la derecha) y un brillo
      return (
        <svg viewBox="0 0 512 512" {...comun}>
          <defs>
            <radialGradient id={`${id}-cera`} cx=".42" cy=".36" r=".7">
              <stop offset="0" stopColor="#c9343f" />
              <stop offset=".55" stopColor="#9e1b25" />
              <stop offset="1" stopColor="#5e0f16" />
            </radialGradient>
          </defs>
          <path d={BORDE_LACRE} fill="#3d090e" opacity=".55" transform="translate(6 10)" />
          <path d={BORDE_LACRE} fill={`url(#${id}-cera)`} />
          <circle cx="256" cy="256" r="178" fill="none" stroke="#6e1219" strokeWidth="10" opacity=".8" />
          <circle cx="253" cy="253" r="178" fill="none" stroke="#e46a72" strokeWidth="3" opacity=".35" />
          <g transform="translate(256 262) scale(.58) translate(-256 -256)">
            <path d={CALAVERA_GRABADA} fill="#e8737b" opacity=".45" transform="translate(-7 -7)" />
            <path d={CALAVERA_GRABADA} fill="#3d090e" opacity=".7" transform="translate(7 8)" />
            <path d={CALAVERA_GRABADA} fill="#8d1720" />
          </g>
          <ellipse cx="190" cy="150" rx="60" ry="26" fill="#fff" opacity=".12" transform="rotate(-30 190 150)" />
        </svg>
      );
    case 'laton':
      return (
        <svg viewBox="0 0 512 512" {...comun}>
          <defs>
            <linearGradient id={`${id}-oro`} x1="0" y1="0" x2=".2" y2="1">
              <stop offset="0" stopColor="#f8e9c2" />
              <stop offset=".45" stopColor="#d4af6a" />
              <stop offset="1" stopColor="#8a6428" />
            </linearGradient>
          </defs>
          <path d={CALAVERA_CARACTER} fill={`url(#${id}-oro)`} stroke="#1a1206" strokeWidth="22" strokeLinejoin="round" paintOrder="stroke" />
        </svg>
      );
    case 'hueso':
      return (
        <svg viewBox="0 0 256 256" {...comun}>
          <defs>
            <radialGradient id={`${id}-hueso`} cx=".45" cy=".35" r=".75">
              <stop offset="0" stopColor="#fbf5e6" />
              <stop offset=".7" stopColor="#e6d9bb" />
              <stop offset="1" stopColor="#c4b08a" />
            </radialGradient>
          </defs>
          <path d={CALAVERA_REDONDA} fill={`url(#${id}-hueso)`} stroke="#2b1d0e" strokeWidth="10" strokeLinejoin="round" paintOrder="stroke" />
        </svg>
      );
    default:
      // La clásica: hueso con contorno de tinta (el trazo, por debajo del relleno)
      return (
        <svg viewBox="0 0 512 512" {...comun}>
          <path d={CALAVERA_GRABADA} fill="#efe6d2" stroke="#2b1d0e" strokeWidth="30" strokeLinejoin="round" paintOrder="stroke" />
        </svg>
      );
  }
};

export default Calavera;
