import { createPortal } from 'react-dom';
import Dialog from '../components/Dialog';
import { urlDelServidor } from '../utils/api';
import { botonSecundario } from './estilos';
import { iconoDe } from './fichas';
import { porTipos, type PersonajeMostrado } from './guiones';

interface DialogoPersonajeProps {
  /** «Ficha del asiento 3 (Ana)». */
  ficha: string;
  personajes: PersonajeMostrado[];
  /** El que lleva ahora, o null. */
  actual: string | null;
  onElegir: (personajeId: string | null) => void;
  onCerrar: () => void;
}

/**
 * Elegir el personaje de una ficha entre los del guion, por tipos (aldeanos,
 * forasteros, esbirros, demonios y viajeros), cada uno con su icono y su nombre;
 * el actual va marcado (aria-pressed). Elegir uno cierra el diálogo. También se
 * puede dejar la ficha sin personaje.
 */
const DialogoPersonaje = ({ ficha, personajes, actual, onElegir, onCerrar }: DialogoPersonajeProps) => {
  const elegir = (id: string | null) => {
    onElegir(id);
    onCerrar();
  };

  // En el body: la ficha está en una capa con transform, y dentro de ella «fixed»
  // no sería la pantalla (saldría pequeño y tapado por las fichas).
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
      <Dialog
        onClose={onCerrar}
        labelledBy="sala-personaje-titulo"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded border border-outline-ghost bg-surface shadow-2xl"
      >
        <h2 id="sala-personaje-titulo" className="border-b border-outline-ghost px-6 py-4 text-xl font-semibold">
          Cambiar ficha <span className="font-normal text-on-surface-muted">({ficha})</span>
        </h2>
        <div className="overflow-y-auto px-6 py-4">
          {personajes.length === 0 ? (
            <p className="text-on-surface-muted">El guion no tiene personajes que se puedan poner en una ficha.</p>
          ) : (
            <div className="flex flex-col gap-5">
              {porTipos(personajes).map(({ titulo, personajes: grupo }) => (
                <section key={titulo} aria-labelledby={`sala-personaje-${titulo}`}>
                  <h3 id={`sala-personaje-${titulo}`} className="mb-2 text-sm font-semibold uppercase tracking-wide text-theme-main">
                    {titulo}
                  </h3>
                  <ul className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2">
                    {grupo.map((p) => {
                      const icono = iconoDe(p, null);
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            aria-pressed={actual === p.id}
                            onClick={() => elegir(p.id)}
                            className="flex w-full flex-col items-center gap-1 rounded border border-transparent p-2 text-center text-sm hover:border-theme-main/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main aria-pressed:border-theme-main aria-pressed:bg-theme-container"
                          >
                            {icono ? (
                              <img src={urlDelServidor(icono)} alt="" className="h-14 w-14 object-contain" loading="lazy" />
                            ) : (
                              <span aria-hidden="true" className="h-14 w-14 rounded-full border border-outline-ghost" />
                            )}
                            <span lang={p.nombre.lang}>{p.nombre.texto}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-3 border-t border-outline-ghost px-6 py-3">
          <button
            type="button"
            aria-pressed={actual === null}
            onClick={() => elegir(null)}
            className={`${botonSecundario} aria-pressed:opacity-60`}
          >
            Sin personaje
          </button>
          <button type="button" onClick={onCerrar} className={botonSecundario}>
            Cancelar
          </button>
        </div>
      </Dialog>
    </div>,
    document.body,
  );
};

export default DialogoPersonaje;
