import { forwardRef } from 'react';
import type { LucideProps } from 'lucide-react';

/**
 * Castillo gótico para los eventos y jornadas: dos torres de tejado cónico,
 * aguja central y puerta en arco. Sigue la
 * rejilla de 24×24 y el trazo de lucide para convivir con el resto de iconos,
 * y como ellos es decorativo (aria-hidden) salvo que se le dé un nombre.
 */
const IconoCastillo = forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, color = 'currentColor', strokeWidth = 1.75, className = '', ...rest }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      {/* Silueta: torre, muralla, aguja central, muralla y torre; pocos trazos para que se lea a 14 px */}
      <path d="M3 21h18" />
      <path d="M4.5 21v-8L6.5 9l2 4v2.5H10V9.5L12 4l2 5.5v6h1.5V13l2-4 2 4v8" />
      {/* Arranque de los tejados */}
      <path d="M4.5 13h4M15.5 13h4M10 9.5h4" />
      {/* Mástil de la aguja */}
      <path d="M12 4V2" />
      {/* Puerta en arco */}
      <path d="M10.75 21v-2.5a1.25 1.25 0 0 1 2.5 0V21" />
    </svg>
  )
);

IconoCastillo.displayName = 'IconoCastillo';

export default IconoCastillo;
