import { useState, useEffect } from 'react';
import {
  Handshake,
  FilePlus2,
  FilePenLine,
  FileX2,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Trash2
} from 'lucide-react';
import Button from '../Button';
import {
  createProposal,
  getCodice,
  PLAZO_DIAS,
  VIA_RAPIDA_MIN_POSITIVOS,
  VIA_RAPIDA_MIN_DIAS,
  type ProposalMode,
  type TargetAction,
  type CodiceSection
} from '../../utils/plazaApi';

interface NewProposalFormProps {
  token: string;
  onCreated: (proposalId: string) => void;
  onCancel: () => void;
}

/**
 * Qué se está proponiendo. La clase (acuerdo o edicto) y qué le hace al Códice
 * son en realidad una sola decisión, no dos: un acuerdo puntual nunca toca las
 * normas, y un edicto siempre las toca de alguna manera —creando, modificando o
 * derogando—. Presentarlas por separado permitía combinaciones imposibles, como
 * un edicto que no cambia nada.
 */
type ProposalPurpose = 'acuerdo' | 'crear' | 'modificar' | 'derogar';

const PURPOSES: Array<{
  value: ProposalPurpose;
  label: string;
  icon: typeof Handshake;
  description: string;
  footnote: string;
}> = [
  {
    value: 'acuerdo',
    label: 'Un acuerdo puntual',
    icon: Handshake,
    description:
      'Algo concreto: una compra, una fecha, un gasto. Se aprueba, se ejecuta y queda en el archivo de acuerdos.',
    footnote: 'No cambia el Códice.'
  },
  {
    value: 'crear',
    label: 'Un edicto nuevo',
    icon: FilePlus2,
    description: 'Añade una norma que no existe al Códice, en la sección que le corresponda.',
    footnote: 'Permanece hasta que otro edicto la cambie.'
  },
  {
    value: 'modificar',
    label: 'Modificar un edicto',
    icon: FilePenLine,
    description: 'Cambia el texto de una norma que ya está en vigor.',
    footnote: 'La versión anterior se conserva en el histórico.'
  },
  {
    value: 'derogar',
    label: 'Derogar un edicto',
    icon: FileX2,
    description: 'Deja sin efecto una norma vigente.',
    footnote: 'Sale del Códice, pero su histórico se conserva.'
  }
];

const NewProposalForm = ({ token, onCreated, onCancel }: NewProposalFormProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [purpose, setPurpose] = useState<ProposalPurpose | null>(null);
  const [mode, setMode] = useState<ProposalMode>('normal');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [sections, setSections] = useState<CodiceSection[]>([]);
  const [targetRuleId, setTargetRuleId] = useState('');
  const [proposedSectionId, setProposedSectionId] = useState('');
  const [proposedBody, setProposedBody] = useState('');
  /**
   * Condiciones enumeradas de la norma. Algunas normas del Códice son un
   * encabezado más una lista (la 1.6, por ejemplo, enumera los tres requisitos
   * de la vía rápida), y editar solo el encabezado las dejaría sin contenido.
   */
  const [proposedBullets, setProposedBullets] = useState<string[]>([]);

  const touchesCodice = purpose !== null && purpose !== 'acuerdo';
  const needsRule = purpose === 'modificar' || purpose === 'derogar';
  const needsBody = purpose === 'crear' || purpose === 'modificar';

  // El Códice solo se carga si hace falta elegir una norma o una sección.
  useEffect(() => {
    if (!touchesCodice || sections.length > 0) return;
    getCodice()
      .then(setSections)
      .catch(() => setSections([]));
  }, [touchesCodice, sections.length]);

  const allRules = sections.flatMap((s) =>
    s.rules.map((r) => ({ ...r, sectionLabel: `${s.number}. ${s.title}` }))
  );
  const selectedRule = allRules.find((r) => r.id === targetRuleId);

  // Al elegir una norma para modificar se precarga su contenido vigente —texto
  // y condiciones— para editar sobre lo que dice ahora, no desde cero.
  useEffect(() => {
    if (purpose === 'modificar' && selectedRule?.current) {
      setProposedBody(selectedRule.current.body);
      setProposedBullets([...selectedRule.current.bullets]);
    }
  }, [purpose, targetRuleId]);

  // Cambiar de propósito descarta lo que solo valía para el anterior, para no
  // arrastrar una norma elegida a una propuesta que ya no la usa.
  const choosePurpose = (value: ProposalPurpose) => {
    setPurpose(value);
    setError('');
    setTargetRuleId('');
    setProposedSectionId('');
    setProposedBody('');
    setProposedBullets([]);
  };

  const updateBullet = (index: number, value: string) => {
    setProposedBullets((prev) => prev.map((b, i) => (i === index ? value : b)));
  };

  const removeBullet = (index: number) => {
    setProposedBullets((prev) => prev.filter((_, i) => i !== index));
  };

  const submit = async () => {
    if (!title.trim()) {
      setError('La propuesta necesita un título.');
      return;
    }
    if (!purpose) {
      setError('Indica qué estás proponiendo.');
      return;
    }
    if (needsRule && !targetRuleId) {
      setError('Elige la norma del Códice que quieres cambiar.');
      return;
    }
    if (purpose === 'crear' && !proposedSectionId) {
      setError('Elige en qué sección del Códice debe ir la norma nueva.');
      return;
    }
    if (needsBody && !proposedBody.trim()) {
      setError('Escribe el texto que propones para la norma.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const created = await createProposal(token, {
        title,
        description,
        // Un acuerdo no toca el Códice; cualquier otra opción es un edicto.
        kind: purpose === 'acuerdo' ? 'acuerdo' : 'edicto',
        mode,
        ...(touchesCodice
          ? {
              targetAction: purpose as TargetAction,
              targetRuleId: needsRule ? targetRuleId : undefined,
              proposedBody: needsBody ? proposedBody : undefined,
              // Se descartan las condiciones que se hayan quedado vacías al
              // editarlas, para no dejar viñetas en blanco en el Códice.
              proposedBullets: needsBody
                ? proposedBullets.map((b) => b.trim()).filter(Boolean)
                : undefined,
              proposedSectionId: purpose === 'crear' ? proposedSectionId : undefined
            }
          : {})
      });
      onCreated(created.id);
    } catch (err: any) {
      setError(err.message || 'No se pudo crear la propuesta.');
      setSaving(false);
    }
  };

  return (
    <div className="border border-outline-ghost bg-surface rounded p-5 md:p-6">
      <h3 className="font-display text-xl text-on-surface mb-1">Nueva propuesta</h3>
      <p className="text-sm text-on-surface-muted mb-6">
        Cualquier persona registrada puede convocar una votación. No hace falta ningún permiso.
      </p>

      {/* Lo primero: qué se está proponiendo */}
      <fieldset className="mb-6">
        <legend className="block text-xs uppercase tracking-[0.14em] font-display text-on-surface-muted mb-3">
          ¿Qué estás proponiendo?
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {PURPOSES.map((option) => {
            const Icon = option.icon;
            const selected = purpose === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => choosePurpose(option.value)}
                aria-pressed={selected}
                className={`text-left border rounded p-4 flex flex-col gap-1.5 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-theme-main ${
                  selected
                    ? 'border-theme-main/60 bg-theme-container/25'
                    : 'border-outline-ghost bg-surface-container hover:border-outline-ghost/80'
                }`}
              >
                <span className="flex items-center gap-2 font-display text-on-surface">
                  <Icon className="w-4 h-4 text-theme-main shrink-0" /> {option.label}
                </span>
                <span className="block text-sm text-on-surface-muted leading-relaxed">
                  {option.description}
                </span>
                <span className="block text-xs text-on-surface-muted/70 mt-auto pt-1">
                  {option.footnote}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* El resto del formulario solo tiene sentido una vez elegido el propósito */}
      {purpose && (
        <>
          <label className="block mb-4">
            <span className="block text-xs uppercase tracking-[0.14em] font-display text-on-surface-muted mb-2">
              ¿Qué se vota?
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                purpose === 'acuerdo'
                  ? '¿Compramos camisetas del Culto?'
                  : purpose === 'derogar'
                    ? 'Derogar la norma sobre…'
                    : 'Resume en una frase qué cambia'
              }
              maxLength={200}
              className="w-full bg-surface-container border border-outline-ghost rounded px-4 py-3 text-on-surface placeholder:text-on-surface-muted/40 focus:outline-none focus:border-theme-main/60 transition-colors"
            />
          </label>

          <label className="block mb-6">
            <span className="block text-xs uppercase tracking-[0.14em] font-display text-on-surface-muted mb-2">
              Explícalo (opcional)
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder={
                touchesCodice
                  ? 'Cuenta por qué hace falta el cambio, para que la gente pueda decidir con criterio.'
                  : 'Cuenta el detalle para que la gente pueda decidir con criterio.'
              }
              className="w-full bg-surface-container border border-outline-ghost rounded px-4 py-3 text-on-surface placeholder:text-on-surface-muted/40 focus:outline-none focus:border-theme-main/60 transition-colors resize-y"
            />
          </label>

          {/* Qué norma, si el propósito lo requiere */}
          {needsRule && (
            <label className="block mb-4">
              <span className="block text-xs uppercase tracking-[0.14em] font-display text-on-surface-muted mb-2">
                ¿Qué norma del Códice?
              </span>
              <select
                value={targetRuleId}
                onChange={(e) => setTargetRuleId(e.target.value)}
                className="w-full bg-surface-container border border-outline-ghost rounded px-4 py-3 text-on-surface focus:outline-none focus:border-theme-main/60 transition-colors"
              >
                <option value="">Elige una norma...</option>
                {allRules.map((rule) => (
                  <option key={rule.id} value={rule.id}>
                    {rule.reference} — {(rule.current?.body ?? '').slice(0, 70)}
                    {(rule.current?.body ?? '').length > 70 ? '...' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}

          {purpose === 'crear' && (
            <label className="block mb-4">
              <span className="block text-xs uppercase tracking-[0.14em] font-display text-on-surface-muted mb-2">
                ¿En qué sección del Códice?
              </span>
              <select
                value={proposedSectionId}
                onChange={(e) => setProposedSectionId(e.target.value)}
                className="w-full bg-surface-container border border-outline-ghost rounded px-4 py-3 text-on-surface focus:outline-none focus:border-theme-main/60 transition-colors"
              >
                <option value="">Elige una sección...</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.number}. {s.title}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* El texto vigente, para compararlo con lo que se propone */}
          {purpose === 'modificar' && selectedRule?.current && (
            <div className="mb-4 border border-outline-ghost bg-surface-container-low rounded p-4">
              <p className="text-xs uppercase tracking-[0.14em] font-display text-on-surface-muted mb-2">
                La norma {selectedRule.reference} dice ahora
              </p>
              <p className="text-sm text-on-surface-muted leading-relaxed">
                {selectedRule.current.body}
              </p>
              {selectedRule.current.bullets.length > 0 && (
                <ul className="list-disc list-inside pl-3 mt-2 space-y-1 text-sm text-on-surface-muted">
                  {selectedRule.current.bullets.map((bullet, i) => (
                    <li key={i} className="leading-relaxed">
                      {bullet}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {needsBody && (
            <>
              <label className="block mb-4">
                <span className="block text-xs uppercase tracking-[0.14em] font-display text-on-surface-muted mb-2">
                  {purpose === 'modificar' ? 'Texto que propones' : 'Texto de la norma nueva'}
                </span>
                <textarea
                  value={proposedBody}
                  onChange={(e) => setProposedBody(e.target.value)}
                  rows={3}
                  placeholder="Redáctalo tal como quedará en el Códice si se aprueba."
                  className="w-full bg-surface-container border border-outline-ghost rounded px-4 py-3 text-on-surface placeholder:text-on-surface-muted/40 focus:outline-none focus:border-theme-main/60 transition-colors resize-y"
                />
              </label>

              {/* Condiciones enumeradas. Algunas normas son un encabezado más
                  una lista, y hay que poder editar la lista igual que el texto. */}
              <div className="mb-4">
                <p className="block text-xs uppercase tracking-[0.14em] font-display text-on-surface-muted mb-2">
                  Condiciones enumeradas {proposedBullets.length === 0 && '(opcional)'}
                </p>

                {proposedBullets.length === 0 ? (
                  <p className="text-sm text-on-surface-muted leading-relaxed mb-3">
                    Si la norma enumera condiciones —como los requisitos de la vía rápida— añádelas
                    aquí, una por línea.
                  </p>
                ) : (
                  <ul className="space-y-2 mb-3">
                    {proposedBullets.map((bullet, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-theme-main mt-3 shrink-0" aria-hidden="true">
                          ·
                        </span>
                        <input
                          type="text"
                          value={bullet}
                          onChange={(e) => updateBullet(index, e.target.value)}
                          aria-label={`Condición ${index + 1}`}
                          className="flex-1 min-w-0 bg-surface-container border border-outline-ghost rounded px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-theme-main/60 transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => removeBullet(index)}
                          aria-label={`Quitar la condición ${index + 1}`}
                          className="text-on-surface-muted hover:text-red-400 transition-colors shrink-0 p-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-theme-main rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <button
                  type="button"
                  onClick={() => setProposedBullets((prev) => [...prev, ''])}
                  className="inline-flex items-center gap-1.5 text-sm text-on-surface-muted hover:text-theme-main transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-theme-main rounded px-1"
                >
                  <Plus className="w-4 h-4" />
                  Añadir una condición
                </button>
              </div>
            </>
          )}

          {purpose === 'derogar' && selectedRule?.current && (
            <div className="mb-4 border border-red-900/60 bg-red-950/25 rounded p-4">
              <p className="text-xs uppercase tracking-[0.14em] font-display text-red-400 mb-2">
                Se derogaría la norma {selectedRule.reference}
              </p>
              <p className="text-sm text-on-surface-muted leading-relaxed">
                {selectedRule.current.body}
              </p>
              {selectedRule.current.bullets.length > 0 && (
                <ul className="list-disc list-inside pl-3 mt-2 space-y-1 text-sm text-on-surface-muted">
                  {selectedRule.current.bullets.map((bullet, i) => (
                    <li key={i} className="leading-relaxed">
                      {bullet}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {touchesCodice && (
            <p className="text-xs text-on-surface-muted mb-6 leading-relaxed">
              Si se aprueba, el cambio se aplica al Códice automáticamente y la norma queda
              enlazada a esta votación.
            </p>
          )}

          {/* Modo: normal o secreto */}
          <fieldset className="mb-6">
            <legend className="block text-xs uppercase tracking-[0.14em] font-display text-on-surface-muted mb-3">
              ¿Qué pasa al comprobar un voto?
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode('normal')}
                aria-pressed={mode === 'normal'}
                className={`text-left border rounded p-4 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-theme-main ${
                  mode === 'normal'
                    ? 'border-green-800/70 bg-green-950/20'
                    : 'border-outline-ghost bg-surface-container hover:border-outline-ghost/80'
                }`}
              >
                <span className="flex items-center gap-2 font-display text-on-surface mb-1.5">
                  <Eye className="w-4 h-4 text-green-500" /> Normal
                </span>
                <span className="block text-sm text-on-surface-muted leading-relaxed">
                  Cada cual puede comprobar su voto cuantas veces quiera y el voto sigue contando.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMode('secreto')}
                aria-pressed={mode === 'secreto'}
                className={`text-left border rounded p-4 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-theme-main ${
                  mode === 'secreto'
                    ? 'border-red-900/70 bg-red-950/25'
                    : 'border-outline-ghost bg-surface-container hover:border-outline-ghost/80'
                }`}
              >
                <span className="flex items-center gap-2 font-display text-on-surface mb-1.5">
                  <EyeOff className="w-4 h-4 text-red-400" /> Secreto
                </span>
                <span className="block text-sm text-on-surface-muted leading-relaxed">
                  Comprobar un voto lo destruye, y hay que votar de nuevo. Para cuando pueda haber
                  presiones.
                </span>
              </button>
            </div>
            <p className="text-xs text-on-surface-muted mt-3 leading-relaxed">
              Ni el tipo de propuesta ni el modo se pueden cambiar una vez convocada la votación.
            </p>
          </fieldset>

          {/* Reglas de aprobación */}
          <div className="border border-outline-ghost bg-surface-container-low rounded p-4 mb-6">
            <p className="text-xs uppercase tracking-[0.14em] font-display text-on-surface-muted mb-2">
              Cómo se aprueba
            </p>
            <p className="text-sm text-on-surface-muted leading-relaxed">
              A los <strong className="text-on-surface">{PLAZO_DIAS} días</strong> si hay más votos
              a favor que en contra. Antes, si reúne{' '}
              <strong className="text-on-surface">{VIA_RAPIDA_MIN_POSITIVOS} votos a favor</strong>{' '}
              con un voto en contra como máximo y han pasado al menos{' '}
              <strong className="text-on-surface">{VIA_RAPIDA_MIN_DIAS} días</strong>.
            </p>
          </div>
        </>
      )}

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <Button
          variant="primary"
          onClick={submit}
          disabled={saving || !purpose}
          className="px-6 py-2.5"
        >
          {saving ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Convocando…
            </span>
          ) : (
            'Convocar la votación'
          )}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={saving} className="px-6 py-2.5">
          Cancelar
        </Button>
      </div>
    </div>
  );
};

export default NewProposalForm;
