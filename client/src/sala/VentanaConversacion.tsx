import { GripHorizontal, LogIn, Maximize2, MicOff, Minimize2, PhoneOff, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { botonSecundario } from './estilos';
import TeclaAtajo from './TeclaAtajo';
import type { Atajo } from './atajos';
import type { ConversacionDto, ParticipanteDto } from './useSala';
import type { PistasParticipante } from './useVideollamada';
import VideoPista from './VideoPista';
import NombresOyentes from './NombresOyentes';
import ImagenAvatar from './ImagenAvatar';
import BordeHabla from './BordeHabla';

interface VentanaConversacionProps {
  conversacion: ConversacionDto;
  participantes: ParticipanteDto[];
  yo: string;
  /** Lo que se ve y se oye en la conversación, por participante. */
  pistas: Map<string, PistasParticipante>;
  /** Los participantes cuyo jugador está muerto: su cámara o su avatar, en gris. */
  muertos: Set<string>;
  onSalir: () => void;
  /** Narradores que escuchan: pasar a estar dentro (se les ve y se les oye). */
  onEntrar?: () => void;
  /** La tecla para salir (Retroceso), para decirla. */
  teclaSalir: string;
  /** El atajo completo de salir, para verlo al lado como una tecla. */
  atajoSalir: Atajo;
  /** El título: recibe el foco al entrar en la conversación. */
  tituloRef: RefObject<HTMLHeadingElement | null>;
}

/** «Ana», «Ana y Luis», «Ana, Luis y Bea». */
const enumerar = (nombres: string[]) =>
  nombres.length <= 1 ? (nombres[0] ?? '') : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;

/** La ventana pequeña: su ancho y cuánto se mueve con cada flecha. */
const ANCHO_PEQUENA = 288;
const PASO = 24;

/** La ventana grande: su ancho mínimo, el de entrada (60rem, sin pasar del 92 % de la pantalla) y el paso de las flechas. */
const ANCHO_MINIMO = 320;
const anchoDefecto = () => Math.min(window.innerWidth * 0.92, 960);
const anchoMaximo = () => Math.max(ANCHO_MINIMO, window.innerWidth * 0.96);
const PASO_TAMANO = 40;
/** El ancho que se eligió la última vez (en este navegador), para las siguientes conversaciones. */
const KEY_ANCHO = 'sala:anchoConversacion';
const anchoGuardado = (): number | null => {
  try {
    const v = Number(localStorage.getItem(KEY_ANCHO));
    return Number.isFinite(v) && v >= ANCHO_MINIMO ? v : null;
  } catch {
    return null;
  }
};
const guardarAncho = (ancho: number | null) => {
  try {
    if (ancho === null) localStorage.removeItem(KEY_ANCHO);
    else localStorage.setItem(KEY_ANCHO, String(Math.round(ancho)));
  } catch {
    // Sin almacenamiento: vale para esta conversación
  }
};

/**
 * La llamada privada de quien está en ella: en grande en el centro de la pantalla
 * (sin depender del tamaño de los cuadros de la plaza), con un cuadro por persona
 * (su cámara o su avatar, un aro cuando habla). «Minimizar» la deja en una
 * ventanita con las cámaras pequeñas que se puede mover por la pantalla
 * (arrastrando su asa, o con las flechas con el foco en ella); «Ampliar» la
 * vuelve a poner en grande. Escape, con el foco dentro, la minimiza.
 *
 * En grande, el asa de la esquina de abajo a la derecha la agranda o la achica
 * (sigue centrada; las cámaras crecen con ella). Es un control deslizante para el
 * lector: flechas (y Re Pág / Av Pág, de más en más) para cambiarla, Inicio y Fin
 * al mínimo y al máximo; con doble clic vuelve al tamaño de entrada. El tamaño se
 * recuerda en este navegador.
 *
 * No es modal: la plaza y el chat se siguen usando.
 */
const VentanaConversacion = ({
  conversacion,
  participantes,
  yo,
  pistas,
  muertos,
  onSalir,
  onEntrar,
  teclaSalir,
  atajoSalir,
  tituloRef,
}: VentanaConversacionProps) => {
  const [minimizada, setMinimizada] = useState(false);
  // Dónde está la ventana pequeña (esquina de arriba a la izquierda, en px)
  const [posicion, setPosicion] = useState(() => ({ x: Math.max(8, window.innerWidth - ANCHO_PEQUENA - 24), y: 80 }));
  const ventanaRef = useRef<HTMLElement>(null);
  const arrastreRef = useRef<{ dx: number; dy: number } | null>(null);
  // El ancho de la ventana grande (px); null: el de entrada
  const [ancho, setAncho] = useState<number | null>(anchoGuardado);
  const [redimensionando, setRedimensionando] = useState(false);
  const tamanoRef = useRef<{ x: number; y: number; ancho: number } | null>(null);
  const [, setVentana] = useState(0);

  // Al cambiar la ventana del navegador, el ancho se vuelve a ajustar a lo que cabe
  useEffect(() => {
    const alCambiar = () => setVentana((n) => n + 1);
    window.addEventListener('resize', alCambiar);
    return () => window.removeEventListener('resize', alCambiar);
  }, []);
  const anchoGrande = Math.min(Math.max(ancho ?? anchoDefecto(), ANCHO_MINIMO), anchoMaximo());
  const cambiarAncho = (nuevo: number | null) => {
    const ajustado = nuevo === null ? null : Math.min(Math.max(nuevo, ANCHO_MINIMO), anchoMaximo());
    setAncho(ajustado);
    guardarAncho(ajustado);
  };
  // En % de la pantalla, para el lector y la etiqueta mientras se arrastra
  const porcentaje = Math.round((anchoGrande / window.innerWidth) * 100);

  const miembros = conversacion.miembros
    .map((id) => participantes.find((p) => p.id === id))
    .filter((p): p is ParticipanteDto => !!p);
  const oyentes = conversacion.oyentes
    .map((id) => participantes.find((p) => p.id === id))
    .filter((p): p is ParticipanteDto => !!p);
  const escucho = conversacion.oyentes.includes(yo);
  const otros = miembros.filter((p) => p.id !== yo).map((p) => p.nombre);

  // Que la ventana pequeña no se salga de la pantalla
  const colocar = (x: number, y: number) => {
    const alto = ventanaRef.current?.offsetHeight ?? 200;
    setPosicion({
      x: Math.min(Math.max(0, x), Math.max(0, window.innerWidth - ANCHO_PEQUENA)),
      y: Math.min(Math.max(0, y), Math.max(0, window.innerHeight - alto)),
    });
  };

  // Escape (con el foco dentro) la minimiza
  useEffect(() => {
    const alPulsar = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !minimizada && ventanaRef.current?.contains(document.activeElement)) {
        e.preventDefault();
        setMinimizada(true);
      }
    };
    document.addEventListener('keydown', alPulsar);
    return () => document.removeEventListener('keydown', alPulsar);
  }, [minimizada]);

  // Arrastrar la ventana pequeña por su asa
  const alApretar = (e: PointerEvent<HTMLButtonElement>) => {
    arrastreRef.current = { dx: e.clientX - posicion.x, dy: e.clientY - posicion.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const alMover = (e: PointerEvent<HTMLButtonElement>) => {
    const a = arrastreRef.current;
    if (a) colocar(e.clientX - a.dx, e.clientY - a.dy);
  };
  const alSoltar = () => {
    arrastreRef.current = null;
  };
  // Con el teclado: flechas para moverla
  const alTeclear = (e: KeyboardEvent<HTMLButtonElement>) => {
    const pasos: Record<string, [number, number]> = {
      ArrowLeft: [-PASO, 0],
      ArrowRight: [PASO, 0],
      ArrowUp: [0, -PASO],
      ArrowDown: [0, PASO],
    };
    const paso = pasos[e.key];
    if (!paso) return;
    e.preventDefault();
    colocar(posicion.x + paso[0], posicion.y + paso[1]);
  };

  // Agrandar o achicar la grande por su asa. Sigue centrada: la esquina va con el
  // puntero si el ancho crece el doble de lo que se mueve (en diagonal, lo que más)
  const alApretarTamano = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    tamanoRef.current = { x: e.clientX, y: e.clientY, ancho: anchoGrande };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus();
    setRedimensionando(true);
  };
  const alMoverTamano = (e: PointerEvent<HTMLDivElement>) => {
    const t = tamanoRef.current;
    if (!t) return;
    const dx = e.clientX - t.x;
    const dy = (e.clientY - t.y) * (16 / 9);
    cambiarAncho(t.ancho + 2 * (Math.abs(dx) >= Math.abs(dy) ? dx : dy));
  };
  const alSoltarTamano = () => {
    tamanoRef.current = null;
    setRedimensionando(false);
  };
  const alTeclearTamano = (e: KeyboardEvent<HTMLDivElement>) => {
    const destinos: Record<string, number> = {
      ArrowRight: anchoGrande + PASO_TAMANO,
      ArrowUp: anchoGrande + PASO_TAMANO,
      ArrowLeft: anchoGrande - PASO_TAMANO,
      ArrowDown: anchoGrande - PASO_TAMANO,
      PageUp: anchoGrande + PASO_TAMANO * 4,
      PageDown: anchoGrande - PASO_TAMANO * 4,
      Home: ANCHO_MINIMO,
      End: anchoMaximo(),
    };
    if (!(e.key in destinos)) return;
    e.preventDefault();
    cambiarAncho(destinos[e.key]);
  };

  const columnas = minimizada ? 'grid-cols-3' : miembros.length <= 1 ? 'grid-cols-1' : miembros.length <= 4 ? 'grid-cols-2' : 'grid-cols-3';
  // Minimizada, los botones son solo su icono (si no, no caben): el nombre, para el lector
  const boton = `${botonSecundario} flex shrink-0 items-center gap-1 py-1 text-xs ${minimizada ? 'px-1.5' : 'px-2'}`;
  const texto = minimizada ? 'sr-only' : undefined;

  return (
    <section
      ref={ventanaRef}
      aria-labelledby="sala-conversacion-titulo"
      style={minimizada ? { left: posicion.x, top: posicion.y, width: ANCHO_PEQUENA } : { width: anchoGrande }}
      className={`fixed z-40 flex flex-col gap-2 sala-cofre backdrop-blur ${
        minimizada
          ? 'p-2'
          : 'left-1/2 top-1/2 max-h-[92vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto overflow-x-hidden p-4'
      } ${redimensionando ? 'select-none' : ''}`}
    >
      <div className="flex items-center gap-2">
        {minimizada && (
          <button
            type="button"
            aria-label="Mover la conversación"
            aria-describedby="sala-conversacion-mover"
            onPointerDown={alApretar}
            onPointerMove={alMover}
            onPointerUp={alSoltar}
            onPointerCancel={alSoltar}
            onKeyDown={alTeclear}
            className="cursor-move touch-none rounded p-0.5 text-on-surface-muted hover:text-gold-bright focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main"
          >
            <GripHorizontal size={18} />
          </button>
        )}
        <span id="sala-conversacion-mover" className="sr-only">
          Flechas para moverla por la pantalla.
        </span>
        <h2
          id="sala-conversacion-titulo"
          ref={tituloRef}
          tabIndex={-1}
          className={`min-w-0 flex-1 truncate text-gold-bright focus:outline-none ${minimizada ? 'font-ui text-xs font-semibold' : 'font-display text-xl'}`}
        >
          {escucho ? 'Escuchando una conversación' : 'Conversación privada'}
          {(escucho || otros.length > 0) && (
            <span className="sr-only">
              {escucho ? ' de ' : ' con '}
              {enumerar(escucho ? miembros.map((p) => p.nombre) : otros)}
            </span>
          )}
        </h2>
        <button type="button" onClick={() => setMinimizada((m) => !m)} className={boton}>
          {minimizada ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          <span className={texto}>{minimizada ? 'Ampliar' : 'Minimizar'}</span>
        </button>
        {escucho && onEntrar && (
          <button type="button" onClick={onEntrar} className={boton}>
            <LogIn size={14} />
            <span className={texto}>Entrar</span>
            <span className="sr-only"> en la conversación</span>
          </button>
        )}
        <button
          type="button"
          onClick={onSalir}
          aria-label={escucho ? 'Dejar de escuchar la conversación' : 'Salir de conversación privada'}
          aria-keyshortcuts={teclaSalir}
          className={`${boton} text-blood-pale`}
        >
          <PhoneOff size={14} />
          <span className={texto}>{escucho ? 'Dejar de escuchar' : 'Salir'}</span>
          {!minimizada && <TeclaAtajo atajo={atajoSalir} ocultoALector />}
        </button>
      </div>

      {!escucho && otros.length === 0 && (
        <p className={`text-on-surface-muted ${minimizada ? 'text-xs' : 'text-sm'}`}>
          No queda nadie más en la conversación. Pulsa «Salir» para volver a la plaza.
        </p>
      )}

      <ul className={`grid gap-2 ${columnas}`}>
        {miembros.map((p) => {
          const suyas = pistas.get(p.id);
          const soyYo = p.id === yo;
          return (
            <li key={p.id} className="flex min-w-0 flex-col items-center gap-1">
              <span className="relative block w-full">
                <span
                  className={`block w-full overflow-hidden rounded-[3px] border border-outline-ghost bg-background ${
                    minimizada ? 'aspect-square' : 'aspect-video'
                  } ${muertos.has(p.id) ? '[&_img]:grayscale [&_video]:grayscale' : ''}`}
                >
                  {suyas?.video ? (
                    <VideoPista pista={suyas.video} espejo={soyYo} />
                  ) : (
                    p.avatar && <ImagenAvatar avatar={p.avatar} className="h-full w-full object-contain" />
                  )}
                </span>
                {/* El mismo aro que en la plaza, encima del cuadro (fuera de él): no tapa la cámara */}
                <BordeHabla id={p.id} activo={!!suyas?.hablando} />
              </span>
              <span className={`flex max-w-full items-center gap-1 ${minimizada ? 'text-[0.65rem]' : 'text-sm'}`}>
                {suyas && !suyas.microfono && (
                  <>
                    <MicOff size={minimizada ? 11 : 14} className="shrink-0 text-blood-pale" />
                    <span className="sr-only">Silenciado: </span>
                  </>
                )}
                <span className={`truncate ${soyYo ? 'text-gold-bright' : ''}`}>
                  {p.nombre}
                  {soyYo && <span className="sr-only"> (tú)</span>}
                </span>
                {p.sinSonido && (
                  <>
                    <VolumeX size={minimizada ? 11 : 14} className="shrink-0 text-blood-pale" />
                    <span className="sr-only"> (sin sonido)</span>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      {oyentes.length > 0 && !minimizada && (
        // Solo les llega a narradores y visitantes: los jugadores no saben que hay oyentes
        <p className="text-xs text-on-surface-muted">
          {oyentes.length > 1 ? 'Escuchan (no hablan ni se ven' : 'Escucha (no habla ni se ve'}
          {escucho ? '' : '; los jugadores no lo saben'}): <NombresOyentes nombres={oyentes.map((o) => (o.id === yo ? 'tú' : o.nombre))} />
        </p>
      )}

      {/* El asa para agrandarla o achicarla: pegada a la esquina de abajo a la derecha
          (también si se desplaza el contenido). Para el lector, un control deslizante */}
      {!minimizada && (
        <div className="pointer-events-none sticky bottom-0 -mb-4 -mr-4 -mt-2 flex justify-end">
          {redimensionando && (
            <span aria-hidden="true" className="sala-asa-tamano-cifra">
              {porcentaje} %
            </span>
          )}
          <div
            role="slider"
            tabIndex={0}
            aria-label="Tamaño de la conversación"
            aria-describedby="sala-conversacion-tamano"
            aria-orientation="horizontal"
            aria-valuemin={Math.round((ANCHO_MINIMO / window.innerWidth) * 100)}
            aria-valuemax={Math.round((anchoMaximo() / window.innerWidth) * 100)}
            aria-valuenow={porcentaje}
            aria-valuetext={`${porcentaje} % del ancho de la pantalla`}
            title="Arrastra para cambiar el tamaño (doble clic: el de entrada)"
            onPointerDown={alApretarTamano}
            onPointerMove={alMoverTamano}
            onPointerUp={alSoltarTamano}
            onPointerCancel={alSoltarTamano}
            onLostPointerCapture={alSoltarTamano}
            onDoubleClick={() => cambiarAncho(null)}
            onKeyDown={alTeclearTamano}
            className="sala-asa-tamano pointer-events-auto"
            data-activa={redimensionando || undefined}
          >
            {/* Tres trazos en diagonal, como el asa de una ventana */}
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <path d="M14 6 L6 14 M14 10 L10 14 M14 14 L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
            </svg>
          </div>
          <span id="sala-conversacion-tamano" className="sr-only">
            Flechas para agrandarla o achicarla; Inicio y Fin, al mínimo y al máximo.
          </span>
        </div>
      )}
    </section>
  );
};

export default VentanaConversacion;
