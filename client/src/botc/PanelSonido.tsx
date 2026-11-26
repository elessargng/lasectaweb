import { Volume2 } from 'lucide-react';
import Interruptor from './Interruptor';
import { botonIcono, campo } from './estilos';
import type { PreferenciasSala } from './preferencias';
import { esTonoDespertar, esTonoLlamada, probarSonido, SONIDOS, TONOS_DESPERTAR, TONOS_LLAMADA, type IdSonido } from './sonidos';

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
              {id === 'solicitudLlamada' && (
                // El tono: al elegirlo, suena (así se sabe cómo es sin buscar el altavoz)
                <div className="ml-12 mt-2 flex flex-col gap-1">
                  <label htmlFor="sala-pref-tono-llamada" className="text-xs">
                    Tono de las llamadas entrantes
                  </label>
                  <select
                    id="sala-pref-tono-llamada"
                    value={preferencias.tonoLlamada}
                    onChange={(e) => {
                      if (!esTonoLlamada(e.target.value)) return;
                      onCambiar({ tonoLlamada: e.target.value });
                      probarSonido('solicitudLlamada', e.target.value);
                    }}
                    className={`${campo} max-w-xs text-sm`}
                  >
                    {TONOS_LLAMADA.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {id === 'despertar' && (
                // Como el de las llamadas: al elegirlo, suena
                <div className="ml-12 mt-2 flex flex-col gap-1">
                  <label htmlFor="sala-pref-tono-despertar" className="text-xs">
                    Tono del despertar
                  </label>
                  <select
                    id="sala-pref-tono-despertar"
                    value={preferencias.tonoDespertar}
                    onChange={(e) => {
                      if (!esTonoDespertar(e.target.value)) return;
                      onCambiar({ tonoDespertar: e.target.value });
                      probarSonido('despertar', e.target.value);
                    }}
                    className={`${campo} max-w-xs text-sm`}
                  >
                    {TONOS_DESPERTAR.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}
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
