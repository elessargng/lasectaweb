import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Loader2, Scroll, Inbox, FileText, BookOpen, ExternalLink, Eye } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Button from '../components/Button';
import ProposalCard from '../components/plaza/ProposalCard';
import NewProposalForm from '../components/plaza/NewProposalForm';
import { useAuth } from '../context/AuthContext';
import { listProposals, type ProposalListItem, type ProposalStatus } from '../utils/plazaApi';

// Cada pestaña es un estado exacto, así que no hay solapamiento: una votación
// aparece en una sola. El servidor ya filtra por estado, y aquí no queda nada
// que recortar.
const TABS: Array<[ProposalStatus, string]> = [
  ['abierta', 'En curso'],
  ['aprobada', 'Aprobadas'],
  ['rechazada', 'Rechazadas']
];

const Plaza = () => {
  const { token, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [proposals, setProposals] = useState<ProposalListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<ProposalStatus>('abierta');
  const [creating, setCreating] = useState(false);

  const fetchProposals = async () => {
    setLoading(true);
    setError('');
    try {
      setProposals(await listProposals(filter));
    } catch (err: any) {
      setError(err.message || 'No se pudieron cargar las propuestas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, [filter]);

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
          {/* Presentación */}
          <div className="mb-8">
            <h2 className="font-display text-2xl text-theme-main mb-3">
              Donde el Culto decide
            </h2>
            <p className="text-on-surface-muted font-body leading-relaxed mb-4">
              Aquí se proponen y se votan las decisiones de La Secta. Cada voto queda sellado, cada
              persona puede comprobar el suyo y cualquiera puede verificar el recuento completo.
            </p>

            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <a
                href="/propuesta-votaciones-plaza.html"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-theme-main hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-theme-main rounded px-1"
              >
                <FileText className="w-4 h-4" />
                Cómo funciona el voto seguro
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>

              <Link
                to="/escrituras"
                className="inline-flex items-center gap-1.5 text-on-surface-muted hover:text-theme-main transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-theme-main rounded px-1"
              >
                <BookOpen className="w-4 h-4" />
                Ver el Códice
              </Link>

              <Link
                to="/plaza/vigilante"
                className="inline-flex items-center gap-1.5 text-on-surface-muted hover:text-theme-main transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-theme-main rounded px-1"
              >
                <Eye className="w-4 h-4" />
                El vigilante
              </Link>
            </div>
          </div>

          {/* Convocar */}
          {creating ? (
            <div className="mb-8">
              <NewProposalForm
                token={token!}
                onCreated={(id) => navigate(`/plaza/${id}`)}
                onCancel={() => setCreating(false)}
              />
            </div>
          ) : (
            <div className="mb-8">
              {isAuthenticated ? (
                <Button variant="primary" onClick={() => setCreating(true)} className="px-5 py-2.5">
                  <span className="inline-flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Convocar una votación
                  </span>
                </Button>
              ) : (
                <p className="text-sm text-on-surface-muted border border-outline-ghost bg-surface-container-low rounded p-4">
                  Puedes leer las votaciones y comprobar cualquier registro sin tener cuenta. Para
                  votar o convocar, inicia sesión.
                </p>
              )}
            </div>
          )}

          {/* Filtros */}
          <div className="flex gap-2 mb-6 border-b border-outline-ghost">
            {TABS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`px-4 py-2.5 text-sm font-display tracking-wide transition-colors border-b-2 -mb-px focus:outline-none focus-visible:ring-1 focus-visible:ring-theme-main ${
                  filter === value
                    ? 'border-theme-main text-theme-main'
                    : 'border-transparent text-on-surface-muted hover:text-on-surface'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Listado */}
          {loading ? (
            <div className="flex items-center justify-center py-16 text-on-surface-muted">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : error ? (
            <div className="border border-red-900/60 bg-red-950/30 rounded p-4">
              <p className="text-sm text-on-surface">{error}</p>
              <button
                type="button"
                onClick={fetchProposals}
                className="mt-3 text-sm text-theme-main hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-theme-main rounded px-1"
              >
                Volver a intentarlo
              </button>
            </div>
          ) : proposals.length === 0 ? (
            <div className="text-center py-16">
              {filter === 'abierta' ? (
                <>
                  <Scroll className="w-10 h-10 text-theme-main/40 mx-auto mb-4" />
                  <p className="text-on-surface-muted">
                    No hay ninguna votación en curso.
                    {isAuthenticated && ' Puedes convocar la primera.'}
                  </p>
                </>
              ) : filter === 'aprobada' ? (
                <>
                  <Inbox className="w-10 h-10 text-theme-main/40 mx-auto mb-4" />
                  <p className="text-on-surface-muted">Todavía no se ha aprobado nada.</p>
                </>
              ) : (
                <>
                  <Inbox className="w-10 h-10 text-theme-main/40 mx-auto mb-4" />
                  <p className="text-on-surface-muted">
                    Ninguna votación se ha rechazado. Cuando ocurra, quedará aquí con su registro
                    intacto: lo que no sale adelante también forma parte de la memoria de La Plaza.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {proposals.map((proposal) => (
                <ProposalCard key={proposal.id} proposal={proposal} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Plaza;
