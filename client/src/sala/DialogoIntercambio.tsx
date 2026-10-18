import { createPortal } from 'react-dom';
import Dialog from '../components/Dialog';
import { botonSecundario } from './estilos';
import type { PersonajeMostrado } from './guiones';

interface DialogoIntercambioProps {
  /** «asiento 3 (Ana)», la ficha que se intercambia. */
  ficha: string;
  /** Las demás fichas: su asiento y su personaje (si tiene). */
  otras: { asientoId: string; nombre: string; personaje: PersonajeMostrado | undefined }[];
  onElegir: (asientoId: string) => void;
  onCerrar: () => void;
}

/**
 * Con el Gardener: con qué otra ficha se intercambia el personaje (lo mismo que
 * arrastrar una sobre otra, para el teclado y el lector). Elegir una lo hace y
 * cierra el diálogo.
 */
const DialogoIntercambio = ({ ficha, otras, onElegir, onCerrar }: DialogoIntercambioProps) =>
  createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sala-velo">
      <Dialog onClose={onCerrar} labelledBy="sala-intercambio-titulo" className="flex max-h-[90vh] w-full max-w-md flex-col sala-cofre sala-cofre-esquinas">
        <h2 id="sala-intercambio-titulo" className="px-6 py-4 sala-cofre-titulo">
          Intercambiar con… <span className="font-ui text-base font-normal text-on-surface-muted">({ficha})</span>
        </h2>
        <ul className="flex flex-col gap-1 overflow-y-auto px-6 pb-4">
          {otras.map((o) => (
            <li key={o.asientoId}>
              <button
                type="button"
                onClick={() => {
                  onElegir(o.asientoId);
                  onCerrar();
                }}
                className="sala-opcion flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left"
              >
                <span>{o.nombre}</span>
                {o.personaje ? (
                  <span lang={o.personaje.nombre.lang} className="text-sm text-on-surface-muted">
                    {o.personaje.nombre.texto}
                  </span>
                ) : (
                  <span className="text-sm text-on-surface-muted">sin personaje</span>
                )}
              </button>
            </li>
          ))}
        </ul>
        <div className="flex justify-end sala-cofre-pie px-6 py-3">
          <button type="button" onClick={onCerrar} className={botonSecundario}>
            Cancelar
          </button>
        </div>
      </Dialog>
    </div>,
    document.body,
  );

export default DialogoIntercambio;
