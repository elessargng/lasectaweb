import Interruptor from './Interruptor';
import Deslizador from './Deslizador';
import FichaRedonda from './FichaRedonda';
import Mano from './Mano';
import VistaPreviaJugador from './VistaPreviaJugador';
import type { CSSProperties, ReactNode } from 'react';
import { Dices } from 'lucide-react';
import { carpetaSilla, ESTILOS_CALAVERA, ESTILOS_MANO, ESTILOS_SILLA, ESTILOS_VOTO, MarcasContexto } from './marcas';
import type { TamanosMesa } from './Mesa';
import { RANGOS, type PreferenciasSala } from './preferencias';
import { FONDOS, rutaFondo } from './fondos';
import VelaVoto from './VelaVoto';
import Galaxy from '../components/Galaxy';
import { COLORES_CIELO, propsGalaxy } from './cielo';

interface ElegirEstiloProps<T extends string> {
  id: string;
  leyenda: string;
  estilos: readonly { id: T; nombre: string; descripcion: string }[];
  valor: T;
  onCambiar: (valor: T) => void;
  /** El dibujo de cada estilo (no se lee: lo dice su nombre). */
  muestra: (estilo: T) => ReactNode;
  /** Una explicación bajo la leyenda (se lee como descripción del grupo). */
  ayuda?: string;
}

/**
 * Elegir un estilo de dibujo: botones de opción (se recorren con las flechas)
 * con su muestra sobre una ficha; el elegido, con filo de latón.
 */
function ElegirEstilo<T extends string>({ id, leyenda, estilos, valor, onCambiar, muestra, ayuda }: ElegirEstiloProps<T>) {
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={ayuda ? `${id}-ayuda` : undefined}>
      <legend className="campo-etiqueta">{leyenda}</legend>
      {ayuda && (
        <p id={`${id}-ayuda`} className="-mt-1 text-xs text-on-surface-muted">
          {ayuda}
        </p>
      )}
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

/** Dónde va cada estrella de la muestra de unos colores del cielo (en %, y su tamaño en px). */
const ESTRELLAS_MUESTRA = [
  [14, 30, 3],
  [32, 68, 2],
  [50, 22, 4],
  [66, 58, 2],
  [82, 32, 3],
  [24, 84, 2],
  [74, 82, 3],
  [44, 48, 2],
] as const;

/** La muestra de unos colores del cielo: un trozo de noche con estrellas de esos colores. */
const MuestraColoresCielo = ({ colores }: { colores: readonly string[] }) => (
  <span className="relative block aspect-[2/1] w-20 overflow-hidden rounded-[3px] bg-[radial-gradient(ellipse_at_center,#141a33,#05060d)]">
    {ESTRELLAS_MUESTRA.map(([x, y, lado], i) => {
      const color = colores[i % colores.length];
      return (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: lado,
            height: lado,
            background: color,
            boxShadow: `0 0 ${lado * 2}px ${color}`,
          }}
        />
      );
    })}
  </span>
);

interface PanelInterfazProps {
  /** Para la vista previa: el nombre con el que apareces en la sala. */
  nombre: string;
  preferencias: PreferenciasSala;
  /** Tamaños con los que se pinta ahora la mesa (los automáticos, si lo son). */
  tamanosMesa: TamanosMesa | null;
  /** El fondo de la sala (del guion o del narrador), con su dirección completa, o null. */
  fondoDeLaSala: string | null;
  onCambiar: (cambios: Partial<PreferenciasSala>) => void;
}

/**
 * Pestaña Interfaz: cómo ves la sala (avatares y fichas), con una vista previa
 * arriba. Los cambios se aplican al momento; con cuenta se guardan en el servidor.
 */
const PanelInterfaz = ({ nombre, preferencias, tamanosMesa, fondoDeLaSala, onCambiar }: PanelInterfazProps) => (
  <div className="flex flex-col gap-6">
    <div className="flex flex-col gap-1">
      <Interruptor
        id="sala-pref-llamada-botc"
        activo={preferencias.llamadaBotc}
        onCambiar={(llamadaBotc) => onCambiar({ llamadaBotc })}
        describedBy="sala-pref-llamada-botc-ayuda"
        textoClassName="text-sm"
      >
        Llamada estilo botc.app
      </Interruptor>
      <p id="sala-pref-llamada-botc-ayuda" className="text-xs text-on-surface-muted">
        Los botones de llamar y de mandar un mensaje, con los iconos de botc.app, no salen al pasar el ratón por el
        cuadro de cada uno: pulsa Intro y salen en los cuadros de todos los jugadores y del narrador; vuelve a
        pulsarla, o Escape, para quitarlos.
      </p>
    </div>
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
      id="sala-pref-fondo"
      leyenda="Fondo de la sala"
      ayuda="Solo cambia lo que ves tú."
      estilos={FONDOS}
      valor={preferencias.fondo}
      onCambiar={(fondo) => onCambiar({ fondo })}
      muestra={(fondo) => (
        // Cada fondo en pequeño (el del guion, el que tiene ahora la sala)
        <img
          src={rutaFondo(fondo, fondoDeLaSala)}
          alt=""
          loading="lazy"
          className="block aspect-[2/1] w-20 rounded-[3px] object-cover"
        />
      )}
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
      ayuda="Es tu mano: todos la ven así. Las de los demás se ven como las haya elegido cada uno."
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
      muestra={(voto) =>
        // Un muerto que ya ha gastado su voto, con este estilo: como en el asiento de las
        // 12, su ficha y, hacia la plaza (abajo), su vela apagada; o el círculo en el sudario
        voto === 'vela' ? (
          <span className="flex flex-col items-center">
            <MarcasContexto.Provider value={{ calavera: 'clasica', mano: 'laton', silla: 'clasica', voto }}>
              <FichaRedonda muerto votoGastado />
            </MarcasContexto.Provider>
            <VelaVoto encendida={false} className="aspect-[60/64] w-[calc(var(--sala-ficha)*0.5)] drop-shadow-[0_2px_2px_rgba(0,0,0,0.7)]" />
          </span>
        ) : (
          <MarcasContexto.Provider value={{ calavera: 'clasica', mano: 'laton', silla: 'clasica', voto }}>
            <FichaRedonda muerto votoGastado />
          </MarcasContexto.Provider>
        )
      }
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
    <div className="flex flex-col gap-1">
      <Interruptor
        id="sala-pref-ciudad"
        activo={preferencias.ciudadCabecera}
        onCambiar={(ciudadCabecera) => onCambiar({ ciudadCabecera })}
        describedBy="sala-pref-ciudad-ayuda"
        textoClassName="text-sm"
      >
        Ciudad animada en la cabecera
      </Interruptor>
      <p id="sala-pref-ciudad-ayuda" className="text-xs text-on-surface-muted">
        La ciudad con la torre del reloj entre el logo y la fase: de noche y de día, con su atardecer y su amanecer al
        cambiar. Desactivada, no se ve.
      </p>
    </div>
    {/* Solo con la ciudad: sin ella no hay poblado que quitar */}
    {preferencias.ciudadCabecera && (
      <div className="flex flex-col gap-1">
        <Interruptor
          id="sala-pref-poblado"
          activo={preferencias.pobladoCabecera}
          onCambiar={(pobladoCabecera) => onCambiar({ pobladoCabecera })}
          describedBy="sala-pref-poblado-ayuda"
          textoClassName="text-sm"
        >
          Poblado en la ciudad
        </Interruptor>
        <p id="sala-pref-poblado-ayuda" className="text-xs text-on-surface-muted">
          Las casas y la torre del reloj. Desactivado, solo se ve el cielo, con el sol, la luna y las aves.
        </p>
      </div>
    )}
    <div className="flex flex-col gap-1">
      <Interruptor
        id="sala-pref-cielo"
        activo={preferencias.cieloEstrellado}
        onCambiar={(cieloEstrellado) => onCambiar({ cieloEstrellado })}
        describedBy="sala-pref-cielo-ayuda"
        textoClassName="text-sm"
      >
        Cielo estrellado de noche
      </Interruptor>
      <p id="sala-pref-cielo-ayuda" className="text-xs text-on-surface-muted">
        Las estrellas que giran detrás de la sala mientras es de noche. Desactivado, no se ven.
      </p>
    </div>
    {/* Solo con el cielo: sin él no hay estrellas que ajustar */}
    {preferencias.cieloEstrellado && (
      <>
        {/* La vista previa: el cielo como se verá de noche */}
        <div
          aria-hidden="true"
          className="h-32 overflow-hidden rounded-[3px] border border-outline-ghost bg-[radial-gradient(ellipse_at_center,#141a33,#05060d)]"
        >
          <Galaxy {...propsGalaxy(preferencias)} />
        </div>
        <ElegirEstilo
          id="sala-pref-colores-cielo"
          leyenda="Colores de las estrellas"
          estilos={COLORES_CIELO}
          valor={preferencias.coloresCielo}
          onCambiar={(coloresCielo) => onCambiar({ coloresCielo })}
          muestra={(id) => <MuestraColoresCielo colores={COLORES_CIELO.find((c) => c.id === id)?.colores ?? []} />}
        />
        <Deslizador
          id="sala-pref-velocidad-cielo"
          etiqueta="Velocidad de las estrellas"
          valor={preferencias.velocidadCielo}
          rango={RANGOS.velocidadCielo}
          unidad="%"
          ayuda="Al 100 %, como de costumbre; al mínimo, quietas: ni giran ni parpadean."
          onCambiar={(velocidadCielo) => onCambiar({ velocidadCielo })}
        />
        <Deslizador
          id="sala-pref-densidad-cielo"
          etiqueta="Densidad de estrellas"
          valor={preferencias.densidadCielo}
          rango={RANGOS.densidadCielo}
          unidad="%"
          ayuda="Al 100 %, como de costumbre; más, un cielo más poblado de estrellas más pequeñas."
          onCambiar={(densidadCielo) => onCambiar({ densidadCielo })}
        />
        <Deslizador
          id="sala-pref-brillo-cielo"
          etiqueta="Brillo de las estrellas"
          valor={preferencias.brilloCielo}
          rango={RANGOS.brilloCielo}
          unidad="%"
          ayuda="Al 100 %, como de costumbre."
          onCambiar={(brilloCielo) => onCambiar({ brilloCielo })}
        />
        <Deslizador
          id="sala-pref-parpadeo-cielo"
          etiqueta="Parpadeo de las estrellas"
          valor={preferencias.parpadeoCielo}
          rango={RANGOS.parpadeoCielo}
          unidad="%"
          ayuda="Al mínimo, no parpadean; al máximo, se apagan y se encienden del todo."
          onCambiar={(parpadeoCielo) => onCambiar({ parpadeoCielo })}
        />
      </>
    )}
  </div>
);

export default PanelInterfaz;
