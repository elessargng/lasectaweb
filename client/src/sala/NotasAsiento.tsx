import { NotebookPen, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { botonPrincipal, botonSecundario, campo } from './estilos';
import { NOTA_LARGO_MAX, NOTAS_MAX } from './fichas';
import type { SalaNota } from './useSala';

interface NotasAsientoProps {
  asientoId: string;
  /** «asiento 4 (Ana)», para el título del panel y los nombres de los botones. */
  nombre: string;
  notas: SalaNota[];
  /** Quien mira puede escribir, cambiar y borrar (si no, solo leerlas). */
  editable: boolean;
  /** Hacia dónde sale la pestaña: hacia fuera de la mesa. */
  lado: 'izquierda' | 'derecha';
  abierto: boolean;
  /** Al abrirse, con una nota nueva lista para escribir («Escribir nota» del menú de la ficha). */
  nueva: boolean;
  onAbrir: () => void;
  onCerrar: () => void;
  /** Guarda una nota (nueva, con null) y devuelve el error, o null si ha ido bien. */
  onGuardar: (notaId: string | null, texto: string) => Promise<string | null>;
  onBorrar: (notaId: string) => Promise<string | null>;
}

/** Lo que mide el panel de ancho, y su margen con los bordes de la ventana. */
const ANCHO = 320;
const MARGEN = 8;

/**
 * Las notas sobre un asiento: una pestaña de marcapáginas en el lado de fuera
 * del cuadro, con cuántas hay, que despliega un panel con todas. Ahí se leen
 * enteras y, quien puede, las escribe (hasta NOTAS_MAX), las cambia o las borra
 * (pidiendo confirmación). Sin notas no hay pestaña: se escriben desde el menú de
 * la ficha («Escribir nota»), que abre el panel con una nueva.
 *
 * El panel no es modal (la partida sigue a la vista): va en el body, junto a la
 * pestaña y sin salirse de la ventana; en pantallas estrechas, abajo, a lo ancho.
 * Se cierra con Escape, con la X o pulsando fuera, y el foco vuelve a la pestaña
 * (o a la ficha, si ya no quedan notas).
 */
const NotasAsiento = ({ asientoId, nombre, notas, editable, lado, abierto, nueva, onAbrir, onCerrar, onGuardar, onBorrar }: NotasAsientoProps) => {
  const pestanaRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const [sitio, setSitio] = useState<CSSProperties | null>(null);
  // La nota que se está escribiendo ('nueva' o su id), con su borrador
  const [editando, setEditando] = useState<string | null>(null);
  const [borrador, setBorrador] = useState('');
  const [borrando, setBorrando] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const idPanel = `sala-notas-${asientoId}`;
  const quedan = NOTAS_MAX - notas.length;

  // Al abrir: con una nueva si se pidió (y caben), o el foco en el título
  useEffect(() => {
    if (!abierto) return;
    setError('');
    setBorrando(null);
    if (nueva && editable && notas.length < NOTAS_MAX) {
      setEditando('nueva');
      setBorrador('');
    } else {
      setEditando(null);
      window.setTimeout(() => tituloRef.current?.focus(), 0);
    }
    // Solo al abrirse
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, nueva]);

  // Dónde va el panel: al lado de la pestaña (hacia fuera), sin salirse de la ventana
  useLayoutEffect(() => {
    if (!abierto) return;
    const colocar = () => {
      const pestana = pestanaRef.current?.getBoundingClientRect();
      const alto = panelRef.current?.offsetHeight ?? 0;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (vw < 640 || !pestana) {
        setSitio({ left: MARGEN, right: MARGEN, bottom: MARGEN });
        return;
      }
      const left = lado === 'derecha' ? pestana.right + MARGEN : pestana.left - MARGEN - ANCHO;
      setSitio({
        width: ANCHO,
        left: Math.min(Math.max(MARGEN, left), vw - ANCHO - MARGEN),
        top: Math.min(Math.max(MARGEN, pestana.top - 12), vh - alto - MARGEN),
      });
    };
    colocar();
    const observador = new ResizeObserver(colocar);
    if (panelRef.current) observador.observe(panelRef.current);
    window.addEventListener('resize', colocar);
    window.addEventListener('scroll', colocar, true);
    return () => {
      observador.disconnect();
      window.removeEventListener('resize', colocar);
      window.removeEventListener('scroll', colocar, true);
    };
  }, [abierto, lado, notas.length]);

  // Pulsar fuera (ni en el panel ni en la pestaña) lo cierra
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || pestanaRef.current?.contains(t)) return;
      cerrar(false);
    };
    document.addEventListener('pointerdown', fuera, true);
    return () => document.removeEventListener('pointerdown', fuera, true);
  });

  const cerrar = (devolverFoco = true) => {
    onCerrar();
    setEditando(null);
    if (!devolverFoco) return;
    window.setTimeout(() => (pestanaRef.current ?? document.getElementById(`sala-ficha-${asientoId}-boton`))?.focus(), 0);
  };

  const empezar = (nota: SalaNota | null) => {
    setError('');
    setBorrando(null);
    setEditando(nota?.id ?? 'nueva');
    setBorrador(nota?.texto ?? '');
  };

  const guardar = async () => {
    const texto = borrador.trim();
    if (!texto || guardando || !editando) return;
    setGuardando(true);
    const fallo = await onGuardar(editando === 'nueva' ? null : editando, texto);
    setGuardando(false);
    if (fallo) {
      setError(fallo);
      return;
    }
    setEditando(null);
    window.setTimeout(() => tituloRef.current?.focus(), 0);
  };

  const borrar = async (notaId: string) => {
    const fallo = await onBorrar(notaId);
    setBorrando(null);
    if (fallo) setError(fallo);
    window.setTimeout(() => tituloRef.current?.focus(), 0);
  };

  const alTeclear = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    // Escape deja primero lo que se esté haciendo; luego cierra
    if (editando) {
      setEditando(null);
      window.setTimeout(() => tituloRef.current?.focus(), 0);
    } else if (borrando) setBorrando(null);
    else cerrar();
  };

  const editor = (etiqueta: string) => (
    <div className="flex flex-col gap-2">
      <label htmlFor={`${idPanel}-texto`} className="sr-only">
        {etiqueta}
      </label>
      <textarea
        id={`${idPanel}-texto`}
        value={borrador}
        autoFocus
        rows={4}
        maxLength={NOTA_LARGO_MAX}
        onChange={(e) => setBorrador(e.target.value)}
        onKeyDown={(e) => {
          // Ctrl (o Cmd) + Intro guarda; Intro solo, salto de línea
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void guardar();
          }
        }}
        aria-describedby={`${idPanel}-cuenta`}
        className={`${campo} w-full resize-y text-sm`}
      />
      <div className="flex items-center justify-between gap-2">
        <span id={`${idPanel}-cuenta`} className="text-xs text-on-surface-muted">
          {borrador.length}/{NOTA_LARGO_MAX}
          <span className="sr-only">. Control más Intro para guardar.</span>
        </span>
        <div className="flex gap-2">
          <button type="button" onClick={() => setEditando(null)} className={botonSecundario}>
            Cancelar
          </button>
          <button type="button" onClick={() => void guardar()} aria-disabled={!borrador.trim() || guardando || undefined} className={botonPrincipal}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );

  const hayPestana = notas.length > 0 || abierto;
  return (
    <>
      {hayPestana && (
        <button
          ref={pestanaRef}
          type="button"
          aria-expanded={abierto}
          aria-controls={abierto ? idPanel : undefined}
          onClick={() => (abierto ? cerrar() : onAbrir())}
          data-lado={lado}
          className={`sala-nota-pestana absolute top-[10%] z-[5] flex min-h-7 items-center gap-1 px-1.5 py-1 font-ui text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main ${
            lado === 'derecha' ? 'left-full rounded-r-md' : 'right-full rounded-l-md'
          }`}
        >
          <NotebookPen size={13} aria-hidden="true" />
          <span aria-hidden="true">{notas.length}</span>
          <span className="sr-only">
            {notas.length === 1 ? '1 nota' : `${notas.length} notas`} del {nombre}
          </span>
        </button>
      )}
      {abierto &&
        createPortal(
          <div
            ref={panelRef}
            id={idPanel}
            role="dialog"
            aria-labelledby={`${idPanel}-titulo`}
            onKeyDown={alTeclear}
            className="sala-notas-panel sala-cofre fixed z-[60] flex max-h-[70vh] flex-col"
            style={sitio ?? { visibility: 'hidden' }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-outline-ghost px-4 py-2.5">
              <h2 id={`${idPanel}-titulo`} ref={tituloRef} tabIndex={-1} className="font-ui text-sm font-semibold text-gold-bright focus:outline-none">
                Notas <span className="font-normal text-on-surface-muted">· {nombre}</span>
              </h2>
              <button type="button" onClick={() => cerrar()} aria-label="Cerrar las notas" className="rounded p-1 text-on-surface-muted hover:text-gold-bright focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main">
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-col gap-3 overflow-y-auto px-4 py-3">
              {notas.length === 0 && editando !== 'nueva' && <p className="text-sm text-on-surface-muted">No hay notas.</p>}
              {notas.length > 0 && (
                <ol className="flex flex-col gap-2">
                  {notas.map((n, i) => (
                    <li key={n.id} className="sala-nota rounded px-3 py-2">
                      {editando === n.id ? (
                        editor(`Nota ${i + 1}`)
                      ) : (
                        <div className="flex items-start gap-2">
                          <span aria-hidden="true" className="mt-0.5 font-ui text-xs text-gold">
                            {i + 1}.
                          </span>
                          <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm">
                            <span className="sr-only">Nota {i + 1}: </span>
                            {n.texto}
                          </p>
                          {editable &&
                            (borrando === n.id ? (
                              <span className="flex shrink-0 items-center gap-1 text-xs">
                                <span>¿Borrar?</span>
                                <button type="button" autoFocus onClick={() => void borrar(n.id)} className="rounded px-1.5 py-0.5 font-semibold text-blood-pale hover:bg-blood/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main">
                                  Sí<span className="sr-only">, borrar la nota {i + 1}</span>
                                </button>
                                <button type="button" onClick={() => setBorrando(null)} className="rounded px-1.5 py-0.5 hover:bg-grimorio/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main">
                                  No
                                </button>
                              </span>
                            ) : (
                              <span className="flex shrink-0 gap-0.5">
                                <button type="button" onClick={() => empezar(n)} aria-label={`Editar la nota ${i + 1}`} className="rounded p-1 text-on-surface-muted hover:text-gold-bright focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main">
                                  <Pencil size={14} />
                                </button>
                                <button type="button" onClick={() => setBorrando(n.id)} aria-label={`Borrar la nota ${i + 1}`} className="rounded p-1 text-on-surface-muted hover:text-blood-pale focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main">
                                  <Trash2 size={14} />
                                </button>
                              </span>
                            ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              )}
              {editando === 'nueva' && <div className="sala-nota rounded px-3 py-2">{editor('Nota nueva')}</div>}
              {error && (
                <p role="alert" className="text-sm text-blood-pale">
                  {error}
                </p>
              )}
              {editable && editando === null && (
                <button
                  type="button"
                  onClick={() => quedan > 0 && empezar(null)}
                  aria-disabled={quedan <= 0 || undefined}
                  className={`${botonSecundario} self-start`}
                >
                  <Plus size={14} aria-hidden="true" />
                  {quedan > 0 ? `Nota (${quedan === 1 ? '1 libre' : `${quedan} libres`})` : `Máximo ${NOTAS_MAX} notas`}
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

export default NotasAsiento;
