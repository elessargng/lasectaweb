import { useState } from 'react';
import { createPortal } from 'react-dom';
import Dialog from '../components/Dialog';
import { useAriaLive } from './avisosConfig';
import { botonSecundario } from './estilos';
import type { SalaAlineamiento, SalaResultado } from './useSala';

interface DialogoRevelarProps {
  pedir: (accion: string, datos?: unknown) => Promise<SalaResultado>;
  onCerrar: () => void;
}

/**
 * Revelar el grimorio (final de la partida): primero, qué bando ha ganado. Al
 * elegirlo, todas las fichas se dan la vuelta y el narrador las va revelando.
 */
const DialogoRevelar = ({ pedir, onCerrar }: DialogoRevelarProps) => {
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const ariaLive = useAriaLive('errores');

  const elegir = async (ganador: SalaAlineamiento) => {
    if (enviando) return;
    setEnviando(true);
    setError('');
    const r = await pedir('narrador:revelarGrimorio', { ganador });
    setEnviando(false);
    if (r.ok) onCerrar();
    else setError(r.error);
  };

  const bando = 'flex-1 rounded border-2 px-4 py-6 text-lg font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-white';
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sala-velo">
      <Dialog
        onClose={onCerrar}
        labelledBy="sala-revelar-titulo"
        className="w-full max-w-md sala-cofre sala-cofre-esquinas p-6"
      >
        <h2 id="sala-revelar-titulo" className="mb-2 sala-cofre-titulo">
          Revelar grimorio
        </h2>
        <p className="mb-4 text-sm text-on-surface-muted">
          ¿Qué bando ha ganado? Todas las fichas se darán la vuelta y las irás revelando una a una.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => void elegir('bueno')}
            aria-disabled={enviando}
            className={`${bando} border-good bg-good/20 text-good-bright hover:bg-good/35`}
          >
            Bando bueno
          </button>
          <button
            type="button"
            onClick={() => void elegir('malvado')}
            aria-disabled={enviando}
            className={`${bando} border-blood-bright bg-blood-deep/60 text-blood-pale hover:bg-blood-deep`}
          >
            Bando malvado
          </button>
        </div>
        <div aria-live={ariaLive}>{error && <p className="mt-4 text-sm text-blood-pale">{error}</p>}</div>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onCerrar} className={botonSecundario}>
            Cancelar
          </button>
        </div>
      </Dialog>
    </div>,
    document.body,
  );
};

export default DialogoRevelar;
