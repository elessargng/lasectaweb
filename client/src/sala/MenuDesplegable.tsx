import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface OpcionMenu {
  id: string;
  etiqueta: string;
  /** Abre un diálogo en lugar de actuar directamente. */
  abreDialogo?: boolean;
  /** Para las que actúan directamente: devuelve si salió bien. */
  elegir: () => Promise<boolean> | void;
}

interface MenuDesplegableProps {
  /** id de la lista de opciones (para aria-controls); el botón lleva `${id}-boton`. */
  id: string;
  /** Contenido del botón; es su nombre accesible, salvo que se dé `etiqueta`. */
  boton: ReactNode;
  /** Nombre accesible del botón cuando solo lleva un icono. */
  etiqueta?: string;
  botonClassName: string;
  opciones: OpcionMenu[];
  /** Hacia dónde se abre la lista. */
  alinear?: 'izquierda' | 'derecha';
}

const opcionClass =
  'w-full text-left px-3 py-2 text-sm text-on-surface hover:bg-theme-container focus:outline-none focus-visible:bg-theme-container';

/**
 * Botón que despliega una lista de botones (no un menú ARIA): se recorre con Tab
 * como cualquier otro control y los lectores lo anuncian como
 * «contraído/expandido». Escape o salir con el foco lo cierran. Si no hay
 * opciones, no sale.
 */
const MenuDesplegable = ({ id, boton, etiqueta, botonClassName, opciones, alinear = 'izquierda' }: MenuDesplegableProps) => {
  const [abierto, setAbierto] = useState(false);
  const botonRef = useRef<HTMLButtonElement>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);

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

  const cerrar = () => {
    setAbierto(false);
    botonRef.current?.focus();
  };

  // Si abre un diálogo, el foco vuelve antes al botón del menú, para que el
  // diálogo lo devuelva ahí al cerrarse. Si actúa y sale bien, el cambio de la
  // sala mueve el foco; cerrar antes lo dejaría en el aire mientras responde.
  const elegir = async (opcion: OpcionMenu) => {
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
        aria-expanded={abierto}
        aria-controls={id}
        onClick={() => setAbierto((v) => !v)}
        className={botonClassName}
      >
        {boton}
      </button>
      <ul
        id={id}
        hidden={!abierto}
        className={`absolute ${alinear === 'derecha' ? 'right-0' : 'left-0'} top-full z-20 mt-1 min-w-full w-max rounded border border-outline-ghost bg-surface py-1 shadow-lg`}
      >
        {opciones.map((opcion) => (
          <li key={opcion.id}>
            <button
              type="button"
              aria-haspopup={opcion.abreDialogo ? 'dialog' : undefined}
              onClick={() => elegir(opcion)}
              className={opcionClass}
            >
              {opcion.etiqueta}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MenuDesplegable;
