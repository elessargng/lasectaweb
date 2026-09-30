import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import Button from '../Button';
import type { VoteChoice, ProposalMode } from '../../utils/plazaApi';

interface VoteConfirmModalProps {
  choice: VoteChoice | null;
  proposalTitle: string;
  mode: ProposalMode;
  voting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmación antes de emitir el voto.
 *
 * El voto es difícil de deshacer —en modo normal no se puede cambiar, y en modo
 * secreto solo anulándolo al comprobarlo—, así que conviene un paso intermedio
 * que diga en qué sentido se va a votar y qué implica.
 */
const VoteConfirmModal = ({
  choice,
  proposalTitle,
  mode,
  voting,
  onConfirm,
  onCancel
}: VoteConfirmModalProps) => {
  // Cerrar con Escape, salvo mientras se está enviando el voto.
  useEffect(() => {
    if (!choice) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !voting) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choice, voting, onCancel]);

  if (!choice) return null;

  const inFavour = choice === 'si';

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-8"
      onClick={() => !voting && onCancel()}
      role="dialog"
      aria-modal="true"
      aria-label="Confirmar el voto"
    >
      <div
        className="w-full max-w-md bg-surface border border-outline-ghost rounded shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <p
          className={`flex items-center gap-2.5 font-display text-lg mb-4 ${
            inFavour ? 'text-green-500' : 'text-red-400'
          }`}
        >
          {inFavour ? (
            <ThumbsUp className="w-5 h-5 shrink-0" />
          ) : (
            <ThumbsDown className="w-5 h-5 shrink-0" />
          )}
          Vas a votar {inFavour ? 'a favor' : 'en contra'}
        </p>

        <p className="text-on-surface leading-relaxed mb-4">«{proposalTitle}»</p>

        <div className="border border-outline-ghost bg-surface-container-low rounded p-4 mb-6">
          <p className="text-sm text-on-surface-muted leading-relaxed">
            {mode === 'secreto' ? (
              <>
                Recibirás un sello para poder comprobar tu voto. Al ser una votación{' '}
                <strong className="text-red-400">secreta</strong>, comprobarlo lo anulará y tendrás
                que votar de nuevo.
              </>
            ) : (
              <>
                Recibirás un sello para poder comprobar tu voto cuando quieras.{' '}
                <strong className="text-on-surface">No podrás cambiarlo</strong> una vez emitido.
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            variant={inFavour ? 'success' : 'danger'}
            onClick={onConfirm}
            disabled={voting}
            className="px-6 py-2.5"
          >
            {voting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Votando…
              </span>
            ) : (
              `Sí, votar ${inFavour ? 'a favor' : 'en contra'}`
            )}
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={voting} className="px-6 py-2.5">
            Cancelar
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default VoteConfirmModal;
