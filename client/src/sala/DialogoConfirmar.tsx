import { useState, type ReactNode } from 'react';
import Dialog from '../components/Dialog';
import { useAriaLive } from './avisosConfig';
import { botonPeligro, botonSecundario } from './estilos';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sala-velo">
      <Dialog
        onClose={onCerrar}
        labelledBy="sala-confirmar-titulo"
        className="w-full max-w-sm sala-cofre sala-cofre-esquinas p-6"
      >
        <h2 id="sala-confirmar-titulo" className="mb-4 sala-cofre-titulo">
          {titulo}
        </h2>
        <p className="mb-4 text-sm text-on-surface-muted">
          {children}
        </p>
        <div aria-live={ariaLive}>{error && <p className="mb-4 text-sm text-blood-pale">{error}</p>}</div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onCerrar} className={botonSecundario}>
            Cancelar
          </button>
          <button type="button" onClick={aceptar} aria-disabled={enviando} className={botonPeligro}>
            {confirmar}
          </button>
        </div>
      </Dialog>
    </div>
  );
};

export default DialogoConfirmar;
