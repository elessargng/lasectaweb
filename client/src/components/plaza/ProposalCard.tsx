import { Link } from 'react-router-dom';
import {
  MessageSquare,
  Scroll,
  Handshake,
  EyeOff,
  Clock,
  Check,
  X,
  FilePlus2,
  FilePenLine,
  FileX2
} from 'lucide-react';
import { daysRemaining, type ProposalListItem } from '../../utils/plazaApi';

/**
 * Tarjeta de propuesta en el listado de La Plaza.
 *
 * Muestra de un vistazo lo que hace falta para decidir si entrar: qué se vota,
 * de qué clase es, si es secreta y cuánto queda.
 */
const ProposalCard = ({ proposal }: { proposal: ProposalListItem }) => {
  const isOpen = proposal.status === 'abierta';
  const days = daysRemaining(proposal.deadlineAt);

  return (
    <Link
      to={`/plaza/${proposal.id}`}
      className="block border border-outline-ghost bg-surface hover:border-theme-main/40 rounded p-5 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-theme-main"
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] font-display text-on-surface-muted">
          {/* Para un edicto se dice qué le hace al Códice, que es más informativo
              que la etiqueta genérica. */}
          {proposal.targetAction === 'crear' ? (
            <>
              <FilePlus2 className="w-3.5 h-3.5 text-theme-main" /> Edicto nuevo
            </>
          ) : proposal.targetAction === 'modificar' ? (
            <>
              <FilePenLine className="w-3.5 h-3.5 text-theme-main" /> Modifica{' '}
              {proposal.targetReference ?? 'una norma'}
            </>
          ) : proposal.targetAction === 'derogar' ? (
            <>
              <FileX2 className="w-3.5 h-3.5 text-red-400" /> Deroga{' '}
              {proposal.targetReference ?? 'una norma'}
            </>
          ) : proposal.kind === 'edicto' ? (
            <>
              <Scroll className="w-3.5 h-3.5 text-theme-main" /> Edicto
            </>
          ) : (
            <>
              <Handshake className="w-3.5 h-3.5 text-theme-main" /> Acuerdo
            </>
          )}
        </span>

        {isOpen ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-on-surface-muted shrink-0">
            <Clock className="w-3.5 h-3.5" />
            {days === 0 ? 'Último día' : `${days} ${days === 1 ? 'día' : 'días'}`}
          </span>
        ) : (
          <span
            className={`inline-flex items-center gap-1.5 text-xs shrink-0 ${
              proposal.status === 'aprobada' ? 'text-green-500' : 'text-red-400'
            }`}
          >
            {proposal.status === 'aprobada' ? (
              <>
                <Check className="w-3.5 h-3.5" /> Aprobado
              </>
            ) : (
              <>
                <X className="w-3.5 h-3.5" /> Rechazado
              </>
            )}
          </span>
        )}
      </div>

      <h3 className="font-display text-lg text-on-surface leading-snug mb-2">{proposal.title}</h3>

      {proposal.description && (
        <p className="text-sm text-on-surface-muted leading-relaxed line-clamp-2 mb-4">
          {proposal.description}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-on-surface-muted pt-3 border-t border-outline-ghost">
        <span>Propone {proposal.authorUsername}</span>

        {proposal.commentCount > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            {proposal.commentCount}
          </span>
        )}

        {proposal.mode === 'secreto' && (
          <span className="inline-flex items-center gap-1.5 text-red-400/80">
            <EyeOff className="w-3.5 h-3.5" /> Secreta
          </span>
        )}
      </div>
    </Link>
  );
};

export default ProposalCard;
