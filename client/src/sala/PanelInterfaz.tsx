import Deslizador from './Deslizador';
import FichaRedonda from './FichaRedonda';
import Mano from './Mano';
import VistaPreviaJugador from './VistaPreviaJugador';
import type { CSSProperties, ReactNode } from 'react';
import { Dices } from 'lucide-react';
import { carpetaSilla, ESTILOS_CALAVERA, ESTILOS_MANO, ESTILOS_SILLA, ESTILOS_VOTO, MarcasContexto } from './marcas';
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
      <div className="grid grid-cols-[repeat(auto-fill,minmax(6.25rem,1fr))] gap-2">
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

/** La muestra de «Al azar»: una ficha con unos dados de latón. */
const MuestraAzar = () => (
  <span className="relative block">
    <FichaRedonda />
    <Dices size="55%" strokeWidth={1.5} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-hoja-tinta" />
  </span>
);

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
      muestra={(calavera) =>
        calavera === 'azar' ? (
          <MuestraAzar />
        ) : (
          // La ficha marcada, con esta calavera
          <MarcasContexto.Provider value={{ calavera, mano: 'laton', silla: 'clasica', voto: 'vela' }}>
            <FichaRedonda marcado />
          </MarcasContexto.Provider>
        )
      }
    />
    <ElegirEstilo
      id="sala-pref-mano"
      leyenda="Mano levantada"
      estilos={ESTILOS_MANO}
      valor={preferencias.mano}
      onCambiar={(mano) => onCambiar({ mano })}
      muestra={(mano) =>
        mano === 'azar' ? (
          <MuestraAzar />
        ) : (
          // Como en la mesa: sobre la esquina de arriba a la derecha de la ficha
          <span className="relative block">
            <FichaRedonda />
            <Mano forma="palma" estilo={mano} className="absolute -right-[8%] -top-[12%] w-[55%] drop-shadow-[0_2px_3px_rgba(0,0,0,0.7)]" />
          </span>
        )
      }
    />
    <ElegirEstilo
      id="sala-pref-voto"
      leyenda="Voto de los muertos"
      estilos={ESTILOS_VOTO}
      valor={preferencias.voto}
      onCambiar={(voto) => onCambiar({ voto })}
      muestra={(voto) => (
        // Un muerto que ya ha gastado su voto, con este estilo (su vela apagada o el círculo)
        <MarcasContexto.Provider value={{ calavera: 'clasica', mano: 'laton', silla: 'clasica', voto }}>
          <FichaRedonda muerto votoGastado />
        </MarcasContexto.Provider>
      )}
    />
    <ElegirEstilo
      id="sala-pref-silla"
      leyenda="Silla de los asientos libres"
      estilos={ESTILOS_SILLA}
      valor={preferencias.silla}
      onCambiar={(silla) => onCambiar({ silla })}
      muestra={(silla) =>
        silla === 'azar' ? (
          <MuestraAzar />
        ) : (
          // Como en el asiento de arriba a la derecha de la mesa (en espejo), en su marco de retrato
          <img
            src={`${carpetaSilla(silla)}arriba-izquierda.webp`}
            alt=""
            className="sala-retrato block h-[var(--sala-ficha)] w-[var(--sala-ficha)] -scale-x-100 rounded-[3px] object-cover"
          />
        )
      }
    />
  </div>
);

export default PanelInterfaz;
