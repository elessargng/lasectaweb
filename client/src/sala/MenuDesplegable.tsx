import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { colocarDesplegable } from './colocarDesplegable';
import TeclaAtajo from './TeclaAtajo';
import type { Atajo } from './atajos';

export interface OpcionMenu {
  id: string;
  etiqueta: string;
  /** Abre un diálogo en lugar de actuar directamente. */
  abreDialogo?: boolean;
  /** Aún no hace nada (p. ej. «próximamente»): se ve y se lee, pero no actúa. */
  deshabilitada?: boolean;
  /** Es la elegida de un grupo (p. ej. la forma de la mano): se lee como pulsada y lleva ✓. */
  marcada?: boolean;
  /** Si la acción tiene atajo de teclado, su tecla (se ve al lado como una tecla). */
  atajo?: Atajo;
  /** Para las que actúan directamente: devuelve si salió bien. */
  elegir: () => Promise<boolean> | void;
  /**
   * Lo que se verá (p. ej. la mano): la opción va en una rejilla de varias columnas
   * con su dibujo, y el nombre solo para el lector y al pasar el ratón.
   */
  dibujo?: ReactNode;
  /** Con dibujo: el rótulo de su rejilla («Manos», «Personajes»); las seguidas del mismo van juntas. */
  grupo?: string;
}

interface MenuDesplegableProps {
  /** id de la lista de opciones (para aria-controls); el botón lleva `${id}-boton`. */
  id: string;
  /** Contenido del botón; es su nombre accesible, salvo que se dé `etiqueta`. */
  boton: ReactNode;
  /** Nombre accesible del botón cuando solo lleva un icono. */
  etiqueta?: string;
  /**
   * Estado que cambia (p. ej. «levantada»): va como descripción y no en el nombre,
   * porque los lectores anuncian cada cambio del nombre del botón con el foco y
   * no los de su descripción. Se oye al llegar al botón.
   */
  descripcion?: string;
  botonClassName: string;
  opciones: OpcionMenu[];
  /** Hacia dónde se abre la lista. */
  alinear?: 'izquierda' | 'derecha';
  /** Controles junto al rótulo de una rejilla (p. ej. cambiar el estilo de las manos), por grupo. */
  extrasGrupo?: Partial<Record<string, ReactNode>>;
}

const casillaClass =
  'sala-opcion flex aspect-square w-full items-center justify-center rounded p-1 aria-pressed:bg-theme-container aria-pressed:ring-2 aria-pressed:ring-gold-bright focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main aria-disabled:opacity-50';

const opcionClass =
  'sala-opcion flex w-full items-center gap-2 text-left px-4 py-2 text-on-surface aria-pressed:text-gold-bright aria-disabled:text-on-surface-muted aria-disabled:hover:bg-none aria-disabled:hover:shadow-none';

/**
 * Botón que despliega una lista de botones (no un menú ARIA): se recorre con Tab
 * como cualquier otro control y los lectores lo anuncian como
 * «contraído/expandido». Escape o salir con el foco lo cierran. Si no hay
 * opciones, no sale.
 *
 * Las opciones con dibujo van en rejillas, una por grupo (con su rótulo), en
 * lugar de una fila de texto cada una: se ve lo que se elige.
 */
const MenuDesplegable = ({
  id,
  boton,
  etiqueta,
  descripcion,
  botonClassName,
  opciones,
  alinear = 'izquierda',
  extrasGrupo = {},
}: MenuDesplegableProps) => {
  const [abierto, setAbierto] = useState(false);
  const botonRef = useRef<HTMLButtonElement>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLUListElement>(null);

  // Al abrirse, hacia arriba si abajo no cabe (antes de pintarse: no se ve el salto)
  useLayoutEffect(() => {
    if (abierto && botonRef.current && listaRef.current) colocarDesplegable(botonRef.current, listaRef.current);
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setAbierto(false);
      botonRef.current?.focus();
    };
    // Pulsar o llevar el foco fuera del menú lo cierra.
    const fuera = (e: Event) => {
      if (!contenedorRef.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', fuera);
    document.addEventListener('focusin', fuera);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('focusin', fuera);
    };
  }, [abierto]);

  if (opciones.length === 0) return null;

  // Las opciones en tramos: cada una sin dibujo, sola (una fila); las seguidas con dibujo
  // y del mismo grupo, juntas en una rejilla.
  const tramos: ({ opcion: OpcionMenu } | { grupo: string | undefined; opciones: OpcionMenu[] })[] = [];
  for (const opcion of opciones) {
    const ultimo = tramos[tramos.length - 1];
    if (!opcion.dibujo) tramos.push({ opcion });
    else if (ultimo && 'grupo' in ultimo && ultimo.grupo === opcion.grupo) ultimo.opciones.push(opcion);
    else tramos.push({ grupo: opcion.grupo, opciones: [opcion] });
  }
  const conDibujos = tramos.some((t) => 'grupo' in t);

  const cerrar = () => {
    setAbierto(false);
    botonRef.current?.focus();
  };

  // Si abre un diálogo, el foco vuelve antes al botón del menú, para que el
  // diálogo lo devuelva ahí al cerrarse. Si actúa y sale bien, el cambio de la
  // sala mueve el foco; cerrar antes lo dejaría en el aire mientras responde.
  const elegir = async (opcion: OpcionMenu) => {
    if (opcion.deshabilitada) return;
    if (opcion.abreDialogo) {
      cerrar();
      opcion.elegir();
      return;
    }
    if (await opcion.elegir()) return;
    cerrar();
  };

  return (
    <div ref={contenedorRef} className="relative">
      <button
        ref={botonRef}
        id={`${id}-boton`}
        type="button"
        aria-label={etiqueta}
        aria-describedby={descripcion ? `${id}-estado` : undefined}
        aria-expanded={abierto}
        aria-controls={id}
        onClick={() => setAbierto((v) => !v)}
        className={botonClassName}
      >
        {boton}
      </button>
      {descripcion && (
        <span id={`${id}-estado`} className="sr-only">
          {descripcion}
        </span>
      )}
      <ul
        ref={listaRef}
        id={id}
        hidden={!abierto}
        className={`absolute ${alinear === 'derecha' ? 'right-0' : 'left-0'} top-full z-20 mt-2 min-w-full w-max sala-cofre py-1.5 ${conDibujos ? 'max-h-[75vh] overflow-y-auto' : ''} data-[arriba=true]:bottom-full data-[arriba=true]:top-auto data-[arriba=true]:mb-2 data-[arriba=true]:mt-0`}
      >
        {tramos.map((tramo) =>
          'grupo' in tramo ? (
            <li key={`grupo-${tramo.opciones[0].id}`} className="px-3 py-1.5">
              {tramo.grupo && (
                <div className="mb-1 flex items-center gap-2">
                  <p id={`${id}-grupo-${tramo.opciones[0].id}`} className="font-ui text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-on-surface-muted">
                    {tramo.grupo}
                  </p>
                  {extrasGrupo[tramo.grupo]}
                </div>
              )}
              <ul
                aria-labelledby={tramo.grupo ? `${id}-grupo-${tramo.opciones[0].id}` : undefined}
                className="grid grid-cols-[repeat(5,3.25rem)] gap-1"
              >
                {tramo.opciones.map((opcion) => (
                  <li key={opcion.id}>
                    <button
                      type="button"
                      aria-label={opcion.etiqueta}
                      title={opcion.etiqueta}
                      aria-disabled={opcion.deshabilitada || undefined}
                      aria-pressed={opcion.marcada === undefined ? undefined : opcion.marcada}
                      onClick={() => elegir(opcion)}
                      className={casillaClass}
                    >
                      {opcion.dibujo}
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ) : (
            <li key={tramo.opcion.id}>
              <button
                type="button"
                aria-haspopup={tramo.opcion.abreDialogo ? 'dialog' : undefined}
                aria-disabled={tramo.opcion.deshabilitada || undefined}
                aria-pressed={tramo.opcion.marcada === undefined ? undefined : tramo.opcion.marcada}
                onClick={() => elegir(tramo.opcion)}
                className={opcionClass}
              >
                {tramo.opcion.marcada !== undefined && (
                  <span aria-hidden="true" className="inline-block w-3">
                    {tramo.opcion.marcada ? '✓' : ''}
                  </span>
                )}
                {tramo.opcion.etiqueta}
                {tramo.opcion.atajo && <TeclaAtajo atajo={tramo.opcion.atajo} ocultoALector className="ml-auto" />}
              </button>
            </li>
          ),
        )}
      </ul>
    </div>
  );
};

export default MenuDesplegable;
