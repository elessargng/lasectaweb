import { ChevronDown, ChevronsLeft, ChevronsRight, ChevronUp } from 'lucide-react';
import { type IconoSala } from './IconosJuego';
import type { KeyboardEvent, ReactNode } from 'react';
import { idPestanaLateral } from './ids';
import type { PanelLateral } from './preferencias';

export interface PestanaLateral {
  id: PanelLateral;
  etiqueta: string;
  Icono: IconoSala;
  /**
   * Lo que se cuenta en su insignia (sin leer, en curso…), si es más de 0.
   * Destacado (algo espera respuesta): la insignia late, salvo con menos movimiento.
   */
  contador?: { valor: number; texto: string; destacado?: boolean };
  contenido: ReactNode;
}

interface ColumnaLateralProps {
  pestanas: PestanaLateral[];
  /** La que se ve (si ya no está, la primera). */
  activa: PanelLateral;
  onElegir: (id: PanelLateral) => void;
  /** Contraída: solo la barra de iconos, en una fila; los paneles no se ven. */
  contraida: boolean;
  onContraer: (contraida: boolean) => void;
  /**
   * Lo fijado arriba (los faroles): se ve encima de los demás paneles, quitándoles
   * sitio; en el suyo no sale (ya está entero). Sin nada fijado, null.
   */
  fijado?: { panel: PanelLateral; contenido: ReactNode } | null;
}

const idPestana = idPestanaLateral;
const idPanel = (id: string) => `sala-lateral-panel-${id}`;
const ID_PANELES = 'sala-lateral-paneles';

const claseBoton = (elegido: boolean) =>
  `relative flex flex-1 flex-col items-center gap-1 rounded-[3px] px-1 py-2 transition-colors motion-reduce:transition-none ${
    elegido
      ? 'bg-linear-to-b from-grimorio/55 to-grimorio/20 text-gold-bright shadow-[inset_0_-2px_0_var(--color-theme-main)] lg:bg-linear-to-r lg:shadow-[inset_3px_0_0_var(--color-theme-main),0_0_14px_rgba(212,175,106,0.12)]'
      : 'text-on-surface-muted hover:bg-grimorio/25 hover:text-on-surface'
  }`;

/**
 * La columna de la izquierda: una barra de iconos (Mensajes, Conversaciones,
 * Faroles) y, al lado, el panel elegido, de alto fijo para que la página no
 * crezca con lo que lleve. En pantallas estrechas la barra va encima.
 *
 * Pestañas como manda ARIA: las flechas (arriba y abajo, o izquierda y derecha)
 * van de una a otra, Inicio y Fin a la primera y la última, y Tab entra en el
 * panel. Los paneles que no se ven siguen montados (ocultos), para no perder lo
 * que se estaba escribiendo.
 *
 * Al final de la barra, «Panel» la contrae o la despliega (un desplegable:
 * aria-expanded, con el mismo nombre siempre; el lector dice «contraído» o
 * «expandido»). Contraída queda solo la barra de iconos, con sus contadores; ya
 * no son pestañas sino botones que despliegan el panel de cada uno y llevan el
 * foco a su pestaña. El botón «Panel» es el mismo en los dos estados, así que
 * el foco no se pierde al pulsarlo.
 *
 * En pantallas anchas, el panel se mete a la izquierda, detrás de la barra (la
 * caja se estrecha hasta el ancho de la barra y el contenido se desliza), y al
 * desplegarse sale hacia la derecha; sin animación si se pide menos movimiento.
 * Contraído es `inert` (ni el foco ni el lector entran) y, al acabar de
 * meterse, invisible. En estrechas, simplemente se oculta.
 */
const ColumnaLateral = ({ pestanas, activa, onElegir, contraida, onContraer, fijado = null }: ColumnaLateralProps) => {
  const actual = pestanas.find((p) => p.id === activa) ?? pestanas[0];
  if (!actual) return null;

  const enfocarPestana = (id: string) => window.setTimeout(() => document.getElementById(idPestana(id))?.focus(), 0);

  const alTeclear = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = pestanas.indexOf(actual);
    const n = pestanas.length;
    const destinos: Record<string, number> = {
      ArrowDown: (i + 1) % n,
      ArrowRight: (i + 1) % n,
      ArrowUp: (i - 1 + n) % n,
      ArrowLeft: (i - 1 + n) % n,
      Home: 0,
      End: n - 1,
    };
    if (!(e.key in destinos)) return;
    e.preventDefault();
    const destino = pestanas[destinos[e.key]];
    onElegir(destino.id);
    enfocarPestana(destino.id);
  };

  // Contraída, un icono despliega su panel (y el foco va a su pestaña)
  const desplegar = (id: PanelLateral) => {
    onElegir(id);
    onContraer(false);
    enfocarPestana(id);
  };

  return (
    <div
      className={`sala-panel flex flex-col overflow-hidden lg:min-h-[16rem] lg:flex-1 lg:flex-row lg:motion-safe:transition-[width] lg:duration-300 lg:ease-in-out ${
        // En pantallas anchas ocupa el alto que queda en la columna; contraída, solo el ancho de la barra
        contraida ? 'w-full lg:w-[calc(4rem+2px)]' : 'w-full'
      }`}
    >
      <div
        className={`flex shrink-0 gap-1 border-gold/15 bg-background/60 p-1 lg:w-16 lg:flex-col lg:border-r ${
          contraida ? '' : 'border-b lg:border-b-0'
        }`}
      >
        <div
          role={contraida ? undefined : 'tablist'}
          aria-label={contraida ? undefined : 'Panel lateral'}
          aria-orientation={contraida ? undefined : 'vertical'}
          className="flex flex-1 gap-1 lg:flex-none lg:flex-col"
        >
          {pestanas.map(({ id, etiqueta, Icono, contador }) => {
            const elegida = id === actual.id;
            const contenido = (
              <>
                <Icono size={20} strokeWidth={1.5} />
                <span className="font-ui text-[0.56rem] font-semibold uppercase leading-none tracking-normal">{etiqueta}</span>
                {contador && contador.valor > 0 && (
                  <span
                    className={`sala-contador absolute right-1 top-1 min-w-[1.1rem] rounded-full px-1 text-center font-ui text-[0.6rem] font-bold leading-[1.1rem] ${
                      contador.destacado ? 'ring-2 ring-theme-main/40 motion-safe:animate-pulse' : ''
                    }`}
                  >
                    <span className="sr-only">, </span>
                    {contador.valor}
                    <span className="sr-only"> {contador.texto}</span>
                  </span>
                )}
              </>
            );
            return contraida ? (
              <button key={id} type="button" onClick={() => desplegar(id)} className={`${claseBoton(false)} lg:flex-none`}>
                {contenido}
              </button>
            ) : (
              <button
                key={id}
                id={idPestana(id)}
                type="button"
                role="tab"
                aria-selected={elegida}
                aria-controls={idPanel(id)}
                tabIndex={elegida ? 0 : -1}
                onClick={() => onElegir(id)}
                onKeyDown={alTeclear}
                className={`${claseBoton(elegida)} lg:flex-none`}
              >
                {contenido}
              </button>
            );
          })}
        </div>
        {/* Contraer o desplegar: fuera de las pestañas (no es una de ellas), al final de la barra */}
        <button
          type="button"
          aria-expanded={!contraida}
          aria-controls={ID_PANELES}
          onClick={() => onContraer(!contraida)}
          className={`${claseBoton(false)} flex-none px-2 lg:mt-auto lg:border-t lg:border-gold/15 lg:pt-2`}
        >
          {/* La flecha, hacia donde va el panel: a la izquierda (o arriba) al contraerse */}
          {contraida ? (
            <>
              <ChevronDown size={20} strokeWidth={1.5} className="lg:hidden" />
              <ChevronsRight size={20} strokeWidth={1.5} className="hidden lg:block" />
            </>
          ) : (
            <>
              <ChevronUp size={20} strokeWidth={1.5} className="lg:hidden" />
              <ChevronsLeft size={20} strokeWidth={1.5} className="hidden lg:block" />
            </>
          )}
          <span className="font-ui text-[0.56rem] font-semibold uppercase leading-none tracking-normal">Panel</span>
        </button>
      </div>
      {/* La visibilidad cambia al final de la transición al meterse, y al principio al salir */}
      <div
        id={ID_PANELES}
        inert={contraida}
        className={`h-[28rem] min-w-0 flex-1 overflow-hidden lg:h-auto lg:motion-safe:transition-[visibility] lg:duration-300 ${
          contraida ? 'max-lg:hidden lg:invisible' : ''
        }`}
      >
        {/* De ancho fijo (el de la columna menos la barra): no se recoloca mientras se mete o sale */}
        <div
          className={`flex h-full flex-col lg:w-[calc(23rem-4rem-2px)] lg:motion-safe:transition-transform lg:duration-300 lg:ease-in-out ${
            contraida ? 'lg:-translate-x-full' : ''
          }`}
        >
          {fijado && fijado.panel !== actual.id && fijado.contenido}
          <div className="min-h-0 flex-1">
            {pestanas.map(({ id, contenido }) => (
              <div key={id} id={idPanel(id)} role="tabpanel" aria-labelledby={idPestana(id)} hidden={id !== actual.id} className="h-full">
                {contenido}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColumnaLateral;
