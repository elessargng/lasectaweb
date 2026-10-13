import { botonPrincipal, botonSecundario } from './estilos';
import { ID_CUENTA_ATRAS } from './ids';

interface PanelNominacionProps {
  /** El nominado lleva ya la calavera. */
  marcado: boolean;
  /** Se puede arrancar la cuenta atrás (no, si ya se está votando o se ha votado). */
  puedeCuentaAtras: boolean;
  onCuentaAtras: () => void;
  onMarca: () => void;
  onCerrar: () => void;
}

/** En el centro de la mesa, para el narrador: lo que se puede hacer con la nominación abierta. */
const PanelNominacion = ({ marcado, puedeCuentaAtras, onCuentaAtras, onMarca, onCerrar }: PanelNominacionProps) => (
  <div role="group" aria-label="Nominación" className="flex flex-col gap-2">
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
    <button type="button" onClick={onCerrar} className={`${botonSecundario} w-full`}>
      Cerrar
    </button>
  </div>
);

export default PanelNominacion;
