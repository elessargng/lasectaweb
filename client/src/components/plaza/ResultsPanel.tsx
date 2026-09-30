import { useState } from 'react';
import { Download, FileCheck2, Loader2, ShieldCheck, ShieldAlert, Users } from 'lucide-react';
import Button from '../Button';
import {
  recordUrl,
  verifyProposal,
  formatDate,
  type Proposal,
  type Tally,
  type VerificationResult
} from '../../utils/plazaApi';

interface ResultsPanelProps {
  proposal: Proposal;
  tally: Tally;
  voters?: string[];
}

/**
 * Resultado de una votación cerrada, con todo lo necesario para comprobarlo.
 *
 * La lista de votantes se publica al cerrar (no durante): permite cuadrar el
 * recuento con personas reales sin revelar el voto de nadie.
 */
const ResultsPanel = ({ proposal, tally, voters }: ResultsPanelProps) => {
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  const approved = proposal.status === 'aprobada';
  const totalVotes = tally.si + tally.no;
  const pctSi = totalVotes > 0 ? (tally.si / totalVotes) * 100 : 0;
  const pctNo = totalVotes > 0 ? (tally.no / totalVotes) * 100 : 0;

  const runVerification = async () => {
    setVerifying(true);
    try {
      setVerification(await verifyProposal(proposal.id));
    } catch {
      setVerification({
        ok: false,
        proposalId: proposal.id,
        entriesChecked: 0,
        problem: 'No se pudo contactar con el servidor para verificar.'
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="border border-outline-ghost bg-surface-container-low rounded p-5 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3 pb-4 mb-5 border-b border-outline-ghost">
        <h3 className="font-display text-lg text-on-surface">Resultado</h3>
        <span
          className={`text-xs uppercase tracking-[0.14em] font-display ${
            approved ? 'text-green-500' : 'text-red-400'
          }`}
        >
          {approved ? 'Aprobado' : 'Rechazado'}
          {proposal.closeReason === 'via_rapida' && ' por vía rápida'}
          {proposal.closeReason === 'plazo' && ' al vencer el plazo'}
        </span>
      </div>

      {/* Recuento */}
      <div className="space-y-3 mb-5">
        <div className="flex items-baseline gap-3">
          <span className="text-sm text-on-surface-muted w-20 shrink-0">A favor</span>
          <span className="flex-1 h-2 bg-surface-container-high rounded-sm overflow-hidden">
            <span
              className="block h-full bg-theme-main"
              style={{ width: `${pctSi}%` }}
              role="presentation"
            />
          </span>
          <span className="text-on-surface tabular-nums w-8 text-right">{tally.si}</span>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-sm text-on-surface-muted w-20 shrink-0">En contra</span>
          <span className="flex-1 h-2 bg-surface-container-high rounded-sm overflow-hidden">
            <span
              className="block h-full bg-theme-container"
              style={{ width: `${pctNo}%` }}
              role="presentation"
            />
          </span>
          <span className="text-on-surface tabular-nums w-8 text-right">{tally.no}</span>
        </div>
      </div>

      {/* Cifras para cuadrar: votos vigentes = participantes - anulaciones sin revoto */}
      <p className="text-xs text-on-surface-muted font-display uppercase tracking-[0.12em] mb-2">
        {totalVotes} {totalVotes === 1 ? 'voto' : 'votos'} · {tally.participantes}{' '}
        {tally.participantes === 1 ? 'participante' : 'participantes'} ·{' '}
        {tally.anulacionesSinRevoto}{' '}
        {tally.anulacionesSinRevoto === 1 ? 'anulación' : 'anulaciones'}
      </p>
      {proposal.closedAt && (
        <p className="text-sm text-on-surface-muted mb-5">
          Cerrada el {formatDate(proposal.closedAt)}.
        </p>
      )}

      {/* Huella final */}
      {proposal.finalHash && (
        <div className="mb-5">
          <p className="text-xs uppercase tracking-[0.16em] text-on-surface-muted font-display mb-2">
            Huella final
          </p>
          <p className="font-mono text-xs bg-surface-container-high rounded px-3 py-2.5 text-theme-main break-all">
            {proposal.finalHash}
          </p>
          <p className="text-xs text-on-surface-muted mt-2 leading-relaxed">
            Guarda esta huella. Si vuelves más adelante y sigue siendo la misma, el registro no ha
            cambiado.
          </p>
        </div>
      )}

      {/* Lista de votantes */}
      {voters && voters.length > 0 && (
        <div className="mb-5 pt-4 border-t border-outline-ghost">
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-on-surface-muted font-display mb-2">
            <Users className="w-3.5 h-3.5" />
            Participaron
          </p>
          <p className="text-sm text-on-surface leading-relaxed">{voters.join(', ')}</p>
          <p className="text-xs text-on-surface-muted mt-2 leading-relaxed">
            La lista dice quién participó, nunca qué votó cada cual.
          </p>

          {/* El censo no se comprueba automáticamente: lo audita la comunidad. */}
          <div className="mt-4 border-l-2 border-theme-container pl-3.5">
            <p className="text-sm text-on-surface-muted leading-relaxed">
              <strong className="text-on-surface font-display">Échale un ojo.</strong> El Códice
              pide haber jugado en La Secta en los últimos 60 días para votar, y eso no lo
              comprueba ningún automatismo: es responsabilidad de cada cual al votar, y de la
              comunidad al revisar la lista. Si ves un nombre que no reconoces, o alguien que no
              debería estar, dilo en los comentarios.
            </p>
          </div>
        </div>
      )}

      {/* Auditoría */}
      <div className="pt-4 border-t border-outline-ghost">
        <p className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-on-surface-muted font-display mb-2">
          <FileCheck2 className="w-3.5 h-3.5" />
          Auditar esta votación
        </p>
        <p className="text-sm text-on-surface-muted leading-relaxed mb-4">
          Auditar una votación al cerrarse es sano, y cualquiera puede hacerlo: contar los votos,
          repasar quién participó y comprobar que las cifras cuadran. El registro se descarga
          completo y se comprueba sin depender de esta web.
        </p>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            href={recordUrl(proposal.id, true)}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-sm"
          >
            <span className="inline-flex items-center gap-2">
              <Download className="w-4 h-4" /> Descargar el registro
            </span>
          </Button>

          <Button
            variant="outline"
            onClick={runVerification}
            disabled={verifying}
            className="px-4 py-2 text-sm"
          >
            <span className="inline-flex items-center gap-2">
              {verifying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileCheck2 className="w-4 h-4" />
              )}
              {verifying ? 'Comprobando…' : 'Comprobar ahora'}
            </span>
          </Button>
        </div>

        {verification && (
          <div
            className={`mt-4 rounded p-4 border ${
              verification.ok
                ? 'border-green-900/60 bg-green-950/30'
                : 'border-red-900/60 bg-red-950/30'
            }`}
          >
            <p className="flex items-start gap-2.5 text-on-surface leading-relaxed">
              {verification.ok ? (
                <ShieldCheck className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              )}
              <span>
                {verification.ok ? (
                  <>
                    <strong className="font-display">El registro es íntegro.</strong>{' '}
                    <span className="text-on-surface-muted">
                      Se han comprobado {verification.entriesChecked} entradas y las cuentas salen.
                    </span>
                  </>
                ) : (
                  <>
                    <strong className="font-display text-red-400">Algo no cuadra.</strong>{' '}
                    <span className="text-on-surface-muted">{verification.problem}</span>
                  </>
                )}
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultsPanel;
