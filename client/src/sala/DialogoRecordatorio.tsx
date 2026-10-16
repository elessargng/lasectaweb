import { useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import Dialog from '../components/Dialog';
import { botonSecundario } from './estilos';
import FichaRecordatorio from './FichaRecordatorio';
import { porTipos, type PersonajeMostrado } from './guiones';

interface DialogoRecordatorioProps {
  /** «asiento 3 (Ana)». */
  ficha: string;
  /** Los personajes en juego (en alguna ficha) y los demás del guion. */
  enJuego: PersonajeMostrado[];
  otros: PersonajeMostrado[];
  onElegir: (personaje: PersonajeMostrado, indice: number) => void;
  onCerrar: () => void;
}

type Pestana = 'enJuego' | 'otros';
const PESTANAS: { id: Pestana; etiqueta: string }[] = [
  { id: 'enJuego', etiqueta: 'En juego' },
  { id: 'otros', etiqueta: 'Otros personajes' },
];

/** Lado de las fichas recordatorio en el diálogo (fijo: no depende de la mesa). */
const TAMANO = '4.5rem';

/**
 * Elegir una ficha recordatorio para poner junto a una ficha: de entrada, los
 * recordatorios de los personajes en juego; en la otra pestaña, los del resto
 * del guion. Por personaje (con su nombre de título), cada recordatorio es un
 * botón. Elegir uno lo pone y cierra el diálogo.
 *
 * Pestañas como manda ARIA: las flechas van de una a otra y Tab entra en la lista.
 */
const DialogoRecordatorio = ({ ficha, enJuego, otros, onElegir, onCerrar }: DialogoRecordatorioProps) => {
  const [pestana, setPestana] = useState<Pestana>('enJuego');
  const refs = useRef<Record<Pestana, HTMLButtonElement | null>>({ enJuego: null, otros: null });

  const elegir = (p: PersonajeMostrado, indice: number) => {
    onElegir(p, indice);
    onCerrar();
  };

  const alTeclear = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const destino: Pestana =
      e.key === 'Home' ? 'enJuego' : e.key === 'End' ? 'otros' : pestana === 'enJuego' ? 'otros' : 'enJuego';
    setPestana(destino);
    refs.current[destino]?.focus();
  };

  const lista = (pestana === 'enJuego' ? enJuego : otros).filter((p) => p.recordatorios.length > 0);

  // En el body: la ficha está en una capa con transform, y dentro de ella «fixed» no sería la pantalla.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
      <Dialog
        onClose={onCerrar}
        labelledBy="sala-recordatorio-titulo"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded border border-outline-ghost bg-surface shadow-2xl"
      >
        <h2 id="sala-recordatorio-titulo" className="border-b border-outline-ghost px-6 py-4 text-xl font-semibold">
          Poner recordatorio <span className="font-normal text-on-surface-muted">({ficha})</span>
        </h2>
        <div role="tablist" aria-label="Personajes" className="flex gap-1 border-b border-outline-ghost px-6 py-2">
          {PESTANAS.map((t) => (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[t.id] = el;
              }}
              id={`sala-recordatorio-pestana-${t.id}`}
              type="button"
              role="tab"
              aria-selected={pestana === t.id}
              aria-controls="sala-recordatorio-panel"
              tabIndex={pestana === t.id ? 0 : -1}
              onClick={() => setPestana(t.id)}
              onKeyDown={alTeclear}
              className={`rounded px-3 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main ${
                pestana === t.id ? 'bg-theme-container font-semibold text-white' : 'text-on-surface-muted hover:bg-theme-container/40'
              }`}
            >
              {t.etiqueta}
            </button>
          ))}
        </div>
        <div
          id="sala-recordatorio-panel"
          role="tabpanel"
          aria-labelledby={`sala-recordatorio-pestana-${pestana}`}
          className="overflow-y-auto px-6 py-4"
        >
          {lista.length === 0 ? (
            <p className="text-on-surface-muted">
              {pestana === 'enJuego'
                ? 'Ningún personaje en juego tiene recordatorios. Mira en «Otros personajes».'
                : 'Ningún otro personaje del guion tiene recordatorios.'}
            </p>
          ) : (
            <div className="flex flex-col gap-5">
              {porTipos(lista).map(({ titulo, personajes }) => (
                <section key={titulo} aria-labelledby={`sala-recordatorio-${pestana}-${titulo}`}>
                  <h3
                    id={`sala-recordatorio-${pestana}-${titulo}`}
                    className="mb-2 text-sm font-semibold uppercase tracking-wide text-theme-main"
                  >
                    {titulo}
                  </h3>
                  <ul className="flex flex-col gap-3">
                    {personajes.map((p) => (
                      <li key={p.id}>
                        <h4 lang={p.nombre.lang} className="mb-1 text-sm">
                          {p.nombre.texto}
                        </h4>
                        <ul className="flex flex-wrap gap-2">
                          {p.recordatorios.map((r, i) => (
                            <li key={i}>
                              <button
                                type="button"
                                onClick={() => elegir(p, i)}
                                aria-label={`${r.texto}, ${p.nombre.texto}`}
                                className="block rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main focus-visible:ring-offset-2 focus-visible:ring-offset-surface hover:brightness-125"
                              >
                                <FichaRecordatorio personaje={p} texto={r} tamano={TAMANO} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end border-t border-outline-ghost px-6 py-3">
          <button type="button" onClick={onCerrar} className={botonSecundario}>
            Cancelar
          </button>
        </div>
      </Dialog>
    </div>,
    document.body,
  );
};

export default DialogoRecordatorio;
