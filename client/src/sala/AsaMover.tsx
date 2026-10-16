import { Move } from 'lucide-react';
import type { ComponentProps } from 'react';
import { ID_AYUDA_MOVER } from './ids';

interface AsaMoverProps extends Omit<ComponentProps<'button'>, 'type' | 'className'> {
  id: string;
  /** Nombre de quien está sentado, para el nombre del botón. */
  nombre: string;
  numero: number;
  /** Se está moviendo a este jugador. */
  cogido: boolean;
}

/**
 * El asa de un asiento ocupado para mover al jugador (ver useMoverAsientos):
 * se arrastra con el ratón o el dedo, o se usa con el teclado. Va en la
 * esquina del cuadro; las instrucciones de teclado son su descripción.
 */
const AsaMover = ({ nombre, numero, cogido, ...props }: AsaMoverProps) => (
  <button
    {...props}
    type="button"
    aria-label={`Mover a ${nombre}, asiento ${numero}`}
    aria-pressed={cogido}
    aria-describedby={ID_AYUDA_MOVER}
    className={`absolute left-1 top-1 z-10 flex h-8 w-8 touch-none items-center justify-center rounded-full border border-gold/70 bg-surface text-gold-bright shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main ${
      cogido ? 'cursor-grabbing bg-theme-main text-background' : 'cursor-grab hover:bg-theme-container'
    }`}
  >
    <Move size={16} />
  </button>
);

export default AsaMover;
