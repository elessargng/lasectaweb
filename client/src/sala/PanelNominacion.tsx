import { Minus, Plus } from 'lucide-react';
import { hacenFalta } from './avisosSala';
import { botonPrincipal, botonSecundario } from './estilos';
import { ID_CUENTA_ATRAS } from './ids';

/** Los votos que hacen falta, y cómo cambiarlos. */
export interface VotosNominacion {
  necesarios: number;
  porDefecto: number;
  /** Como mucho, tantos como asientos. */
  maximo: number;
  /** null: volver a los de por defecto. */
  onCambiar: (votos: number | null) => void;
}

interface PanelNominacionProps {
  /** El nominado lleva ya la calavera. */
  marcado: boolean;
  /** Se puede arrancar la cuenta atrás (no, si ya se está votando o se ha votado). */
  puedeCuentaAtras: boolean;
  /** Los votos que hacen falta (si el servidor deja cambiarlos). */
  votos: VotosNominacion | null;
  /** Quién lleva ahora la calavera y con cuántos votos (para ver empates), o null. */
  marcaActual: string | null;
  /** Quitar la calavera a quien la lleve (sale si alguien la lleva). */
  onDesmarcar: (() => void) | null;
  onCuentaAtras: () => void;
  onMarca: () => void;
  onCerrar: () => void;
}

/** En el centro de la mesa, para el narrador: lo que se puede hacer con la nominación abierta. */
const PanelNominacion = ({
  marcado,
  puedeCuentaAtras,
  votos,
  marcaActual,
  onDesmarcar,
  onCuentaAtras,
  onMarca,
  onCerrar,
}: PanelNominacionProps) => (
  <div role="group" aria-label="Nominación" className="flex flex-col gap-2">
    {marcaActual && <p className="max-w-56 text-center text-sm text-on-surface-muted">Marca actual: {marcaActual}</p>}
    {votos && <VotosNecesarios {...votos} />}
    {puedeCuentaAtras && (
      <button id={ID_CUENTA_ATRAS} type="button" onClick={onCuentaAtras} className={`${botonPrincipal} w-full`}>
        Cuenta atrás
      </button>
    )}
    {/* Interruptor: pone o quita la calavera al nominado (y cierra la nominación); pulsado si la lleva */}
    <button
      type="button"
      onClick={onMarca}
      aria-pressed={marcado}
      className={`${botonPrincipal} w-full ${marcado ? 'bg-theme-main text-background' : ''}`}
    >
      Marca
    </button>
    {onDesmarcar && (
      <button type="button" onClick={onDesmarcar} className={`${botonSecundario} w-full`}>
        Desmarcar
      </button>
    )}
    <button type="button" onClick={onCerrar} className={`${botonSecundario} w-full`}>
      Cerrar
    </button>
  </div>
);

/**
 * Los votos que hacen falta, con − y + para cambiarlos y un botón para volver a
 * los de por defecto. Los botones no desaparecen (no se pierde el foco): si no
 * hacen nada, van desactivados. El cambio se anuncia a todos (avisosSala).
 */
const VotosNecesarios = ({ necesarios, porDefecto, maximo, onCambiar }: VotosNominacion) => {
  const cambiar = (votos: number) => onCambiar(votos === porDefecto ? null : votos);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Un voto menos"
          aria-disabled={necesarios <= 1}
          onClick={() => necesarios > 1 && cambiar(necesarios - 1)}
          className={`${botonSecundario} px-2 py-1 aria-disabled:opacity-40`}
        >
          <Minus size={16} />
        </button>
        <p className="min-w-36 text-center font-semibold">{hacenFalta(necesarios)}</p>
        <button
          type="button"
          aria-label="Un voto más"
          aria-disabled={necesarios >= maximo}
          onClick={() => necesarios < maximo && cambiar(necesarios + 1)}
          className={`${botonSecundario} px-2 py-1 aria-disabled:opacity-40`}
        >
          <Plus size={16} />
        </button>
      </div>
      <button
        type="button"
        aria-disabled={necesarios === porDefecto}
        onClick={() => necesarios !== porDefecto && onCambiar(null)}
        className="text-xs text-on-surface-muted underline aria-disabled:no-underline aria-disabled:opacity-60"
      >
        Por defecto: {porDefecto}
      </button>
    </div>
  );
};

export default PanelNominacion;
