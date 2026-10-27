import { ChevronLeft, ChevronRight, NotebookPen, Pencil, Pin, PinOff, Trash2 } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { NOTA_LARGO_MAX } from './fichas';

interface NotaAsientoProps {
  asientoId: string;
  /** «asiento 4 (Ana)», para los nombres del pósit y de sus botones. */
  nombre: string;
  /** La nota, o null si no tiene. */
  nota: string | null;
  /** Quien mira puede escribirla, cambiarla y borrarla (si no, solo leerla). */
  editable: boolean;
  /** Hacia dónde sale el pósit: hacia fuera de la mesa. */
  lado: 'izquierda' | 'derecha';
  /** Plegada, solo asoma una pestaña con el icono de la nota. */
  plegada: boolean;
  /** Se está escribiendo (desde el menú de la ficha o con el lápiz del pósit). */
  editando: boolean;
  onPlegar: (plegada: boolean) => void;
  onEditar: () => void;
  /** Deja de escribirla (guardada o no). */
  onTerminar: () => void;
  /** Guarda la nota (con null, la borra) y devuelve el error, o null si ha ido bien. */
  onGuardar: (texto: string | null) => Promise<string | null>;
}

const botonPostit =
  'rounded p-0.5 text-hoja-cuerpo/70 hover:bg-hoja-tinta/10 hover:text-hoja-tinta focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main';

/**
 * La nota sobre un asiento: un pósit pegado al cuadro, por el lado de fuera de la
 * mesa, con el texto entero. Quien puede la cambia (el lápiz, o «Editar nota» en
 * el menú de la ficha) o la borra (pidiendo confirmación); cualquiera que la vea
 * la pliega para que solo asome una pestaña con su icono, y la despliega pulsándola.
 * Sin nota no hay pósit: se escribe desde el menú de la ficha («Escribir nota»).
 *
 * El pósit no pasa del alto del cuadro: si la nota no cabe, se desvanece por abajo
 * y sale una chincheta que la fija para leerla entera (y la vuelve a recoger).
 *
 * Escribiendo, Control (o Cmd) + Intro guarda y Escape lo deja como estaba; el
 * foco vuelve al pósit (o a la ficha, si ya no hay nota).
 */
const NotaAsiento = ({ asientoId, nombre, nota, editable, lado, plegada, editando, onPlegar, onEditar, onTerminar, onGuardar }: NotaAsientoProps) => {
  const [borrador, setBorrador] = useState('');
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  // Fijada, se lee entera; si no, no pasa del alto del cuadro (y se ve si se corta)
  const [fijada, setFijada] = useState(false);
  const [cortada, setCortada] = useState(false);
  const textoRef = useRef<HTMLParagraphElement>(null);
  const id = `sala-nota-${asientoId}`;

  // Si el texto no cabe en el pósit recogido (fijado no se mide: ya se ve entero)
  useLayoutEffect(() => {
    const texto = textoRef.current;
    if (!texto || fijada) return;
    const medir = () => setCortada(texto.scrollHeight > texto.clientHeight + 1);
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(texto);
    return () => observador.disconnect();
  }, [nota, fijada, plegada, editando]);

  // Al empezar a escribir, con lo que ya había y el foco en el texto
  useEffect(() => {
    if (!editando) return;
    setBorrador(nota ?? '');
    setError('');
    setBorrando(false);
    window.setTimeout(() => document.getElementById(`${id}-texto`)?.focus(), 0);
    // Solo al empezar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editando]);

  const enfocar = (cual: 'pestana' | 'postit' | 'ficha') =>
    window.setTimeout(() => {
      const destino =
        cual === 'ficha'
          ? `sala-ficha-${asientoId}-boton`
          : cual === 'pestana'
            ? `${id}-pestana`
            : editable
              ? `${id}-editar`
              : `${id}-plegar`;
      document.getElementById(destino)?.focus();
    }, 0);

  const guardar = async () => {
    const texto = borrador.trim();
    if (!texto || guardando) return;
    setGuardando(true);
    const fallo = await onGuardar(texto);
    setGuardando(false);
    if (fallo) {
      setError(fallo);
      return;
    }
    onTerminar();
    enfocar('postit');
  };

  const cancelar = () => {
    onTerminar();
    enfocar(nota ? 'postit' : 'ficha');
  };

  const borrar = async () => {
    const fallo = await onGuardar(null);
    setBorrando(false);
    if (fallo) {
      setError(fallo);
      return;
    }
    enfocar('ficha');
  };

  const plegar = () => {
    onPlegar(true);
    enfocar('pestana');
  };

  const pedirBorrar = () => {
    setError('');
    setBorrando(true);
    window.setTimeout(() => document.getElementById(`${id}-borrar`)?.focus(), 0);
  };

  const noBorrar = () => {
    setBorrando(false);
    enfocar('postit');
  };

  // Escape deja lo que se esté haciendo (escribir o confirmar el borrado)
  const conEscape = (deshacer: () => void) => (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    deshacer();
  };

  if (!nota && !editando) return null;
  const fuera = lado === 'derecha' ? 'left-full' : 'right-full';

  if (plegada && !editando) {
    return (
      <button
        id={`${id}-pestana`}
        type="button"
        onClick={() => {
          onPlegar(false);
          enfocar('postit');
        }}
        data-lado={lado}
        className={`sala-nota-pestana absolute top-[10%] z-[5] flex min-h-7 items-center px-1.5 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main ${fuera} ${
          lado === 'derecha' ? 'rounded-r-md' : 'rounded-l-md'
        }`}
      >
        <NotebookPen size={13} aria-hidden="true" />
        <span className="sr-only">Ver la nota del {nombre}</span>
      </button>
    );
  }

  const Plegar = lado === 'derecha' ? ChevronLeft : ChevronRight;
  return (
    <section
      aria-label={`Nota del ${nombre}`}
      data-lado={lado}
      data-editando={editando || undefined}
      data-fijada={(fijada && !editando) || undefined}
      className={`sala-postit absolute top-[4%] z-[15] flex flex-col gap-1 px-2 pb-2 pt-1 font-ui ${lado === 'derecha' ? 'left-full ml-1.5' : 'right-full mr-1.5'}`}
    >
      {editando ? (
        <>
          <label htmlFor={`${id}-texto`} className="text-[0.7rem] font-semibold text-hoja-cuerpo">
            {nota ? 'Editar nota' : 'Nota nueva'}
          </label>
          <textarea
            id={`${id}-texto`}
            value={borrador}
            rows={5}
            maxLength={NOTA_LARGO_MAX}
            onChange={(e) => setBorrador(e.target.value)}
            onKeyDown={(e) => {
              // Ctrl (o Cmd) + Intro guarda; Intro solo, salto de línea
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void guardar();
              } else conEscape(cancelar)(e);
            }}
            aria-describedby={`${id}-cuenta`}
            className="w-full resize-y rounded-sm border border-hoja-tinta/25 bg-white/40 px-1.5 py-1 text-xs text-hoja-tinta focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main"
          />
          <div className="flex items-center justify-between gap-2">
            <span id={`${id}-cuenta`} className="text-[0.65rem] text-hoja-cuerpo/70">
              {borrador.length}/{NOTA_LARGO_MAX}
              <span className="sr-only">. Control más Intro para guardar.</span>
            </span>
            <div className="flex gap-1">
              <button type="button" onClick={cancelar} className={`${botonPostit} px-1.5 text-xs`}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void guardar()}
                aria-disabled={!borrador.trim() || guardando || undefined}
                className="rounded-sm bg-hoja-tinta px-2 py-0.5 text-xs font-semibold text-hoja-claro hover:bg-hoja-lacre focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className={`flex items-center gap-0.5 ${lado === 'derecha' ? '' : 'flex-row-reverse'}`}>
            <button id={`${id}-plegar`} type="button" onClick={plegar} aria-label={`Plegar la nota del ${nombre}`} className={botonPostit}>
              <Plegar size={14} />
            </button>
            <span className="flex-1" />
            {(cortada || fijada) && !borrando && (
              <button
                type="button"
                onClick={() => setFijada((f) => !f)}
                aria-pressed={fijada}
                aria-label={`Fijar la nota del ${nombre} para leerla entera`}
                title={fijada ? 'Recoger la nota' : 'Fijar la nota para leerla entera'}
                className={`${botonPostit} ${fijada ? 'text-hoja-lacre' : ''}`}
              >
                {fijada ? <PinOff size={13} /> : <Pin size={13} />}
              </button>
            )}
            {editable &&
              (borrando ? (
                <span className="flex items-center gap-0.5 text-[0.7rem]">
                  <span>¿Borrar?</span>
                  <button id={`${id}-borrar`} type="button" onClick={() => void borrar()} onKeyDown={conEscape(noBorrar)} className={`${botonPostit} px-1 font-semibold text-hoja-lacre`}>
                    Sí<span className="sr-only">, borrar la nota del {nombre}</span>
                  </button>
                  <button type="button" onClick={noBorrar} onKeyDown={conEscape(noBorrar)} className={`${botonPostit} px-1`}>
                    No
                  </button>
                </span>
              ) : (
                <>
                  <button id={`${id}-editar`} type="button" onClick={onEditar} aria-label={`Editar la nota del ${nombre}`} className={botonPostit}>
                    <Pencil size={13} />
                  </button>
                  <button type="button" onClick={pedirBorrar} aria-label={`Borrar la nota del ${nombre}`} className={`${botonPostit} hover:text-hoja-lacre`}>
                    <Trash2 size={13} />
                  </button>
                </>
              ))}
          </div>
          <p
            ref={textoRef}
            data-cortada={(cortada && !fijada) || undefined}
            className={`sala-postit-texto min-h-0 flex-1 whitespace-pre-wrap break-words text-xs leading-snug ${fijada ? 'overflow-y-auto' : 'overflow-hidden'}`}
          >
            {nota}
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="text-[0.7rem] font-semibold text-hoja-lacre">
          {error}
        </p>
      )}
    </section>
  );
};

export default NotaAsiento;
