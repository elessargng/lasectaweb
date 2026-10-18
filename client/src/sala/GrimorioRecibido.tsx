import { Copy, X } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import Dialog from '../components/Dialog';
import MiniGrimorio from './MiniGrimorio';
import { botonIcono, botonPrincipal } from './estilos';
import type { SalaGrimorioEnviado } from './useSala';

interface GrimorioRecibidoProps {
  grimorio: SalaGrimorioEnviado;
  nombres: Record<string, string>;
  /** Con grimorio propio: copia los personajes y los recordatorios en él. Sin esto, no sale. */
  onCopiar?: () => void;
  onCerrar: () => void;
}

/**
 * El grimorio que el narrador ha enviado al Espía o a la Viuda: el minigrimorio,
 * solo para ver (y la hora a la que llegó). Con el grimorio de los jugadores
 * activado, «Copiar a mi grimorio» pone sus personajes y recordatorios en el
 * grimorio propio (sustituye lo anotado en cada ficha).
 */
const GrimorioRecibido = ({ grimorio, nombres, onCopiar, onCerrar }: GrimorioRecibidoProps) => {
  const [copiado, setCopiado] = useState(false);
  const hora = new Date(grimorio.hora).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sala-velo">
      <Dialog
        onClose={onCerrar}
        labelledBy="sala-grimorio-recibido-titulo"
        className="flex max-h-[94vh] w-full max-w-2xl flex-col sala-cofre sala-cofre-esquinas"
      >
        <div className="flex items-center gap-3 px-6 pt-4">
          <h2 id="sala-grimorio-recibido-titulo" className="flex-1 sala-cofre-titulo">
            El grimorio del narrador
          </h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className={`${botonIcono} h-8 w-8 shrink-0`}>
            <X size={16} />
          </button>
        </div>
        <p className="px-6 pb-2 pt-1 text-sm text-on-surface-muted">Te lo ha enviado a las {hora}.</p>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-2">
          <MiniGrimorio fichas={grimorio.fichas} faroles={grimorio.faroles ?? []} nombres={nombres} />
        </div>
        {onCopiar && (
          <div className="flex flex-wrap items-center justify-end gap-3 sala-cofre-pie px-6 py-3">
            <p aria-live="polite" className="mr-auto text-sm text-on-surface-muted">
              {copiado ? 'Copiado en tu grimorio.' : ''}
            </p>
            <button
              type="button"
              onClick={() => {
                onCopiar();
                setCopiado(true);
              }}
              className={botonPrincipal}
            >
              <Copy size={16} />
              Copiar a mi grimorio
            </button>
          </div>
        )}
      </Dialog>
    </div>,
    document.body,
  );
};

export default GrimorioRecibido;
