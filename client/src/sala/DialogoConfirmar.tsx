import { useState, type ReactNode } from 'react';
import Dialog from '../components/Dialog';
import { useAriaLive } from './avisosConfig';
import { botonPrincipal, botonSecundario } from './estilos';
import type { SalaResultado } from './useSala';

interface DialogoConfirmarProps {
  /** Título del diálogo («Limpiar grimorio»). */
  titulo: string;
  /** Texto del botón que confirma. */
  confirmar: string;
  /** Qué va a pasar. */
  children: ReactNode;
  onConfirmar: () => Promise<SalaResultado>;
  onCerrar: () => void;
}

/**
 * Confirmar una acción del narrador que no se puede deshacer: qué va a pasar,
 * «Cancelar» (primero, lo seguro) y confirmar. Al abrirse, el foco va al diálogo
 * (se lee su título). Se cierra al hacerlo y el aviso de la sala confirma el cambio.
 */
const DialogoConfirmar = ({ titulo, confirmar, children, onConfirmar, onCerrar }: DialogoConfirmarProps) => {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const ariaLive = useAriaLive('errores');

  const aceptar = async () => {
    if (enviando) return;
    setEnviando(true);
    setError('');
    const r = await onConfirmar();
    if (r.ok) {
      onCerrar();
      return;
    }
    setError(r.error);
    setEnviando(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
      <Dialog
        onClose={onCerrar}
        labelledBy="sala-confirmar-titulo"
        className="w-full max-w-sm rounded border border-outline-ghost bg-surface p-6 shadow-2xl"
      >
        <h2 id="sala-confirmar-titulo" className="mb-4 text-xl font-semibold">
          {titulo}
        </h2>
        <p className="mb-4 text-sm text-on-surface-muted">
          {children}
        </p>
        <div aria-live={ariaLive}>{error && <p className="mb-4 text-sm text-red-400">{error}</p>}</div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onCerrar} className={botonSecundario}>
            Cancelar
          </button>
          <button type="button" onClick={aceptar} aria-disabled={enviando} className={botonPrincipal}>
            {confirmar}
          </button>
        </div>
      </Dialog>
    </div>
  );
};

export default DialogoConfirmar;
