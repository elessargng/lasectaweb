import type { KeyboardEvent, ReactNode } from 'react';

export interface PestanaDialogo {
  id: string;
  etiqueta: string;
  /** Un número junto al nombre (los que hay metidos…), si es más de 0. */
  contador?: { valor: number; texto: string };
}

interface PestanasDialogoProps {
  /** Prefijo de los ids (uno por diálogo). */
  idBase: string;
  /** Lo que agrupan («Personajes»), para el lector. */
  etiqueta: string;
  pestanas: PestanaDialogo[];
  activa: string;
  onElegir: (id: string) => void;
  /** El contenido de la pestaña activa. */
  children: ReactNode;
}

/**
 * Pestañas dentro de un diálogo (Guion | Viajeros), como manda ARIA: las flechas
 * izquierda y derecha van de una a otra (e Inicio y Fin), y Tab entra en su
 * contenido. Solo se pinta el de la activa.
 */
const PestanasDialogo = ({ idBase, etiqueta, pestanas, activa, onElegir, children }: PestanasDialogoProps) => {
  const idPestana = (id: string) => `${idBase}-pestana-${id}`;
  const alTeclear = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = pestanas.findIndex((p) => p.id === activa);
    const n = pestanas.length;
    const destinos: Record<string, number> = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 };
    if (!(e.key in destinos)) return;
    e.preventDefault();
    const destino = pestanas[destinos[e.key]].id;
    onElegir(destino);
    window.setTimeout(() => document.getElementById(idPestana(destino))?.focus(), 0);
  };

  return (
    <>
      <div role="tablist" aria-label={etiqueta} className="flex gap-1 border-b border-outline-ghost px-6">
        {pestanas.map(({ id, etiqueta: texto, contador }) => {
          const elegida = id === activa;
          return (
            <button
              key={id}
              id={idPestana(id)}
              type="button"
              role="tab"
              aria-selected={elegida}
              aria-controls={`${idBase}-panel`}
              tabIndex={elegida ? 0 : -1}
              onClick={() => onElegir(id)}
              onKeyDown={alTeclear}
              className={`-mb-px border-b-2 px-3 py-2 font-ui text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main motion-reduce:transition-none ${
                elegida ? 'border-theme-main text-on-surface-bright' : 'border-transparent text-on-surface-muted hover:text-on-surface'
              }`}
            >
              {texto}
              {contador && contador.valor > 0 && (
                <span className="ml-1.5 rounded-full bg-theme-main px-1.5 text-[0.65rem] font-bold text-background">
                  <span className="sr-only">, </span>
                  {contador.valor}
                  <span className="sr-only"> {contador.texto}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div id={`${idBase}-panel`} role="tabpanel" aria-labelledby={idPestana(activa)} className="flex min-h-0 flex-1 flex-col">
        {children}
      </div>
    </>
  );
};

export default PestanasDialogo;
