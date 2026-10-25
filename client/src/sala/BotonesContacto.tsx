import type { ReactNode } from 'react';
import { LogIn, MessageSquare, Phone } from 'lucide-react';
import { useLlamadaBotc } from './llamadaBotc';

/** Lo que se puede hacer con alguien desde su nombre: escribirle y conversar (si se puede). */
export interface ContactoParticipante {
  onMensaje?: () => void;
  /**
   * Invitar a conversar («Invitar a Ana a conversar»), pedir unirse a la
   * conversación en la que ya está (`unirse`, otro icono), escuchar su
   * conversación (visitantes) o, con la invitación o la petición ya enviada,
   * pendiente (desactivado).
   */
  conversar?: { etiqueta: string; onIniciar?: () => void; pendiente?: boolean; unirse?: boolean };
  /**
   * Para el lector (oculto a la vista salvo con el foco): vigilar su mano. Mientras
   * se le vigila, se lee siempre y al momento cuando la levanta o la baja.
   */
  vigilar?: { activo: boolean; onAlternar: () => void };
}

interface BotonesContactoProps extends ContactoParticipante {
  /** A quién (para el nombre de los botones). */
  nombre: string;
}

/**
 * Junto al nombre de alguien, para el lector (oculto a la vista salvo con el
 * foco): vigilar su mano. Escribirle y conversar con él van dentro de su cuadro
 * (BotonesEnCuadro).
 */
const BotonesContacto = ({ nombre, vigilar }: BotonesContactoProps) => {
  if (!vigilar) return null;
  return (
    <span className="inline-flex shrink-0 gap-1 align-middle">
      {/* Solo para el lector: no se ve salvo con el foco del teclado (para que el foco no se pierda) */}
      <button
        type="button"
        onClick={vigilar.onAlternar}
        className="sr-only rounded-full border border-theme-main/70 bg-surface px-2 text-xs text-theme-main focus:not-sr-only focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main"
      >
        {vigilar.activo ? `Dejar de vigilar a ${nombre}` : `Vigilar a ${nombre}`}
      </button>
    </span>
  );
};

/** Los iconos de botc.app (de Font Awesome): dos bocadillos, llamar; un sobre, mandar un mensaje. */
const IconoLlamadaBotc = () => (
  <svg viewBox="0 -32 576 576" className="h-full w-full" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M384 144c0 97.2-86 176-192 176-26.7 0-52.1-5-75.2-14L35.2 349.2c-9.3 4.9-20.7 3.2-28.2-4.2s-9.2-18.9-4.2-28.2l35.6-67.2C14.3 220.2 0 183.6 0 144 0 46.8 86-32 192-32S384 46.8 384 144zm0 368c-94.1 0-172.4-62.1-188.8-144 120-1.5 224.3-86.9 235.8-202.7 83.3 19.2 145 88.3 145 170.7 0 39.6-14.3 76.2-38.4 105.6l35.6 67.2c4.9 9.3 3.2 20.7-4.2 28.2s-18.9 9.2-28.2 4.2L459.2 498c-23.1 9-48.5 14-75.2 14z" />
  </svg>
);
const IconoMensajeBotc = () => (
  <svg viewBox="0 0 512 512" className="h-full w-full" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M48 64c-26.5 0-48 21.5-48 48 0 15.1 7.1 29.3 19.2 38.4l208 156c17.1 12.8 40.5 12.8 57.6 0l208-156c12.1-9.1 19.2-23.3 19.2-38.4 0-26.5-21.5-48-48-48L48 64zM0 196L0 384c0 35.3 28.7 64 64 64l384 0c35.3 0 64-28.7 64-64l0-188-198.4 148.8c-34.1 25.6-81.1 25.6-115.2 0L0 196z" />
  </svg>
);

// El icono es el botón: sin círculo, en latón y con sombra para que se vea sobre la cámara.
// Escondido no recibe el ratón (se pulsa el cuadro de debajo).
const botonCuadro =
  'pointer-events-none flex aspect-square shrink-0 items-center justify-center rounded-[3px] text-gold-bright opacity-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] transition-opacity hover:brightness-125 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-main group-focus-within/llamada:pointer-events-auto group-focus-within/llamada:opacity-100 motion-reduce:transition-none [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100';
/** Cuándo se ven, además: estilo botc.app, al pulsar Intro; si no, al pasar el ratón por el sitio de esa persona. */
const seVen = {
  botc: 'group-data-[visibles=true]/llamada:pointer-events-auto group-data-[visibles=true]/llamada:opacity-100',
  normal: 'group-hover:pointer-events-auto group-hover:opacity-100',
};

interface BotonesEnCuadroProps extends Pick<ContactoParticipante, 'onMensaje' | 'conversar'> {
  nombre: string;
  /** Rótulo encima del cuadro (narradores): la capa empieza debajo de él. */
  bajoRotulo?: boolean;
  /** Hay otro botón en el centro del retrato (pedir el grimorio): estos van abajo. */
  abajo?: boolean;
}

/**
 * Mandar un mensaje de texto y conversar (voz y vídeo en privado) con alguien,
 * en grande dentro de su cuadro (encima de su retrato o su cámara). Solo salen
 * los que se pueden usar. Se ven al pasar el ratón por su sitio (la clase group
 * la pone quien los usa) o, con la llamada estilo botc.app, al pulsar Intro (y
 * al usar uno, se esconden); también con el foco en ellos y, en pantallas
 * táctiles, siempre. Para el lector están siempre, después del nombre.
 */
export const BotonesEnCuadro = ({ nombre, onMensaje, conversar, bajoRotulo = false, abajo = false }: BotonesEnCuadroProps) => {
  const { activa, visibles, ocultar } = useLlamadaBotc();
  if (!onMensaje && !conversar) return null;
  // Cada icono, siempre del mismo tamaño (haya uno o los dos): los dos con su hueco
  // llenan el ancho del marco (46 + 8 + 46, dentro de los márgenes); uno solo, centrado
  const ancho = 'w-[46%]';
  const boton = `${botonCuadro} ${ancho} ${activa ? seVen.botc : seVen.normal}`;
  const usar = (hacer?: () => void) => () => {
    if (activa) ocultar();
    hacer?.();
  };
  const llamar = conversar && (
    <button
      type="button"
      onClick={conversar.pendiente ? undefined : usar(conversar.onIniciar)}
      aria-label={conversar.etiqueta}
      aria-disabled={conversar.pendiente}
      className={`${boton} aria-disabled:cursor-default aria-disabled:text-on-surface-muted`}
    >
      {/* Llamar (voz y vídeo en privado); unirse a la que ya tiene, entrar */}
      {conversar.unirse ? (
        <LogIn className="h-full w-full" strokeWidth={2.25} />
      ) : activa ? (
        <IconoLlamadaBotc />
      ) : (
        <Phone className="h-full w-full" strokeWidth={2.25} />
      )}
    </button>
  );
  const escribir = onMensaje && (
    <button type="button" onClick={usar(onMensaje)} aria-label={`Mandar un mensaje a ${nombre}`} className={boton}>
      {activa ? <IconoMensajeBotc /> : <MessageSquare className="h-full w-full" strokeWidth={2.25} />}
    </button>
  );
  return (
    <div
      data-iconos-llamada
      data-visibles={activa && visibles}
      className={`group/llamada pointer-events-none absolute inset-x-0 ${bajoRotulo ? 'top-5' : 'top-0'} z-[25] flex aspect-square justify-center gap-[8%] px-[4%] ${
        abajo ? 'items-end pb-[4%]' : 'items-center'
      }`}
    >
      {/* Como en botc.app, llamar primero; si no, como antes junto al nombre, el mensaje primero */}
      {activa ? (
        <>
          {llamar}
          {escribir}
        </>
      ) : (
        <>
          {escribir}
          {llamar}
        </>
      )}
    </div>
  );
};

/**
 * Pegado al final de un texto (detrás de su última palabra), sin ocupar sitio:
 * un ancla de ancho cero de la que cuelgan los botones. El texto se parte en
 * líneas como si no estuvieran; si al final de la línea no caben, se salen por
 * la derecha (por encima de lo que haya, para que se puedan pulsar).
 */
export const JuntoAlTexto = ({ children }: { children: ReactNode }) => (
  <span className="relative inline-block h-[1em] w-0 align-middle">
    {/* El relleno (y no un margen) hace que el ratón no salga del grupo al ir hacia ellos */}
    <span className="absolute left-0 top-1/2 z-10 -translate-y-1/2 whitespace-nowrap pl-1">{children}</span>
  </span>
);

export default BotonesContacto;
