import Deslizador from './Deslizador';
import FichaRedonda from './FichaRedonda';
import Mano from './Mano';
import VistaPreviaJugador from './VistaPreviaJugador';
import type { CSSProperties, ReactNode } from 'react';
import { ESTILOS_CALAVERA, ESTILOS_MANO, MarcasContexto } from './marcas';
import type { TamanosMesa } from './Mesa';
import { RANGOS, type PreferenciasSala } from './preferencias';

interface ElegirEstiloProps<T extends string> {
  id: string;
  leyenda: string;
  estilos: readonly { id: T; nombre: string; descripcion: string }[];
  valor: T;
  onCambiar: (valor: T) => void;
  /** El dibujo de cada estilo (no se lee: lo dice su nombre). */
  muestra: (estilo: T) => ReactNode;
}

/**
 * Elegir un estilo de dibujo: botones de opción (se recorren con las flechas)
 * con su muestra sobre una ficha; el elegido, con filo de latón.
 */
function ElegirEstilo<T extends string>({ id, leyenda, estilos, valor, onCambiar, muestra }: ElegirEstiloProps<T>) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="campo-etiqueta">{leyenda}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {estilos.map((e) => (
          <div key={e.id}>
            <input
              id={`${id}-${e.id}`}
              type="radio"
              name={id}
              value={e.id}
              checked={valor === e.id}
              onChange={() => onCambiar(e.id)}
              aria-describedby={`${id}-${e.id}-desc`}
              className="peer sr-only"
            />
            <label
              htmlFor={`${id}-${e.id}`}
              className="flex h-full cursor-pointer flex-col items-center gap-2 rounded-[3px] border border-outline-ghost bg-background/50 px-2 pb-2.5 pt-4 text-center transition-colors hover:border-gold/45 peer-checked:border-gold peer-checked:bg-theme-container peer-checked:shadow-[0_0_16px_rgba(212,175,106,0.18),inset_0_1px_0_rgba(212,175,106,0.25)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-theme-main motion-reduce:transition-none"
            >
              <span aria-hidden="true" className="block [--sala-ficha:3.5rem]">
                {muestra(e.id)}
              </span>
              <span className="font-ui text-xs font-semibold tracking-wide text-on-surface-bright">{e.nombre}</span>
              <span id={`${id}-${e.id}-desc`} className="text-xs leading-tight text-on-surface-muted">
                {e.descripcion}
              </span>
            </label>
          </div>
        ))}
      </div>
    </fieldset>
  );
}

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
 * arriba. Los cambios se aplican al momento; con cuenta se guardan en el servidor.
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
    <ElegirEstilo
      id="sala-pref-calavera"
      leyenda="Calavera de las nominaciones"
      estilos={ESTILOS_CALAVERA}
      valor={preferencias.calavera}
      onCambiar={(calavera) => onCambiar({ calavera })}
      muestra={(calavera) => (
        // La ficha marcada, con esta calavera
        <MarcasContexto.Provider value={{ calavera, mano: preferencias.mano }}>
          <FichaRedonda marcado />
        </MarcasContexto.Provider>
      )}
    />
    <ElegirEstilo
      id="sala-pref-mano"
      leyenda="Mano levantada"
      estilos={ESTILOS_MANO}
      valor={preferencias.mano}
      onCambiar={(mano) => onCambiar({ mano })}
      muestra={(mano) => (
        // Como en la mesa: sobre la esquina de arriba a la derecha de la ficha
        <span className="relative block">
          <FichaRedonda />
          <Mano forma="palma" estilo={mano} className="absolute -right-[8%] -top-[12%] w-[55%] drop-shadow-[0_2px_3px_rgba(0,0,0,0.7)]" />
        </span>
      )}
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
        La cuenta atrás de las nominaciones, y al votar, un sonido por cada voto y un tic cuando alguien no vota.
      </p>
    </div>
  </div>
);

export default PanelInterfaz;
