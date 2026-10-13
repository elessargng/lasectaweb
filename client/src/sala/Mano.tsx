import type { ReactNode } from 'react';
import type { FormaMano } from './useSala';

/**
 * Las formas de la mano que puede levantar un jugador (como en piedra, papel o
 * tijera). Cada una: la silueta y, encima, líneas de detalle (nudillos, pulgar).
 */
const FORMAS: Record<FormaMano, { silueta: ReactNode; detalles?: ReactNode }> = {
  palma: {
    silueta: (
      <>
        {/* Dedos: índice, corazón, anular y meñique */}
        <rect x="6.3" y="4" width="2.7" height="10" rx="1.35" />
        <rect x="9.3" y="1.6" width="2.7" height="12" rx="1.35" />
        <rect x="12.3" y="2.2" width="2.7" height="11.5" rx="1.35" />
        <rect x="15.3" y="4.6" width="2.6" height="9.5" rx="1.3" />
        {/* Pulgar, inclinado hacia fuera */}
        <rect x="3.2" y="10.5" width="2.7" height="7.5" rx="1.35" transform="rotate(-32 4.55 14.25)" />
        {/* Palma */}
        <rect x="6.3" y="10" width="11.6" height="11.5" rx="4" />
      </>
    ),
  },
  puno: {
    silueta: (
      <>
        <rect x="5" y="8.5" width="14" height="12.5" rx="4" />
        {/* Nudillos */}
        <rect x="5.2" y="6.2" width="3.4" height="6" rx="1.7" />
        <rect x="8.6" y="5.4" width="3.4" height="6" rx="1.7" />
        <rect x="12" y="5.6" width="3.4" height="6" rx="1.7" />
        <rect x="15.4" y="6.6" width="3.4" height="6" rx="1.7" />
        {/* Pulgar */}
        <rect x="3.6" y="12.6" width="4" height="5.5" rx="2" />
      </>
    ),
    // Separación de los dedos y el pulgar cruzado
    detalles: <path d="M8.6 9.5 V11.4 M12 9.2 V11.2 M15.4 9.6 V11.6 M5.2 14.4 H12.5" />,
  },
  tijera: {
    silueta: (
      <>
        {/* Índice y corazón, en V */}
        <rect x="7.4" y="1.8" width="2.8" height="12" rx="1.4" transform="rotate(-14 8.8 13.8)" />
        <rect x="12.6" y="1.8" width="2.8" height="12" rx="1.4" transform="rotate(14 14 13.8)" />
        <rect x="6.3" y="10.5" width="11.6" height="11" rx="4" />
        {/* Pulgar */}
        <rect x="3.6" y="13" width="4" height="5.2" rx="2" />
      </>
    ),
    // Pulgar cruzado y los otros dos dedos doblados
    detalles: <path d="M5.6 15.2 H13 M13.6 12.4 Q16 11.2 17.6 12.8" />,
  },
};

const CONTORNO = '#7a4a2a';
const CARNE = '#f1c7a0';

/**
 * Una mano en color carne con contorno oscuro, para que se vea sobre el fondo
 * negro. Solo visual. La silueta se dibuja dos veces: con un trazo grueso oscuro
 * (el contorno) y encima, sin trazo, con el relleno; así no se ven las uniones.
 */
const Mano = ({ forma, className = '' }: { forma: FormaMano; className?: string }) => {
  const { silueta, detalles } = FORMAS[forma];
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <g fill={CONTORNO} stroke={CONTORNO} strokeWidth="1.6" strokeLinejoin="round">
        {silueta}
      </g>
      <g fill={CARNE}>{silueta}</g>
      {detalles && (
        <g fill="none" stroke={CONTORNO} strokeWidth="0.7" strokeLinecap="round">
          {detalles}
        </g>
      )}
    </svg>
  );
};

export default Mano;
