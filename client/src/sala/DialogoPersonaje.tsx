import { useState } from 'react';
import { createPortal } from 'react-dom';
import Dialog from '../components/Dialog';
import { urlDelServidor } from '../utils/api';
import { botonSecundario } from './estilos';
import { gruposViajeros, iconoDe } from './fichas';
import { porTipos, type PersonajeMostrado } from './guiones';
import PestanasDialogo from './PestanasDialogo';

interface DialogoPersonajeProps {
  /** «Ficha del asiento 3 (Ana)». */
  ficha: string;
  /** El título del diálogo (por defecto, «Cambiar ficha»). */
  titulo?: string;
  personajes: PersonajeMostrado[];
  /**
   * Todos los viajeros (los del guion primero, luego los demás del catálogo):
   * con ellos, el diálogo tiene dos pestañas, Guion (sin viajeros) y Viajeros.
   * Sin ellos, una sola lista con lo que llegue en `personajes`.
   */
  viajeros?: PersonajeMostrado[];
  /** El que lleva ahora, o null. */
  actual: string | null;
  onElegir: (personajeId: string | null) => void;
  onCerrar: () => void;
}

/**
 * Elegir el personaje de una ficha, por tipos, cada uno con su icono y su nombre;
 * el actual va marcado (aria-pressed). Elegir uno cierra el diálogo. También se
 * puede dejar la ficha sin personaje.
 *
 * Con `viajeros`, en dos pestañas: Guion (aldeanos, forasteros, esbirros y
 * demonios del guion) y Viajeros (todos, no solo los del guion: primero los del
 * guion y luego los demás). Se abre en la del personaje que lleva.
 */
const DialogoPersonaje = ({ ficha, titulo = 'Cambiar ficha', personajes, viajeros, actual, onElegir, onCerrar }: DialogoPersonajeProps) => {
  const conPestanas = !!viajeros;
  const [pestana, setPestana] = useState(() => (viajeros?.some((p) => p.id === actual) ? 'viajeros' : 'guion'));

  const elegir = (id: string | null) => {
    onElegir(id);
    onCerrar();
  };

  const grupos = !conPestanas
    ? porTipos(personajes)
    : pestana === 'viajeros'
      ? gruposViajeros(viajeros, personajes).map(({ titulo: t, personajes: ps }) => ({ titulo: t, personajes: ps }))
      : porTipos(personajes.filter((p) => p.tipo !== 'traveller'));

  const lista =
    grupos.length === 0 ? (
      <p className="text-on-surface-muted">
        {pestana === 'viajeros' ? 'No hay viajeros en el catálogo todavía.' : 'El guion no tiene personajes que se puedan poner en una ficha.'}
      </p>
    ) : (
      <div className="flex flex-col gap-5">
        {grupos.map(({ titulo: t, personajes: grupo }) => (
          <section key={t} aria-labelledby={`sala-personaje-${t}`}>
            <h3 id={`sala-personaje-${t}`} className="rotulo mb-2">
              {t}
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
    );

  // En el body: la ficha está en una capa con transform, y dentro de ella «fixed»
  // no sería la pantalla (saldría pequeño y tapado por las fichas).
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sala-velo">
      <Dialog
        onClose={onCerrar}
        labelledBy="sala-personaje-titulo"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col sala-cofre sala-cofre-esquinas"
      >
        <h2
          id="sala-personaje-titulo"
          className="px-6 py-4 sala-cofre-titulo"
        >
          {titulo} <span className="font-ui text-base text-on-surface-muted">({ficha})</span>
        </h2>
        {conPestanas ? (
          <PestanasDialogo
            idBase="sala-personaje"
            etiqueta="Personajes"
            pestanas={[
              { id: 'guion', etiqueta: 'Guion' },
              { id: 'viajeros', etiqueta: 'Viajeros' },
            ]}
            activa={pestana}
            onElegir={setPestana}
          >
            <div className="overflow-y-auto px-6 py-4">{lista}</div>
          </PestanasDialogo>
        ) : (
          <div className="overflow-y-auto px-6 py-4">{lista}</div>
        )}
        <div className="flex flex-wrap justify-end gap-3 sala-cofre-pie px-6 py-3">
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
