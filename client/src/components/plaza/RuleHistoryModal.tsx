import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { X, Loader2, History, Vote, Landmark, ExternalLink } from 'lucide-react';
import { getRuleHistory, formatDate, type RuleHistory } from '../../utils/plazaApi';

interface RuleHistoryModalProps {
  ruleId: string | null;
  onClose: () => void;
}

/**
 * Histórico de una norma: todas sus versiones, la más reciente primero, y la
 * votación que aprobó cada una.
 *
 * Las versiones fundacionales —anteriores a La Plaza— no tienen votación, y se
 * marcan como tal en lugar de dejar el hueco vacío.
 */
const RuleHistoryModal = ({ ruleId, onClose }: RuleHistoryModalProps) => {
  const [history, setHistory] = useState<RuleHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ruleId) {
      setHistory(null);
      return;
    }
    setLoading(true);
    setError('');
    getRuleHistory(ruleId)
      .then(setHistory)
      .catch((err) => setError(err.message || 'No se pudo cargar el histórico.'))
      .finally(() => setLoading(false));
  }, [ruleId]);

  // Cerrar con Escape, como cualquier modal.
  useEffect(() => {
    if (!ruleId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ruleId, onClose]);

  if (!ruleId) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 px-4 py-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Histórico de la norma"
    >
      <div
        className="w-full max-w-2xl bg-surface border border-outline-ghost rounded shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-5 border-b border-outline-ghost">
          <div>
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] font-display text-on-surface-muted mb-1">
              <History className="w-3.5 h-3.5 text-theme-main" />
              Histórico
            </p>
            {history && (
              <h3 className="font-display text-lg text-on-surface">
                Norma {history.reference}
                <span className="text-on-surface-muted text-sm font-body ml-2">
                  · {history.sectionNumber}. {history.sectionTitle}
                </span>
              </h3>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-on-surface-muted hover:text-on-surface transition-colors shrink-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-theme-main rounded p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {loading && (
            <div className="flex justify-center py-10 text-on-surface-muted">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          )}

          {error && <p className="text-sm text-red-400 py-4">{error}</p>}

          {history && !loading && (
            <>
              {history.repealedAt && (
                <div className="border border-red-900/60 bg-red-950/25 rounded p-3 mb-5">
                  <p className="text-sm text-on-surface">
                    <strong className="text-red-400">Norma derogada</strong> el{' '}
                    {formatDate(history.repealedAt)}. Ya no está en vigor.
                  </p>
                </div>
              )}

              <ol className="space-y-4">
                {history.versions.map((version, index) => {
                  const isCurrent = index === 0 && !history.repealedAt;
                  return (
                    <li
                      key={version.id}
                      className={`border rounded p-4 ${
                        isCurrent
                          ? 'border-theme-main/50 bg-theme-container/20'
                          : 'border-outline-ghost bg-surface-container-low'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-3">
                        <span className="text-xs uppercase tracking-[0.14em] font-display text-on-surface-muted">
                          Versión {version.version}
                        </span>
                        {isCurrent && (
                          <span className="text-xs uppercase tracking-[0.14em] font-display text-theme-main">
                            En vigor
                          </span>
                        )}
                        <span className="text-xs text-on-surface-muted">
                          {formatDate(version.createdAt)}
                        </span>
                      </div>

                      <p className="text-on-surface leading-relaxed mb-3">{version.body}</p>

                      {version.bullets.length > 0 && (
                        <ul className="list-disc list-inside pl-3 space-y-1 mb-3 text-on-surface/90">
                          {version.bullets.map((bullet, i) => (
                            <li key={i} className="leading-relaxed">
                              {bullet}
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* De dónde viene esta versión */}
                      <div className="pt-3 border-t border-outline-ghost">
                        {version.origin === 'fundacional' ? (
                          <p className="flex items-start gap-2 text-sm text-on-surface-muted">
                            <Landmark className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>
                              Norma vigente desde antes de La Plaza, así que no hay votación
                              asociada.
                            </span>
                          </p>
                        ) : version.proposalId ? (
                          <div className="text-sm">
                            <p className="flex items-start gap-2 text-on-surface-muted mb-1.5">
                              <Vote className="w-4 h-4 shrink-0 mt-0.5 text-theme-main" />
                              <span>
                                Aprobada en la votación{' '}
                                <Link
                                  to={`/plaza/${version.proposalId}`}
                                  className="text-theme-main hover:underline inline-flex items-center gap-1"
                                  onClick={onClose}
                                >
                                  {version.proposalTitle ?? 'ver la votación'}
                                  <ExternalLink className="w-3 h-3" />
                                </Link>
                                {version.proposalClosedAt &&
                                  `, cerrada el ${formatDate(version.proposalClosedAt)}`}
                              </span>
                            </p>
                            {version.proposalFinalHash && (
                              <p className="font-mono text-xs text-on-surface-muted/70 break-all pl-6">
                                Huella: {version.proposalFinalHash}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-on-surface-muted">
                            {version.changeNote ?? 'Sin votación registrada.'}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default RuleHistoryModal;
