import { Volume2 } from 'lucide-react';
import Interruptor from './Interruptor';
import { botonIcono } from './estilos';
import type { PreferenciasSala } from './preferencias';
import { probarSonido, SONIDOS, type IdSonido } from './sonidos';

interface PanelSonidoProps {
  preferencias: PreferenciasSala;
  onCambiar: (cambios: Partial<PreferenciasSala>) => void;
}

/**
 * Pestaña Sonido: cada sonido de la sala, con un interruptor para quitarlo o
 * ponerlo y un botón para escucharlo (suena aunque esté quitado). Se aplica al
 * momento; con cuenta se guarda en el servidor.
 */
const PanelSonido = ({ preferencias, onCambiar }: PanelSonidoProps) => {
  const cambiar = (id: IdSonido, activo: boolean) => onCambiar({ sonidos: { ...preferencias.sonidos, [id]: activo } });
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-on-surface-muted">Elige qué sonidos quieres oír. Con el altavoz, escuchas cómo suena cada uno.</p>
      <ul className="flex flex-col divide-y divide-outline-ghost rounded-[3px] border border-outline-ghost bg-background/40">
        {SONIDOS.map(({ id, nombre, descripcion }) => (
          <li key={id} className="flex items-center gap-3 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <Interruptor id={`sala-pref-sonido-${id}`} activo={preferencias.sonidos[id]} onCambiar={(a) => cambiar(id, a)} describedBy={`sala-pref-sonido-${id}-desc`}>
                {nombre}
              </Interruptor>
              <p id={`sala-pref-sonido-${id}-desc`} className="ml-12 mt-0.5 text-xs text-on-surface-muted">
                {descripcion}
              </p>
            </div>
            <button type="button" onClick={() => probarSonido(id)} aria-label={`Escuchar: ${nombre}`} className={`${botonIcono} h-8 w-8`}>
              <Volume2 size={16} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PanelSonido;
