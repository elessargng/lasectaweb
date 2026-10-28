import Dialog from '../components/Dialog';
import { botonPrincipal, botonSecundario } from './estilos';

interface DialogoRegistroEspiaProps {
  /** Quien nomina (el Espía) y la nominada (la Virgen): «asiento 3 (Bea)». */
  nomina: string;
  nominado: string;
  onResponder: (comoAldeano: boolean) => void;
  /** No nominar (Escape). */
  onCancelar: () => void;
}

/**
 * El Espía (sano) nomina a la Virgen: el narrador dice si registra como aldeano
 * antes de que se nomine, así nadie ve nada distinto de lo que vería con un
 * aldeano o con cualquier otro. Al abrirse se lee el título y la explicación.
 */
const DialogoRegistroEspia = ({ nomina, nominado, onResponder, onCancelar }: DialogoRegistroEspiaProps) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sala-velo">
    <Dialog
      onClose={onCancelar}
      labelledBy="sala-registro-espia-titulo"
      describedBy="sala-registro-espia-texto"
      className="flex max-h-[90vh] w-full max-w-md flex-col gap-4 overflow-y-auto sala-cofre sala-cofre-esquinas p-6"
    >
      <h2 id="sala-registro-espia-titulo" className="sala-cofre-titulo">
        ¿El Espía registra como aldeano?
      </h2>
      <p id="sala-registro-espia-texto" className="text-sm text-on-surface-muted">
        El Espía ({nomina}) nomina a la Virgen ({nominado}). Si registra como aldeano, se le ejecuta al momento; si no, la
        Virgen pierde su habilidad y la nominación sigue.
      </p>
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={() => onResponder(true)} className={botonPrincipal}>
          Registra como aldeano
        </button>
        <button type="button" onClick={() => onResponder(false)} className={botonSecundario}>
          No registra
        </button>
        <button type="button" onClick={onCancelar} className={botonSecundario}>
          Cancelar
        </button>
      </div>
    </Dialog>
  </div>
);

export default DialogoRegistroEspia;
