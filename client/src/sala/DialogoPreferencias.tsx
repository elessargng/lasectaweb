import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import Dialog from '../components/Dialog';
import { botonSecundario } from './estilos';

export interface Pestana {
  id: string;
  etiqueta: string;
  contenido: ReactNode;
  /** El panel tiene controles: no necesita su propia parada de tabulador. */
  conControles?: boolean;
}

interface DialogoPreferenciasProps {
  /** Las pestañas que tocan (quien abre decide cuáles, p. ej. Partida solo para narradores). */
  pestanas: Pestana[];
  onCerrar: () => void;
}

const SIGUIENTE: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

/**
 * Preferencias de la sala, en pestañas (patrón de pestañas ARIA): Tab entra en
 * la pestaña activa y de ahí al panel; entre pestañas se pasa con las flechas
 * (arriba/abajo o izquierda/derecha), Inicio y Fin. Cambiar de pestaña la activa.
 */
const DialogoPreferencias = ({ pestanas, onCerrar }: DialogoPreferenciasProps) => {
  const [elegida, setElegida] = useState(pestanas[0]?.id);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  // Si la elegida deja de estar (Partida al dejar de narrar), se vuelve a la primera.
  const activa = pestanas.find((p) => p.id === elegida) ?? pestanas[0];

  const irA = (indice: number) => {
    const destino = pestanas[(indice + pestanas.length) % pestanas.length];
    setElegida(destino.id);
    refs.current[destino.id]?.focus();
  };

  const alPulsarTecla = (e: KeyboardEvent) => {
    const actual = pestanas.indexOf(activa);
    if (e.key in SIGUIENTE) irA(actual + SIGUIENTE[e.key]);
    else if (e.key === 'Home') irA(0);
    else if (e.key === 'End') irA(pestanas.length - 1);
    else return;
    e.preventDefault();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sala-velo">
      <Dialog
        onClose={onCerrar}
        labelledBy="sala-preferencias-titulo"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col sala-cofre sala-cofre-esquinas"
      >
        <h2 id="sala-preferencias-titulo" className="px-6 py-4 sala-cofre-titulo">
          Preferencias
        </h2>

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <div
            role="tablist"
            aria-labelledby="sala-preferencias-titulo"
            aria-orientation="vertical"
            className="flex shrink-0 gap-1 overflow-x-auto border-b border-outline-ghost p-2 sm:w-48 sm:flex-col sm:border-b-0 sm:border-r"
          >
            {pestanas.map((p) => {
              const seleccionada = p.id === activa.id;
              return (
                <button
                  key={p.id}
                  ref={(el) => {
                    refs.current[p.id] = el;
                  }}
                  id={`sala-pref-tab-${p.id}`}
                  type="button"
                  role="tab"
                  aria-selected={seleccionada}
                  aria-controls={`sala-pref-panel-${p.id}`}
                  tabIndex={seleccionada ? 0 : -1}
                  onClick={() => setElegida(p.id)}
                  onKeyDown={alPulsarTecla}
                  className={`whitespace-nowrap rounded px-3 py-2 text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main ${
                    seleccionada ? 'bg-theme-container font-semibold text-gold-bright shadow-[inset_2px_0_0_var(--color-theme-main)]' : 'text-on-surface hover:bg-grimorio/25'
                  }`}
                >
                  {p.etiqueta}
                </button>
              );
            })}
          </div>

          {pestanas.map((p) => (
            <div
              key={p.id}
              id={`sala-pref-panel-${p.id}`}
              role="tabpanel"
              aria-labelledby={`sala-pref-tab-${p.id}`}
              hidden={p.id !== activa.id}
              tabIndex={p.conControles ? undefined : 0}
              className="min-h-64 flex-1 overflow-y-auto p-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-theme-main"
            >
              {p.contenido}
            </div>
          ))}
        </div>

        <div className="flex justify-end sala-cofre-pie px-6 py-3">
          <button type="button" onClick={onCerrar} className={botonSecundario}>
            Cerrar
          </button>
        </div>
      </Dialog>
    </div>
  );
};

export default DialogoPreferencias;
