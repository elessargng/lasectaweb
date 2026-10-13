import { botonPrincipal, botonSecundario } from './estilos';
import { ID_CUENTA_ATRAS } from './ids';

interface PanelNominacionProps {
  /** El nominado lleva ya la calavera. */
  marcado: boolean;
  /** Se puede arrancar la cuenta atrás (no, si ya se está votando o se ha votado). */
  puedeCuentaAtras: boolean;
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
  marcaActual,
  onDesmarcar,
  onCuentaAtras,
  onMarca,
  onCerrar,
}: PanelNominacionProps) => (
  <div role="group" aria-label="Nominación" className="flex flex-col gap-2">
    {marcaActual && <p className="max-w-56 text-center text-sm text-on-surface-muted">Marca actual: {marcaActual}</p>}
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

export default PanelNominacion;
