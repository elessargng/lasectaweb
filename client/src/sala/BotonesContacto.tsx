import { AudioLines, LogIn, MessageSquare } from 'lucide-react';

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

const boton =
  'flex h-6 w-6 items-center justify-center rounded-full border border-theme-main/70 bg-surface text-theme-main hover:bg-theme-container focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main';

/**
 * Junto al nombre de alguien (no sobre el retrato, que pueden tapar las fichas):
 * mandarle un mensaje de texto y conversar con él (voz y vídeo en privado). Solo
 * salen los que se pueden usar. Se ven al pasar el ratón por su sitio (la clase
 * group la pone quien los usa) o con el foco en ellos; en pantallas táctiles,
 * siempre. Para el lector están siempre, justo después del nombre.
 */
const BotonesContacto = ({ nombre, onMensaje, conversar, vigilar }: BotonesContactoProps) => {
  if (!onMensaje && !conversar && !vigilar) return null;
  return (
    <span className="inline-flex shrink-0 gap-1 align-middle opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100">
      {onMensaje && (
        <button type="button" onClick={onMensaje} aria-label={`Mandar un mensaje a ${nombre}`} className={boton}>
          <MessageSquare size={13} />
        </button>
      )}
      {conversar && (
        <button
          type="button"
          onClick={conversar.pendiente ? undefined : conversar.onIniciar}
          aria-label={conversar.etiqueta}
          aria-disabled={conversar.pendiente}
          className={`${boton} aria-disabled:cursor-default aria-disabled:opacity-50`}
        >
          {conversar.unirse ? <LogIn size={13} /> : <AudioLines size={13} />}
        </button>
      )}
      {vigilar && (
        // Solo para el lector: no se ve salvo con el foco del teclado (para que el foco no se pierda)
        <button
          type="button"
          onClick={vigilar.onAlternar}
          className="sr-only rounded-full border border-theme-main/70 bg-surface px-2 text-xs text-theme-main focus:not-sr-only focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main"
        >
          {vigilar.activo ? `Dejar de vigilar a ${nombre}` : `Vigilar a ${nombre}`}
        </button>
      )}
    </span>
  );
};

export default BotonesContacto;
