import { ChevronLeft, ChevronRight, NotebookPen, Pencil, Pin, PinOff, Trash2 } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { NOTA_LARGO_MAX } from './fichas';

interface Tamano {
  ancho: number;
  alto: number;
}

/** El tamaño que se le da a la nota con el asa, dentro de unos límites (en px). */
const limitarTamano = (ancho: number, alto: number): Tamano => ({
  ancho: Math.round(Math.min(320, Math.max(112, ancho))),
  alto: Math.round(Math.min(480, window.innerHeight * 0.7, Math.max(56, alto))),
});

interface NotaAsientoProps {
  asientoId: string;
  /** «asiento 4 (Ana)», para los nombres de la nota y de sus botones. */
  nombre: string;
  /** La nota, o null si no tiene. */
  nota: string | null;
  /** Quien mira puede escribirla, cambiarla y borrarla (si no, solo leerla). */
  editable: boolean;
  /** Hacia dónde sale la nota: hacia fuera de la mesa. */
  lado: 'izquierda' | 'derecha';
  /** Plegada, solo asoma una pestaña con el icono de la nota. */
  plegada: boolean;
  /** Se está escribiendo (desde el menú de la ficha o con el lápiz de la nota). */
  editando: boolean;
  onPlegar: (plegada: boolean) => void;
  onEditar: () => void;
  /** Deja de escribirla (guardada o no). */
  onTerminar: () => void;
  /** Guarda la nota (con null, la borra) y devuelve el error, o null si ha ido bien. */
  onGuardar: (texto: string | null) => Promise<string | null>;
}

const botonNota =
  'rounded-sm p-1 text-on-surface-muted transition-colors hover:bg-gold/10 hover:text-gold-bright focus:outline-none focus-visible:ring-1 focus-visible:ring-gold/70';

/**
 * La nota sobre un asiento: una tarjeta de tinta con filo de latón pegada al
 * cuadro, por el lado de fuera de la mesa. Quien puede la cambia (el lápiz, o
 * «Editar nota» en el menú de la ficha) o la borra (pidiendo confirmación);
 * cualquiera que la vea la pliega para que solo asome una pestaña con su icono, y
 * la despliega pulsándola. Sin nota no hay tarjeta: se escribe desde el menú de la
 * ficha («Escribir nota»).
 *
 * La tarjeta no pasa del alto del cuadro: si la nota no cabe, se desvanece por abajo
 * y sale una chincheta que la fija para leerla entera (y la vuelve a recoger).
 *
 * El asa de la esquina de fuera (abajo) le cambia el tamaño arrastrándola, o con
 * las flechas si tiene el foco; doble clic (o Inicio) lo devuelve al de siempre.
 *
 * Escribiendo, Control (o Cmd) + Intro guarda y Escape lo deja como estaba; el
 * foco vuelve a la tarjeta (o a la ficha, si ya no hay nota).
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
  // El tamaño puesto con el asa (null: el de siempre) y, mientras se arrastra, desde dónde
  const [tamano, setTamano] = useState<Tamano | null>(null);
  const tarjetaRef = useRef<HTMLElement>(null);
  const arrastreRef = useRef<({ x: number; y: number } & Tamano) | null>(null);
  const id = `sala-nota-${asientoId}`;

  // Si el texto no cabe en la tarjeta recogida (fijada no se mide: ya se ve entero)
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

  const enfocar = (cual: 'pestana' | 'tarjeta' | 'ficha') =>
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
    enfocar('tarjeta');
  };

  const cancelar = () => {
    onTerminar();
    enfocar(nota ? 'tarjeta' : 'ficha');
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
    enfocar('tarjeta');
  };

  // El asa: hacia fuera de la mesa, más ancha; hacia abajo, más alta
  const haciaFuera = lado === 'derecha' ? 1 : -1;

  const empezarArrastre = (e: PointerEvent<HTMLButtonElement>) => {
    const tarjeta = tarjetaRef.current;
    if (!tarjeta || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    arrastreRef.current = { x: e.clientX, y: e.clientY, ancho: tarjeta.offsetWidth, alto: tarjeta.offsetHeight };
  };

  const arrastrar = (e: PointerEvent<HTMLButtonElement>) => {
    const inicio = arrastreRef.current;
    if (!inicio) return;
    setTamano(limitarTamano(inicio.ancho + (e.clientX - inicio.x) * haciaFuera, inicio.alto + e.clientY - inicio.y));
  };

  const soltar = () => {
    arrastreRef.current = null;
  };

  const tamanoConTeclas = (e: KeyboardEvent<HTMLButtonElement>) => {
    const tarjeta = tarjetaRef.current;
    if (!tarjeta) return;
    const paso = e.shiftKey ? 48 : 16;
    const cambio: Record<string, [number, number]> = {
      ArrowRight: [paso * haciaFuera, 0],
      ArrowLeft: [-paso * haciaFuera, 0],
      ArrowDown: [0, paso],
      ArrowUp: [0, -paso],
    };
    if (e.key === 'Home') setTamano(null);
    else if (cambio[e.key]) {
      const [dAncho, dAlto] = cambio[e.key];
      setTamano(limitarTamano(tarjeta.offsetWidth + dAncho, tarjeta.offsetHeight + dAlto));
    } else return;
    e.preventDefault();
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
          enfocar('tarjeta');
        }}
        data-lado={lado}
        className={`sala-nota-pestana absolute top-[10%] z-[5] flex min-h-8 items-center px-1.5 py-1.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-gold/70 ${fuera} ${
          lado === 'derecha' ? 'rounded-r-sm' : 'rounded-l-sm'
        }`}
      >
        <NotebookPen size={14} strokeWidth={1.75} aria-hidden="true" />
        <span className="sr-only">Ver la nota del {nombre}</span>
      </button>
    );
  }

  const Plegar = lado === 'derecha' ? ChevronLeft : ChevronRight;
  return (
    <section
      ref={tarjetaRef}
      aria-label={`Nota del ${nombre}`}
      style={tamano && !editando ? { width: tamano.ancho, height: tamano.alto, maxHeight: 'none' } : undefined}
      data-lado={lado}
      data-editando={editando || undefined}
      data-fijada={(fijada && !editando) || undefined}
      className={`sala-nota absolute top-[4%] z-[15] flex flex-col font-ui ${lado === 'derecha' ? 'left-full ml-2' : 'right-full mr-2'}`}
    >
      {editando ? (
        <div className="flex flex-col gap-2 p-2.5">
          <label htmlFor={`${id}-texto`} className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-gold">
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
            className="sala-nota-campo w-full resize-y px-2 py-1.5 text-[0.8rem] leading-relaxed"
          />
          <div className="flex items-center justify-between gap-2">
            <span id={`${id}-cuenta`} className="text-[0.62rem] tabular-nums tracking-wide text-on-surface-muted">
              {borrador.length}/{NOTA_LARGO_MAX}
              <span className="sr-only">. Control más Intro para guardar.</span>
            </span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={cancelar} className={`${botonNota} px-2 text-[0.7rem] font-semibold uppercase tracking-[0.12em]`}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void guardar()}
                aria-disabled={!borrador.trim() || guardando || undefined}
                className="sala-nota-guardar px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] focus:outline-none focus-visible:ring-1 focus-visible:ring-gold-bright"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className={`sala-nota-cabecera flex items-center gap-0.5 px-1 py-0.5 ${lado === 'derecha' ? '' : 'flex-row-reverse'}`}>
            <button id={`${id}-plegar`} type="button" onClick={plegar} aria-label={`Plegar la nota del ${nombre}`} className={botonNota}>
              <Plegar size={14} strokeWidth={1.75} />
            </button>
            <span className="flex-1" />
            {(cortada || fijada) && !borrando && (
              <button
                type="button"
                onClick={() => setFijada((f) => !f)}
                aria-pressed={fijada}
                aria-label={`Fijar la nota del ${nombre} para leerla entera`}
                title={fijada ? 'Recoger la nota' : 'Fijar la nota para leerla entera'}
                className={`${botonNota} ${fijada ? 'text-gold-bright' : ''}`}
              >
                {fijada ? <PinOff size={13} strokeWidth={1.75} /> : <Pin size={13} strokeWidth={1.75} />}
              </button>
            )}
            {editable &&
              (borrando ? (
                <span className="flex items-center gap-0.5 text-[0.7rem] text-on-surface-muted">
                  <span className="px-0.5">¿Borrar?</span>
                  <button id={`${id}-borrar`} type="button" onClick={() => void borrar()} onKeyDown={conEscape(noBorrar)} className={`${botonNota} px-1.5 font-semibold text-blood-pale hover:bg-blood/20 hover:text-blood-pale`}>
                    Sí<span className="sr-only">, borrar la nota del {nombre}</span>
                  </button>
                  <button type="button" onClick={noBorrar} onKeyDown={conEscape(noBorrar)} className={`${botonNota} px-1.5`}>
                    No
                  </button>
                </span>
              ) : (
                <>
                  <button id={`${id}-editar`} type="button" onClick={onEditar} aria-label={`Editar la nota del ${nombre}`} className={botonNota}>
                    <Pencil size={13} strokeWidth={1.75} />
                  </button>
                  <button type="button" onClick={pedirBorrar} aria-label={`Borrar la nota del ${nombre}`} className={`${botonNota} hover:bg-blood/20 hover:text-blood-pale`}>
                    <Trash2 size={13} strokeWidth={1.75} />
                  </button>
                </>
              ))}
          </div>
          <p
            ref={textoRef}
            data-cortada={(cortada && !fijada) || undefined}
            className={`sala-nota-texto min-h-0 flex-1 whitespace-pre-wrap break-words px-2.5 pb-3 pt-2 text-[0.78rem] leading-relaxed text-on-surface ${fijada ? 'overflow-y-auto' : 'overflow-hidden'}`}
          >
            {nota}
          </p>
          <button
            type="button"
            onPointerDown={empezarArrastre}
            onPointerMove={arrastrar}
            onPointerUp={soltar}
            onPointerCancel={soltar}
            onDoubleClick={() => setTamano(null)}
            onKeyDown={tamanoConTeclas}
            data-lado={lado}
            aria-label={`Cambiar el tamaño de la nota del ${nombre}`}
            title="Arrastra para cambiar el tamaño (doble clic: el de siempre)"
            className={`sala-nota-asa absolute bottom-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-gold/70 ${lado === 'derecha' ? 'right-0' : 'left-0'}`}
          >
            <span className="sr-only">. Flechas para cambiarlo, Inicio para dejarlo como estaba.</span>
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="px-2.5 pb-2 text-[0.7rem] font-semibold text-blood-pale">
          {error}
        </p>
      )}
    </section>
  );
};

export default NotaAsiento;
