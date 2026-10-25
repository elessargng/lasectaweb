import { UserMinus } from 'lucide-react';

interface AsaLevantarProps {
  /** Nombre de quien está sentado, para el nombre del botón. */
  nombre: string;
  numero: number;
  /** La esquina del asa de mover: va justo a su lado, hacia dentro del cuadro. */
  lado?: 'izquierda' | 'derecha';
  /** Mientras se mueve a alguien o ya se está pidiendo, no hace nada. */
  desactivado?: boolean;
  onLevantar: () => void;
}

/**
 * Junto al asa de mover (editando asientos): levanta al jugador de su asiento
 * y vuelve a visitante. Es lo mismo que «Levantar jugador» del menú del
 * narrador, sin tener que buscarlo en la lista.
 */
const AsaLevantar = ({ nombre, numero, lado = 'izquierda', desactivado = false, onLevantar }: AsaLevantarProps) => (
  <button
    type="button"
    onClick={() => !desactivado && onLevantar()}
    aria-label={`Levantar a ${nombre} del asiento ${numero}`}
    aria-disabled={desactivado || undefined}
    title="Levantar del asiento"
    className={`absolute top-1 z-[5] ${lado === 'derecha' ? 'right-10' : 'left-10'} flex h-8 w-8 items-center justify-center rounded-full border border-gold/70 bg-surface text-gold-bright shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main ${
      desactivado ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-theme-container hover:text-blood-pale'
    }`}
  >
    <UserMinus size={16} />
  </button>
);

export default AsaLevantar;
