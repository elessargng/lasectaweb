import { FilePlus2, FilePenLine, FileX2, ArrowDown, CheckCircle2 } from 'lucide-react';
import type { ProposedChange as Change } from '../../utils/plazaApi';

/**
 * El cambio que una propuesta hará en el Códice si se aprueba.
 *
 * Es la información que de verdad se está votando: el título dice qué se
 * pretende y la explicación por qué, pero solo aquí se ve el texto exacto que
 * quedará escrito. Sin esto se votaría a ciegas.
 */
const ProposedChange = ({ change }: { change: Change }) => {
  const { action } = change;

  const heading =
    action === 'crear'
      ? 'Se añadiría esta norma al Códice'
      : action === 'modificar'
        ? `Cambiaría la norma ${change.reference ?? ''}`.trim()
        : `Se derogaría la norma ${change.reference ?? ''}`.trim();

  const Icon = action === 'crear' ? FilePlus2 : action === 'modificar' ? FilePenLine : FileX2;

  const accent =
    action === 'derogar' ? 'border-red-900/60' : 'border-theme-main/40';

  return (
    <div className={`border ${accent} bg-surface-container-low rounded p-5 mb-6`}>
      <p className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] font-display text-on-surface-muted mb-4">
        <Icon
          className={`w-4 h-4 ${action === 'derogar' ? 'text-red-400' : 'text-theme-main'}`}
        />
        {heading}
      </p>

      {/* Modificación: lo que dice ahora y lo que diría, para poder comparar */}
      {action === 'modificar' && (
        <>
          <div className="border border-outline-ghost bg-surface-container rounded p-4 mb-3 opacity-75">
            <p className="text-xs uppercase tracking-[0.14em] font-display text-on-surface-muted mb-2">
              Dice ahora
              {change.currentVersion && change.currentVersion > 1 && (
                <span className="normal-case tracking-normal font-body ml-2">
                  (versión {change.currentVersion})
                </span>
              )}
            </p>
            <p className="text-on-surface-muted leading-relaxed line-through decoration-red-400/40">
              {change.currentBody}
            </p>
            {change.currentBullets && change.currentBullets.length > 0 && (
              <ul className="list-disc list-inside pl-3 mt-2 space-y-1 text-sm text-on-surface-muted">
                {change.currentBullets.map((bullet, i) => (
                  <li key={i} className="leading-relaxed line-through decoration-red-400/40">
                    {bullet}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex justify-center mb-3" aria-hidden="true">
            <ArrowDown className="w-4 h-4 text-theme-main" />
          </div>
        </>
      )}

      {/* El texto propuesto (o el que se derogaría) */}
      {action === 'derogar' ? (
        <div className="border border-red-900/50 bg-red-950/20 rounded p-4">
          <p className="text-xs uppercase tracking-[0.14em] font-display text-red-400 mb-2">
            Dejaría de estar en vigor
          </p>
          <p className="text-on-surface-muted leading-relaxed line-through decoration-red-400/40">
            {change.currentBody}
          </p>
          {change.currentBullets && change.currentBullets.length > 0 && (
            <ul className="list-disc list-inside pl-3 mt-2 space-y-1 text-sm text-on-surface-muted">
              {change.currentBullets.map((bullet, i) => (
                <li key={i} className="leading-relaxed line-through decoration-red-400/40">
                  {bullet}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-on-surface-muted mt-3">
            Su histórico se conservaría, consultable desde el Códice.
          </p>
        </div>
      ) : (
        <div className="border border-theme-main/40 bg-theme-container/20 rounded p-4">
          <p className="text-xs uppercase tracking-[0.14em] font-display text-theme-main mb-2">
            {action === 'modificar' ? 'Pasaría a decir' : 'Texto de la norma'}
            {action === 'crear' && change.sectionNumber !== undefined && (
              <span className="normal-case tracking-normal font-body text-on-surface-muted ml-2">
                (en {change.sectionNumber}. {change.sectionTitle})
              </span>
            )}
          </p>
          <p className="text-on-surface leading-relaxed">{change.proposedBody}</p>
          {change.proposedBullets.length > 0 && (
            <ul className="list-disc list-inside pl-3 mt-2 space-y-1 text-on-surface/90">
              {change.proposedBullets.map((bullet, i) => (
                <li key={i} className="leading-relaxed">
                  {bullet}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {change.appliedAt && (
        <p className="flex items-center gap-2 text-sm text-green-500 mt-4">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          El cambio ya está aplicado en el Códice.
        </p>
      )}
    </div>
  );
};

export default ProposedChange;
