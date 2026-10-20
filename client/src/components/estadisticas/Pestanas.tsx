import { useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface Pestana {
  id: string;
  titulo: string;
  icono?: ReactNode;
  /** Un dato junto al título («3/11»): visible tal cual y, para el lector, `contadorLector`. */
  contador?: string;
  contadorLector?: string;
  contenido: ReactNode;
}

interface PestanasProps {
  /** Nombre de la lista de pestañas para el lector («Estadísticas»). */
  etiqueta: string;
  pestanas: Pestana[];
  activa: string;
  onCambiar: (id: string) => void;
}

/**
 * Pestañas (patrón ARIA tabs): Tab entra en la pestaña activa y sale al panel;
 * las flechas, Inicio y Fin cambian de pestaña (y la muestran). Solo se pinta el
 * panel de la activa. Los iconos son decorativos.
 */
const Pestanas = ({ etiqueta, pestanas, activa, onCambiar }: PestanasProps) => {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const actual = pestanas.find((p) => p.id === activa) ?? pestanas[0];

  const ir = (i: number) => {
    const p = pestanas[(i + pestanas.length) % pestanas.length];
    onCambiar(p.id);
    refs.current[p.id]?.focus();
  };
  const alPulsar = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const destino =
      e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? pestanas.length - 1 : null;
    if (destino === null) return;
    e.preventDefault();
    ir(destino);
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label={etiqueta}
        className="mb-8 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-gold/20 [scrollbar-width:none]"
      >
        {pestanas.map((p, i) => {
          const seleccionada = p.id === actual.id;
          return (
            <button
              key={p.id}
              ref={(el) => {
                refs.current[p.id] = el;
              }}
              id={`pestana-${p.id}`}
              type="button"
              role="tab"
              aria-selected={seleccionada}
              aria-controls={`panel-${p.id}`}
              tabIndex={seleccionada ? 0 : -1}
              onClick={() => onCambiar(p.id)}
              onKeyDown={(e) => alPulsar(e, i)}
              className={`relative -mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 font-ui text-sm font-semibold uppercase tracking-[0.14em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main motion-reduce:transition-none ${
                seleccionada
                  ? 'border-gold-bright text-gold-bright'
                  : 'border-transparent text-on-surface-muted hover:border-gold/40 hover:text-on-surface'
              }`}
            >
              {p.icono}
              {p.titulo}
              {p.contador && (
                <>
                  <span aria-hidden="true" className="rounded-full bg-gold/15 px-2 py-0.5 text-[0.65rem] tracking-normal text-gold-bright">
                    {p.contador}
                  </span>
                  {p.contadorLector && <span className="sr-only">, {p.contadorLector}</span>}
                </>
              )}
            </button>
          );
        })}
      </div>
      <div
        id={`panel-${actual.id}`}
        role="tabpanel"
        aria-labelledby={`pestana-${actual.id}`}
      >
        {actual.contenido}
      </div>
    </div>
  );
};

export default Pestanas;
