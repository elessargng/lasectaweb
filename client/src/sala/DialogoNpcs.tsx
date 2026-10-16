import { useState } from 'react';
import { createPortal } from 'react-dom';
import Dialog from '../components/Dialog';
import { useAriaLive } from './avisosConfig';
import { botonSecundario } from './estilos';
import type { PersonajeMostrado } from './guiones';
import RejillaFichas from './RejillaFichas';
import type { SalaResultado } from './useSala';

interface DialogoNpcsProps {
  /** Los NPCs en juego (ids). */
  npcs: string[];
  /** Los legendarios y lóricos que se pueden poner. */
  disponibles: PersonajeMostrado[];
  pedir: (accion: string, datos?: unknown) => Promise<SalaResultado>;
  onCerrar: () => void;
}

/**
 * Poner NPCs en la partida (narradores), con las fichas de la bolsa: los
 * legendarios y los lóricos (los del guion y todos los del catálogo). Pulsar uno
 * lo pone en juego o lo quita (pulsado: en juego).
 */
const DialogoNpcs = ({ npcs, disponibles, pedir, onCerrar }: DialogoNpcsProps) => {
  const [error, setError] = useState('');
  const ariaLiveErrores = useAriaLive('errores');

  const alternar = async (p: PersonajeMostrado) => {
    setError('');
    const r = await pedir('narrador:npc', { personajeId: p.id });
    if (!r.ok) setError(r.error);
  };

  const grupos = [
    { tipo: 'fabled', titulo: 'Legendarios', color: 'text-theme-main' },
    { tipo: 'loric', titulo: 'Lóricos', color: 'text-theme-main' },
  ].map((g) => ({ ...g, personajes: disponibles.filter((p) => p.tipo === g.tipo) }));

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sala-velo">
      <Dialog
        onClose={onCerrar}
        labelledBy="sala-dialogo-npcs-titulo"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col sala-cofre sala-cofre-esquinas"
      >
        <h2 id="sala-dialogo-npcs-titulo" className="px-6 py-4 sala-cofre-titulo">
          Añadir NPCs
        </h2>
        <div className="overflow-y-auto px-6 py-4">
          {disponibles.length === 0 ? (
            <p className="text-on-surface-muted">No hay legendarios ni lóricos en el catálogo todavía.</p>
          ) : (
            <RejillaFichas
              idBase="sala-dialogo-npcs"
              grupos={grupos}
              marca={(p) => ({ pulsada: npcs.includes(p.id) })}
              onPulsar={(p) => void alternar(p)}
            />
          )}
        </div>
        <div aria-live={ariaLiveErrores} className="px-6">
          {error && <p className="pb-3 text-sm text-blood-pale">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-3 sala-cofre-pie px-6 py-3">
          <p className="mr-auto text-sm text-on-surface-muted">
            En juego: <span className="tabular-nums">{npcs.length}</span>
          </p>
          <button type="button" onClick={onCerrar} className={botonSecundario}>
            Cerrar
          </button>
        </div>
      </Dialog>
    </div>,
    document.body,
  );
};

export default DialogoNpcs;
