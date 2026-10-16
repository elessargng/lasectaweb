import { useState } from 'react';
import { createPortal } from 'react-dom';
import Dialog from '../components/Dialog';
import { botonPrincipal, botonSecundario } from './estilos';

interface DialogoBootleggerProps {
  /** Las reglas de ahora (las del guion o las que se escribieron). */
  reglas: string[];
  /** Guarda las reglas (vacío: ninguna); devuelve si salió bien. */
  onGuardar: (reglas: string[]) => Promise<boolean>;
  onCerrar: () => void;
}

/**
 * Las reglas propias del guion (Bootlegger), para el narrador: las que trae el
 * JSON del guion, para cambiarlas, o en blanco para escribirlas. Una regla por
 * línea; todos las ven en la tarjeta del Bootlegger.
 */
const DialogoBootlegger = ({ reglas, onGuardar, onCerrar }: DialogoBootleggerProps) => {
  const [texto, setTexto] = useState(reglas.join('\n'));
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    const ok = await onGuardar(
      texto
        .split('\n')
        .map((r) => r.trim())
        .filter(Boolean),
    );
    setGuardando(false);
    if (ok) onCerrar();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
      <Dialog
        onClose={onCerrar}
        labelledBy="sala-bootlegger-titulo"
        className="flex w-full max-w-lg flex-col gap-3 rounded border border-outline-ghost bg-surface p-6 shadow-2xl"
      >
        <h2 id="sala-bootlegger-titulo" className="text-xl font-semibold">
          Reglas del Bootlegger
        </h2>
        <label htmlFor="sala-bootlegger-reglas" className="text-sm text-on-surface-muted">
          Una regla por línea. Todos las verán en la tarjeta del Bootlegger.
        </label>
        <textarea
          id="sala-bootlegger-reglas"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={6}
          maxLength={6000}
          className="w-full rounded border border-outline-ghost bg-background p-2 text-sm text-on-surface focus:border-theme-main focus:outline-none"
        />
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onCerrar} className={botonSecundario}>
            Cancelar
          </button>
          <button type="button" onClick={() => void guardar()} aria-disabled={guardando} className={botonPrincipal}>
            Guardar
          </button>
        </div>
      </Dialog>
    </div>,
    document.body,
  );
};

export default DialogoBootlegger;
