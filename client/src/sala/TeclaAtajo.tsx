import { Keyboard } from 'lucide-react';
import { describirAtajo, type Atajo } from './atajos';

interface TeclaAtajoProps {
  atajo: Atajo;
  /** Para el lector: si el texto de al lado ya dice la tecla, se oculta (es refuerzo visual). */
  ocultoALector?: boolean;
  className?: string;
}

/**
 * La tecla de un atajo, como una tecla de teclado: un iconito y su nombre
 * («Espacio», «Ctrl + M»). Se pone al lado de la acción o del menú que la usa.
 */
const TeclaAtajo = ({ atajo, ocultoALector = false, className = '' }: TeclaAtajoProps) => (
  <kbd
    aria-hidden={ocultoALector || undefined}
    aria-label={ocultoALector ? undefined : `atajo: ${describirAtajo(atajo)}`}
    className={`inline-flex shrink-0 items-center gap-1 rounded border border-outline-ghost bg-background px-1.5 py-0.5 font-mono text-xs leading-none ${className}`}
  >
    <Keyboard size={12} aria-hidden="true" className="opacity-70" />
    {describirAtajo(atajo)}
  </kbd>
);

export default TeclaAtajo;
