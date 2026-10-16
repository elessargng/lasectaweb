import { useEffect, useRef, type ReactNode } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

interface DialogProps {
  /** Se llama al pulsar Escape. */
  onClose: () => void;
  /** id del título visible del diálogo; si no lo hay, `label`. */
  labelledBy?: string;
  label?: string;
  /** id de lo que lo describe (se lee al abrirlo, tras el título). */
  describedBy?: string;
  className?: string;
  children: ReactNode;
}

/**
 * La caja de un modal, accesible con teclado y lector de pantalla: al abrirse
 * se lleva el foco (y el lector anuncia el diálogo con su título), el
 * tabulador no sale de ella, Escape la cierra y, al cerrarse, el foco vuelve
 * a donde estaba. Se monta solo mientras el modal está abierto.
 */
const Dialog = ({ onClose, labelledBy, label, describedBy, className = '', children }: DialogProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = ref.current!;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === dialog || !dialog.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !dialog.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      aria-describedby={describedBy}
      tabIndex={-1}
      className={`focus:outline-none ${className}`}
    >
      {children}
    </div>
  );
};

export default Dialog;
