import { AudioLines, MessageSquare } from 'lucide-react';

/** Lo que se puede hacer con alguien desde su nombre: escribirle y conversar (si se puede). */
export interface ContactoParticipante {
  onMensaje?: () => void;
  /**
   * Invitar a conversar («Invitar a Ana a conversar»), escuchar su conversación
   * (visitantes) o, con una invitación ya enviada, pendiente (desactivado).
   */
  conversar?: { etiqueta: string; onIniciar?: () => void; pendiente?: boolean };
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
const BotonesContacto = ({ nombre, onMensaje, conversar }: BotonesContactoProps) => {
  if (!onMensaje && !conversar) return null;
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
          <AudioLines size={13} />
        </button>
      )}
    </span>
  );
};

export default BotonesContacto;
