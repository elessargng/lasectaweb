import { Keyboard } from 'lucide-react';
import { describirAtajo, simboloAtajo, type Atajo } from './atajos';

interface TeclaAtajoProps {
  atajo: Atajo;
  /** Para el lector: si el texto de al lado ya dice la tecla, se oculta (es refuerzo visual). */
  ocultoALector?: boolean;
  className?: string;
}

/**
 * La tecla de un atajo, como una tecla de teclado: un iconito y lo que lleva
 * («Espacio», «Ctrl + M»; el punto, la coma y Retroceso, con su símbolo: «.»,
 * «,», «⟵»). El lector oye su nombre («Punto»). Se pone al lado de la acción o
 * del menú que la usa.
 */
const TeclaAtajo = ({ atajo, ocultoALector = false, className = '' }: TeclaAtajoProps) => (
  <kbd
    aria-hidden={ocultoALector || undefined}
    className={`inline-flex shrink-0 items-center gap-1 rounded border border-outline-ghost bg-background px-1.5 py-0.5 font-mono text-xs leading-none ${className}`}
  >
    <Keyboard size={12} aria-hidden="true" className="opacity-70" />
    <span aria-hidden="true">{simboloAtajo(atajo)}</span>
    {!ocultoALector && <span className="sr-only">atajo: {describirAtajo(atajo)}</span>}
  </kbd>
);

export default TeclaAtajo;
