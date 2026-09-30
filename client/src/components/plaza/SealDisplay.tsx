import { useState } from 'react';
import { Copy, Check, ShieldCheck } from 'lucide-react';

interface SealDisplayProps {
  seal: string;
  /** Aviso de que el sello no se envía por correo. Se muestra al votar. */
  showWarning?: boolean;
}

/**
 * Muestra el sello de un voto: las cuatro palabras que identifican el voto.
 *
 * Son palabras y no un código hexadecimal porque tienen que servirle a todo el
 * mundo: se pueden leer en voz alta, apuntar en un papel o dictar por teléfono.
 */
const SealDisplay = ({ seal, showWarning = false }: SealDisplayProps) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(seal);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin portapapeles disponible: el sello se puede copiar a mano, que es
      // justamente para lo que está pensado.
    }
  };

  const words = seal.split(' ');

  return (
    <div className="border border-theme-main/40 bg-theme-container/30 rounded p-6 text-center">
      <p className="flex items-center justify-center gap-2 text-xs uppercase tracking-[0.2em] text-on-surface-muted font-display mb-4">
        <ShieldCheck className="w-4 h-4 text-theme-main" />
        Tu voto ha quedado sellado como
      </p>

      <p className="font-display text-theme-main text-xl md:text-2xl font-bold tracking-wider leading-relaxed mb-4 break-words">
        {words.map((word, i) => (
          <span key={i}>
            {word}
            {i < words.length - 1 && <span className="text-theme-main/40 mx-1.5">·</span>}
          </span>
        ))}
      </p>

      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-2 text-sm text-on-surface-muted hover:text-theme-main transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-theme-main rounded px-2 py-1"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4 text-green-500" /> Copiado
          </>
        ) : (
          <>
            <Copy className="w-4 h-4" /> Copiar el sello
          </>
        )}
      </button>

      {showWarning && (
        <p className="mt-5 pt-4 border-t border-outline-ghost text-sm text-on-surface-muted leading-relaxed">
          Apunta estas palabras si quieres poder comprobar tu voto más adelante.
          <br />
          <span className="text-on-surface-muted/70">
            No te lo enviamos por correo a propósito: así el sello solo lo tienes tú.
          </span>
        </p>
      )}
    </div>
  );
};

export default SealDisplay;
