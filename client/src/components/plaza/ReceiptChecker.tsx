import { useState } from 'react';
import { Search, AlertTriangle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import Button from '../Button';
import { checkReceipt, type ProposalMode, type ReceiptResult } from '../../utils/plazaApi';

interface ReceiptCheckerProps {
  proposalId: string;
  mode: ProposalMode;
  /** Si la votación sigue abierta. En modo secreto determina si anular tiene efecto. */
  isOpen: boolean;
  /** Se llama tras anular, para que la página recargue el recuento. */
  onAnnulled?: () => void;
}

/**
 * Caja de comprobación de sellos.
 *
 * En modo secreto, comprobar el voto lo anula, así que se pide confirmación
 * explícita antes de llamar al servidor. Sin ese paso, la gente anularía su
 * voto por curiosidad sin entender qué acaba de hacer.
 */
const ReceiptChecker = ({ proposalId, mode, isOpen, onAnnulled }: ReceiptCheckerProps) => {
  const [seal, setSeal] = useState('');
  const [result, setResult] = useState<ReceiptResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);

  // La anulación solo ocurre en modo secreto y con la votación abierta: si ya
  // está cerrada, comprobar no destruye nada.
  const willAnnul = mode === 'secreto' && isOpen;

  const submit = async () => {
    if (!seal.trim()) return;

    // En modo secreto se pide confirmación antes de tocar nada.
    if (willAnnul && !confirming) {
      setConfirming(true);
      return;
    }

    setLoading(true);
    setError('');
    setConfirming(false);

    try {
      const res = await checkReceipt(proposalId, seal);
      setResult(res);
      if (res.anulado && onAnnulled) {
        // El turno de voto se recupera unos segundos después, así que la
        // recarga se hace cuando esa segunda fase ha terminado.
        res.turnoRecuperado?.then(onAnnulled) ?? onAnnulled();
      }
    } catch (err: any) {
      setError(err.message || 'No se pudo comprobar el sello.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setSeal('');
    setError('');
    setConfirming(false);
  };

  return (
    <div className="border border-outline-ghost bg-surface-container-low rounded p-5 md:p-6">
      <h3 className="font-display text-lg text-on-surface mb-2 flex items-center gap-2">
        <Search className="w-5 h-5 text-theme-main" />
        ¿Quieres comprobar tu voto?
      </h3>

      <p className="text-sm text-on-surface-muted leading-relaxed mb-4">
        Escribe las palabras de tu sello. No importan las mayúsculas ni los guiones.
      </p>

      {willAnnul && !result && (
        <div className="border border-red-900/60 bg-red-950/30 rounded p-4 mb-4">
          <p className="flex items-start gap-2 text-sm text-on-surface leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>
              Esta votación es <strong className="text-red-400">secreta</strong>: al comprobar tu
              voto verás lo que votaste, pero <strong>ese voto se anulará</strong>. Podrás votar de
              nuevo mientras la votación siga abierta.
            </span>
          </p>
        </div>
      )}

      {!result && (
        <>
          <input
            type="text"
            value={seal}
            onChange={(e) => {
              setSeal(e.target.value);
              setConfirming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
            placeholder="CUERVO LUNAR SIETE SELLADO"
            aria-label="Palabras de tu sello"
            className="w-full bg-surface-container border border-outline-ghost rounded px-4 py-3 text-on-surface font-display tracking-wider placeholder:text-on-surface-muted/40 placeholder:tracking-normal placeholder:font-body focus:outline-none focus:border-theme-main/60 transition-colors"
          />

          {confirming ? (
            <div className="mt-4 border border-red-900/60 bg-red-950/40 rounded p-4">
              <p className="text-sm text-on-surface mb-4 leading-relaxed">
                <strong className="text-red-400">Si continúas, tu voto se anulará</strong> y no se
                contará. Podrás volver a votar mientras la votación siga abierta. ¿Seguro que
                quieres comprobarlo?
              </p>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => setConfirming(false)} className="px-4 py-2">
                  Cancelar
                </Button>
                <Button variant="danger" onClick={submit} disabled={loading} className="px-4 py-2">
                  {loading ? 'Comprobando…' : 'Sí, comprobar y anular mi voto'}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="primary"
              onClick={submit}
              disabled={loading || !seal.trim()}
              className="mt-4 px-6 py-2.5"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Comprobando…
                </span>
              ) : (
                'Comprobar mi voto'
              )}
            </Button>
          )}
        </>
      )}

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {result && (
        <div className="mt-2">
          {result.encontrado ? (
            <div
              className={`rounded p-4 border ${
                result.anulado
                  ? 'border-red-900/60 bg-red-950/30'
                  : 'border-green-900/60 bg-green-950/30'
              }`}
            >
              <p className="flex items-start gap-2.5 text-on-surface">
                {result.anulado ? (
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                )}
                <span className="leading-relaxed">
                  <strong className="font-display">
                    Voto {result.voto === 'si' ? 'a favor' : 'en contra'}.
                  </strong>{' '}
                  {result.sellado && (
                    <span className="text-on-surface-muted">
                      Registrado y sellado el{' '}
                      {new Date(result.sellado).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'long'
                      })}
                      .
                    </span>
                  )}
                  {result.anulado && (
                    <>
                      <br />
                      <span className="text-red-400">
                        Este voto ha quedado anulado y ya no cuenta.
                        {result.puedeVolverAVotar && ' Puedes volver a votar más abajo.'}
                      </span>
                    </>
                  )}
                </span>
              </p>
            </div>
          ) : (
            <div className="rounded p-4 border border-yellow-900/60 bg-yellow-950/20">
              <p className="flex items-start gap-2.5 text-on-surface leading-relaxed">
                <XCircle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                <span>
                  <strong className="font-display">Este sello no consta en el registro.</strong>{' '}
                  <span className="text-on-surface-muted">
                    Comprueba las palabras, y si son correctas avisa en La Plaza.
                  </span>
                </span>
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={reset}
            className="mt-4 text-sm text-on-surface-muted hover:text-theme-main transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-theme-main rounded px-1"
          >
            Comprobar otro sello
          </button>
        </div>
      )}
    </div>
  );
};

export default ReceiptChecker;
