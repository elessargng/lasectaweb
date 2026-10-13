import { botonSecundario } from './estilos';
import { TAMANO_AVATAR, type PreferenciasSala } from './preferencias';

interface PanelInterfazProps {
  preferencias: PreferenciasSala;
  onCambiar: (cambios: Partial<PreferenciasSala>) => void;
}

/**
 * Pestaña Interfaz: cómo ves la sala. Los cambios se aplican al momento y se
 * guardan en este navegador.
 */
const PanelInterfaz = ({ preferencias, onCambiar }: PanelInterfazProps) => {
  const tamano = preferencias.tamanoAvatar;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="sala-pref-tamano" className="text-sm text-on-surface-muted">
          Tamaño de los avatares
        </label>
        <div className="flex items-center gap-4">
          <input
            id="sala-pref-tamano"
            type="range"
            min={TAMANO_AVATAR.min}
            max={TAMANO_AVATAR.max}
            step={TAMANO_AVATAR.paso}
            value={tamano}
            aria-valuetext={`${tamano} píxeles`}
            onChange={(e) => onCambiar({ tamanoAvatar: Number(e.target.value) })}
            className="flex-1 accent-theme-main"
          />
          {/* El lector ya oye el valor en el propio deslizador */}
          <span aria-hidden="true" className="w-16 text-right text-sm tabular-nums">
            {tamano} px
          </span>
        </div>
        {/* Muestra del tamaño: la sala queda detrás del diálogo */}
        <div
          aria-hidden="true"
          className="mt-2 rounded border border-theme-main bg-background"
          style={{ width: tamano, height: tamano }}
        />
      </div>

      {/* Siempre visible: si desapareciera al pulsarlo, el foco se perdería */}
      <div>
        <button type="button" onClick={() => onCambiar({ tamanoAvatar: TAMANO_AVATAR.defecto })} className={botonSecundario}>
          Volver al tamaño normal
        </button>
      </div>
    </div>
  );
};

export default PanelInterfaz;
