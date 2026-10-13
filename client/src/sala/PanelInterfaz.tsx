import Deslizador from './Deslizador';
import VistaPreviaJugador from './VistaPreviaJugador';
import type { CSSProperties } from 'react';
import type { TamanosMesa } from './Mesa';
import { RANGOS, type PreferenciasSala } from './preferencias';

interface PanelInterfazProps {
  /** Para la vista previa: el nombre con el que apareces en la sala. */
  nombre: string;
  preferencias: PreferenciasSala;
  /** Tamaños con los que se pinta ahora la mesa (los automáticos, si lo son). */
  tamanosMesa: TamanosMesa | null;
  onCambiar: (cambios: Partial<PreferenciasSala>) => void;
}

/**
 * Pestaña Interfaz: cómo ves la sala (avatares y fichas), con una vista previa
 * arriba. Los cambios se aplican al momento y se guardan en este navegador.
 */
const PanelInterfaz = ({ nombre, preferencias, tamanosMesa, onCambiar }: PanelInterfazProps) => (
  <div className="flex flex-col gap-6">
    {/* La vista previa, con los tamaños de la mesa (un jugador se ve así) */}
    <div
      style={
        tamanosMesa
          ? ({ '--sala-avatar': `${tamanosMesa.avatar}px`, '--sala-ficha': `${tamanosMesa.ficha}px` } as CSSProperties)
          : undefined
      }
    >
      <VistaPreviaJugador nombre={nombre} />
    </div>
    <Deslizador
      id="sala-pref-tamano"
      etiqueta="Tamaño de los avatares"
      valor={preferencias.tamanoAvatar}
      rango={RANGOS.tamanoAvatar}
      onCambiar={(tamanoAvatar) => onCambiar({ tamanoAvatar })}
      automatico={{
        activo: preferencias.avatarAuto,
        actual: tamanosMesa?.avatar ?? preferencias.tamanoAvatar,
        explicacion: 'según el tamaño de la mesa y el número de asientos',
        onCambiar: (avatarAuto) => onCambiar({ avatarAuto }),
      }}
    />
    <Deslizador
      id="sala-pref-ficha"
      etiqueta="Tamaño de las fichas"
      valor={preferencias.tamanoFicha}
      rango={RANGOS.tamanoFicha}
      onCambiar={(tamanoFicha) => onCambiar({ tamanoFicha })}
      automatico={{
        activo: preferencias.fichaAuto,
        actual: tamanosMesa?.ficha ?? preferencias.tamanoFicha,
        explicacion: 'en proporción al tamaño de los avatares',
        onCambiar: (fichaAuto) => onCambiar({ fichaAuto }),
      }}
    />
    <Deslizador
      id="sala-pref-separacion"
      etiqueta="Distancia de la ficha al cuadro"
      valor={preferencias.distanciaFicha}
      rango={RANGOS.distanciaFicha}
      unidad="%"
      ayuda="Al mínimo, la ficha queda en el centro del cuadro; al máximo, entera fuera, hacia el centro de la mesa."
      onCambiar={(distanciaFicha) => onCambiar({ distanciaFicha })}
    />
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          id="sala-pref-sonidos"
          type="checkbox"
          checked={preferencias.sonidos}
          onChange={(e) => onCambiar({ sonidos: e.target.checked })}
          aria-describedby="sala-pref-sonidos-ayuda"
          className="h-4 w-4 accent-theme-main"
        />
        <label htmlFor="sala-pref-sonidos" className="text-sm">
          Sonidos de la partida
        </label>
      </div>
      <p id="sala-pref-sonidos-ayuda" className="text-xs text-on-surface-muted">
        Campanadas al final de la cuenta atrás y al votar, y el tic del reloj cuando alguien no vota.
      </p>
    </div>
  </div>
);

export default PanelInterfaz;
