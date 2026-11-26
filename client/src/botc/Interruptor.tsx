import type { ReactNode } from 'react';

interface InterruptorProps {
  id?: string;
  /** El nombre del interruptor (lo que se activa). */
  children: ReactNode;
  activo: boolean;
  onCambiar: (activo: boolean) => void;
  /** id de lo que lo explica (se lee como descripción). */
  describedBy?: string;
  /** En un formulario: su nombre y si hay que activarlo para enviarlo. */
  name?: string;
  required?: boolean;
  /** El texto ocupa varias líneas: el interruptor, a la altura de la primera. */
  arriba?: boolean;
  /** Clases del texto (por defecto, el de la interfaz de la sala). */
  textoClassName?: string;
}

/**
 * Una casilla con aspecto de interruptor: para el lector, un interruptor
 * (role="switch") que dice si está activado. Toda la fila se pulsa. Es el que
 * se usa para todo lo que se activa o se desactiva (no hay casillas sueltas).
 */
const Interruptor = ({
  id,
  children,
  activo,
  onCambiar,
  describedBy,
  name,
  required,
  arriba = false,
  textoClassName = 'font-ui text-sm',
}: InterruptorProps) => (
  <label className={`flex cursor-pointer gap-3 ${arriba ? 'items-start' : 'items-center'}`}>
    <input
      id={id}
      type="checkbox"
      role="switch"
      name={name}
      required={required}
      checked={activo}
      onChange={(e) => onCambiar(e.target.checked)}
      aria-describedby={describedBy}
      className="peer sr-only"
    />
    <span
      aria-hidden="true"
      className={`relative h-5 w-9 shrink-0 rounded-full border border-outline-ghost bg-background transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-3.5 after:w-3.5 after:rounded-full after:bg-on-surface-muted after:transition-transform peer-checked:border-theme-main peer-checked:bg-theme-container peer-checked:after:translate-x-4 peer-checked:after:bg-theme-main peer-focus-visible:ring-2 peer-focus-visible:ring-theme-main motion-reduce:transition-none motion-reduce:after:transition-none ${
        arriba ? 'mt-0.5' : ''
      }`}
    />
    <span className={textoClassName}>{children}</span>
  </label>
);

export default Interruptor;
