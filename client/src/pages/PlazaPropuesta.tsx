import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  Scroll,
  Handshake,
  EyeOff,
  Eye,
  Clock,
  Check,
  X,
  MessageSquare,
  Zap,
  Send,
  CheckCircle2
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Button from '../components/Button';
import SealDisplay from '../components/plaza/SealDisplay';
import ReceiptChecker from '../components/plaza/ReceiptChecker';
import ResultsPanel from '../components/plaza/ResultsPanel';
import ProposedChange from '../components/plaza/ProposedChange';
import VoteConfirmModal from '../components/plaza/VoteConfirmModal';
import { useAuth } from '../context/AuthContext';
import {
  getProposal,
  castVote,
  addComment,
  daysRemaining,
  fastTrackStatus,
  formatDate,
  PLAZO_DIAS,
  VIA_RAPIDA_MIN_POSITIVOS,
  VIA_RAPIDA_MIN_DIAS,
  type ProposalDetail,
  type VoteChoice
} from '../utils/plazaApi';

const PlazaPropuesta = () => {
  const { id } = useParams<{ id: string }>();
  const { user, token, isAuthenticated } = useAuth();

  const [detail, setDetail] = useState<ProposalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [voting, setVoting] = useState(false);
  /** Sentido del voto pendiente de confirmar. null si no hay confirmación abierta. */
  const [confirmingVote, setConfirmingVote] = useState<VoteChoice | null>(null);
  const [voteError, setVoteError] = useState('');
  /** Sello recién emitido. Solo se muestra en esta sesión, no se guarda. */
  const [seal, setSeal] = useState<string | null>(null);

  const [commentBody, setCommentBody] = useState('');
  const [posting, setPosting] = useState(false);

  const load = async () => {
    if (!id) return;
    try {
      setDetail(await getProposal(id, token));
      setError('');
    } catch (err: any) {
      setError(err.message || 'No se pudo cargar la propuesta.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id, token]);

  const vote = async (choice: VoteChoice) => {
    if (!id || !token) return;
    setVoting(true);
    setVoteError('');
    try {
      const res = await castVote(id, token, choice);
      setSeal(res.sello);
      setConfirmingVote(null);
      await load();
    } catch (err: any) {
      setVoteError(err.message || 'No se pudo registrar el voto.');
      // El modal se cierra también al fallar: el error se muestra en la página,
      // donde queda visible junto a los botones.
      setConfirmingVote(null);
    } finally {
      setVoting(false);
    }
  };

  const postComment = async () => {
    if (!id || !token || !commentBody.trim()) return;
    setPosting(true);
    try {
      await addComment(id, token, commentBody);
      setCommentBody('');
      await load();
    } catch (err: any) {
      setVoteError(err.message || 'No se pudo publicar el comentario.');
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-on-surface-muted">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="max-w-3xl w-full mx-auto px-4 py-16 text-center">
        <p className="text-on-surface-muted mb-6">{error || 'La propuesta no existe.'}</p>
        <Button to="/plaza" variant="outline" className="px-6 py-2.5">
          Volver a La Plaza
        </Button>
      </div>
    );
  }

  const { proposal, tally, comments, voters, hasVoted, canVote, change } = detail;
  const isOpen = proposal.status === 'abierta';
  const days = daysRemaining(proposal.deadlineAt);
  const fast = fastTrackStatus(proposal, tally);

  return (
    <div className="flex flex-col w-full min-h-[80vh]">
      <PageHeader
        title="La Plaza"
        imageSrc="/profile_banner_wide.jpg"
        imageAlt="La Plaza"
        maxWidthClass="max-w-3xl"
      />

      <div className="max-w-3xl w-full mx-auto px-0 md:px-8 py-4 md:py-10 relative z-20 -mt-20 flex-1">
        <div className="bg-transparent md:bg-surface border-0 md:border border-transparent md:border-outline-ghost rounded-none md:rounded shadow-none md:shadow-2xl px-4 py-6 md:p-10 relative">
          <Link
            to="/plaza"
            className="inline-flex items-center gap-2 text-sm text-on-surface-muted hover:text-theme-main transition-colors mb-6 focus:outline-none focus-visible:ring-1 focus-visible:ring-theme-main rounded px-1"
          >
            <ArrowLeft className="w-4 h-4" /> Todas las votaciones
          </Link>

          {/* Cabecera de la propuesta */}
          <div className="mb-6 pb-6 border-b border-outline-ghost">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
              <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] font-display text-on-surface-muted">
                {proposal.kind === 'edicto' ? (
                  <>
                    <Scroll className="w-3.5 h-3.5 text-theme-main" /> Edicto
                  </>
                ) : (
                  <>
                    <Handshake className="w-3.5 h-3.5 text-theme-main" /> Acuerdo
                  </>
                )}
              </span>

              <span
                className={`inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] font-display ${
                  proposal.mode === 'secreto' ? 'text-red-400' : 'text-green-500'
                }`}
              >
                {proposal.mode === 'secreto' ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" /> Secreta
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" /> Normal
                  </>
                )}
              </span>

              {isOpen ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-on-surface-muted">
                  <Clock className="w-3.5 h-3.5" />
                  {days === 0 ? 'Último día' : `Quedan ${days} ${days === 1 ? 'día' : 'días'}`}
                </span>
              ) : (
                <span
                  className={`inline-flex items-center gap-1.5 text-xs ${
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

            <h2 className="font-display text-2xl md:text-3xl text-on-surface leading-snug mb-3">
              {proposal.title}
            </h2>

            {proposal.description && (
              <p className="text-on-surface-muted font-body leading-relaxed whitespace-pre-wrap mb-4">
                {proposal.description}
              </p>
            )}

            <p className="text-xs text-on-surface-muted">
              Convocada el {formatDate(proposal.createdAt)}
              {isOpen && ` · El plazo vence el ${formatDate(proposal.deadlineAt)}`}
            </p>
          </div>

          {/* Qué cambia en el Códice. Es lo que de verdad se está votando, así
              que va antes que cualquier otra cosa. */}
          {change && <ProposedChange change={change} />}

          {/* Qué implica el modo. Se explica ANTES de votar. */}
          {isOpen && (
            <div
              className={`rounded p-4 mb-6 border ${
                proposal.mode === 'secreto'
                  ? 'border-red-900/60 bg-red-950/25'
                  : 'border-green-900/50 bg-green-950/15'
              }`}
            >
              <p className="text-sm text-on-surface leading-relaxed">
                {proposal.mode === 'secreto' ? (
                  <>
                    <strong className="text-red-400 font-display">Votación secreta.</strong> Si
                    compruebas tu voto verás lo que votaste, pero{' '}
                    <strong>ese voto se anulará</strong> y tendrás que votar de nuevo.
                  </>
                ) : (
                  <>
                    <strong className="text-green-500 font-display">Votación normal.</strong> Puedes
                    comprobar tu voto cuantas veces quieras y seguirá contando.
                  </>
                )}
              </p>
            </div>
          )}

          {/* Recuento en curso */}
          {isOpen && (
            <div className="border border-outline-ghost bg-surface-container-low rounded p-5 mb-6">
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 mb-4">
                <span className="text-on-surface">
                  <strong className="font-display text-xl">{tally.si}</strong>{' '}
                  <span className="text-sm text-on-surface-muted">a favor</span>
                </span>
                <span className="text-on-surface">
                  <strong className="font-display text-xl">{tally.no}</strong>{' '}
                  <span className="text-sm text-on-surface-muted">en contra</span>
                </span>
                <span className="text-sm text-on-surface-muted">
                  {tally.participantes}{' '}
                  {tally.participantes === 1 ? 'participante' : 'participantes'}
                </span>
              </div>

              {/* Estado de la vía rápida: informa de por qué puede cerrarse antes */}
              <div className="pt-3 border-t border-outline-ghost">
                {proposal.fastTrackBlocked ? (
                  <p className="text-sm text-on-surface-muted leading-relaxed">
                    Hay más de un voto en contra, así que esta propuesta esperará los{' '}
                    {PLAZO_DIAS} días completos. Se aprobará si acaba con más votos a favor que en
                    contra.
                  </p>
                ) : fast.available ? (
                  <p className="flex items-start gap-2 text-sm text-theme-main leading-relaxed">
                    <Zap className="w-4 h-4 shrink-0 mt-0.5" />
                    Reúne las condiciones para aprobarse por vía rápida.
                  </p>
                ) : (
                  <p className="text-sm text-on-surface-muted leading-relaxed">
                    Para aprobarse antes de los {PLAZO_DIAS} días necesita{' '}
                    {VIA_RAPIDA_MIN_POSITIVOS} votos a favor, un voto en contra como máximo y{' '}
                    {VIA_RAPIDA_MIN_DIAS} días de espera. {fast.missing.join('. ')}.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Sello recién emitido */}
          {seal && (
            <div className="mb-6">
              <SealDisplay seal={seal} showWarning />
            </div>
          )}

          {/* Votar */}
          {isOpen && (
            <div className="mb-6">
              {!isAuthenticated ? (
                <p className="text-sm text-on-surface-muted border border-outline-ghost bg-surface-container-low rounded p-4">
                  Inicia sesión para votar en esta propuesta.
                </p>
              ) : hasVoted && !canVote ? (
                <div className="border border-outline-ghost bg-surface-container-low rounded p-4">
                  <p className="flex items-start gap-2.5 text-sm text-on-surface-muted leading-relaxed">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    <span>
                      {seal ? (
                        <>
                          <strong className="text-on-surface font-display">
                            Tu voto está registrado.
                          </strong>{' '}
                          Apunta el sello de arriba si quieres poder comprobarlo más adelante.
                        </>
                      ) : (
                        <>
                          Ya has votado en esta propuesta. Si guardaste tu sello puedes comprobar tu
                          voto más abajo.
                        </>
                      )}
                    </span>
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs uppercase tracking-[0.14em] font-display text-on-surface-muted mb-3">
                    Tu voto
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="success"
                      onClick={() => setConfirmingVote('si')}
                      disabled={voting}
                      className="px-8 py-3"
                    >
                      A favor
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => setConfirmingVote('no')}
                      disabled={voting}
                      className="px-8 py-3"
                    >
                      En contra
                    </Button>
                  </div>
                </>
              )}
              {voteError && <p className="mt-3 text-sm text-red-400">{voteError}</p>}
            </div>
          )}

          {/* Resultado, si está cerrada */}
          {!isOpen && (
            <div className="mb-6">
              <ResultsPanel proposal={proposal} tally={tally} voters={voters} />
            </div>
          )}

          {/* Comprobar el sello */}
          <div className="mb-8">
            <ReceiptChecker
              proposalId={proposal.id}
              mode={proposal.mode}
              isOpen={isOpen}
              onAnnulled={load}
            />
          </div>

          {/* Comentarios */}
          <div className="pt-6 border-t border-outline-ghost">
            <h3 className="flex items-center gap-2 font-display text-lg text-on-surface mb-2">
              <MessageSquare className="w-5 h-5 text-theme-main" />
              Comentarios
              {comments.length > 0 && (
                <span className="text-sm text-on-surface-muted font-body">
                  ({comments.length})
                </span>
              )}
            </h3>
            <p className="text-sm text-on-surface-muted leading-relaxed mb-5">
              Comentar es público y con tu nombre. No revela lo que has votado, ni hace falta votar
              para comentar.
            </p>

            {isAuthenticated && (
              <div className="mb-6">
                <textarea
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  rows={3}
                  placeholder="Propón un cambio, o explica por qué te parece bien o mal."
                  className="w-full bg-surface-container border border-outline-ghost rounded px-4 py-3 text-on-surface placeholder:text-on-surface-muted/40 focus:outline-none focus:border-theme-main/60 transition-colors resize-y"
                />
                <Button
                  variant="outline"
                  onClick={postComment}
                  disabled={posting || !commentBody.trim()}
                  className="mt-3 px-5 py-2 text-sm"
                >
                  <span className="inline-flex items-center gap-2">
                    {posting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Publicar
                  </span>
                </Button>
              </div>
            )}

            {comments.length === 0 ? (
              <p className="text-sm text-on-surface-muted py-4">
                Nadie ha comentado todavía.
              </p>
            ) : (
              <ul className="space-y-4">
                {comments.map((comment) => (
                  <li
                    key={comment.id}
                    className="border-l-2 border-theme-container pl-4 py-1"
                  >
                    <p className="flex flex-wrap items-baseline gap-x-3 mb-1.5">
                      <span className="font-display text-sm text-on-surface">
                        {comment.username}
                        {comment.userId === user?.id && (
                          <span className="text-on-surface-muted font-body"> (tú)</span>
                        )}
                      </span>
                      <span className="text-xs text-on-surface-muted">
                        {formatDate(comment.createdAt)}
                      </span>
                    </p>
                    <p className="text-on-surface-muted leading-relaxed whitespace-pre-wrap">
                      {comment.body}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <VoteConfirmModal
        choice={confirmingVote}
        proposalTitle={proposal.title}
        mode={proposal.mode}
        voting={voting}
        onConfirm={() => confirmingVote && vote(confirmingVote)}
        onCancel={() => setConfirmingVote(null)}
      />
    </div>
  );
};

export default PlazaPropuesta;
