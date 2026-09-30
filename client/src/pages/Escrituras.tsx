import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import RuleHistoryModal from '../components/plaza/RuleHistoryModal';
import { getCodice, type CodiceSection } from '../utils/plazaApi';
import {
  HeartHandshake,
  Scale,
  Scroll,
  Calendar,
  Sparkles,
  Video,
  Send,
  Coins,
  Key,
  MessagesSquare,
  UserX,
  Gift,
  Users,
  ShieldCheck,
  ChevronRight,
  History,
  Loader2,
  Vote,
  type LucideIcon
} from 'lucide-react';

/**
 * Iconos por sección. El nombre viaja en la BBDD (columna icon) y aquí se
 * resuelve al componente: guardar el componente no sería posible, y guardar
 * solo el nombre permite que una sección nueva elija su icono sin tocar código.
 */
const ICONS: Record<string, LucideIcon> = {
  HeartHandshake,
  Scale,
  Scroll,
  Calendar,
  Sparkles,
  Video,
  Send,
  Coins,
  Key,
  MessagesSquare,
  UserX,
  Gift,
  Users,
  ShieldCheck
};

/** Etiqueta corta para la navegación móvil: la primera palabra significativa. */
function shortLabel(title: string): string {
  const words = title.split(/\s+/).filter((w) => w.length > 3 || /^\d/.test(w));
  return words.slice(0, 2).join(' ') || title;
}

const Escrituras = () => {
  const [sections, setSections] = useState<CodiceSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState('');
  const [historyRuleId, setHistoryRuleId] = useState<string | null>(null);

  useEffect(() => {
    getCodice()
      .then((data) => {
        setSections(data);
        if (data.length > 0) setActiveSection(`sec-${data[0].number}`);
      })
      .catch((err) => setError(err.message || 'No se pudo cargar el Códice.'))
      .finally(() => setLoading(false));
  }, []);

  // Scroll-spy: marca en la navegación la sección que se está leyendo.
  useEffect(() => {
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { root: null, rootMargin: '-130px 0px -70% 0px', threshold: 0 }
    );

    const observed = document.querySelectorAll('[data-section]');
    observed.forEach((el) => observer.observe(el));
    return () => observed.forEach((el) => observer.unobserve(el));
  }, [sections]);

  const scrollToSection = (
    e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>,
    id: string
  ) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (!element) return;
    const offset = 120; // altura de la cabecera fija más un margen
    const bodyRect = document.body.getBoundingClientRect().top;
    const elementRect = element.getBoundingClientRect().top;
    window.scrollTo({ top: elementRect - bodyRect - offset, behavior: 'smooth' });
  };

  return (
    <div className="flex flex-col w-full min-h-screen">
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <PageHeader
        title="El Códice"
        subtitle="El compendio de leyes y normas de convivencia que rigen la comunidad de La Secta."
        imageSrc="/rules_banner_wide.jpg"
        imageAlt="Grimoire Rules"
        bgClass="bg-black"
        gradientClass="from-black"
        maxWidthClass="max-w-7xl"
      />

      <div className="max-w-7xl w-full mx-auto px-0 md:px-10 py-4 md:py-10 relative z-20 -mt-20 flex-1">
        <div className="bg-transparent md:bg-surface border-0 md:border border-transparent md:border-outline-ghost p-4 md:p-10 rounded-none md:rounded shadow-none md:shadow-2xl relative flex flex-col md:flex-row gap-8 lg:gap-12">
          {loading ? (
            <div className="flex-1 flex items-center justify-center py-20 text-on-surface-muted">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex-1 py-16 text-center">
              <p className="text-on-surface-muted">{error}</p>
            </div>
          ) : (
            <>
              {/* Navegación móvil */}
              <div className="md:hidden sticky top-[80px] z-30 bg-surface border-b border-outline-ghost -mx-6 px-6 py-3 overflow-x-auto no-scrollbar flex gap-2 mb-4">
                {sections.map((sec) => {
                  const Icon = ICONS[sec.icon ?? ''] ?? Scroll;
                  const id = `sec-${sec.number}`;
                  const isActive = activeSection === id;
                  return (
                    <button
                      key={sec.id}
                      onClick={(e) => scrollToSection(e, id)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-sm font-display text-xs whitespace-nowrap transition-all border ${
                        isActive
                          ? 'bg-theme-container/50 text-theme-main border-theme-main/50 font-semibold shadow-md'
                          : 'bg-surface-low border-outline-ghost text-on-surface-muted hover:text-on-surface'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{shortLabel(sec.title)}</span>
                    </button>
                  );
                })}
              </div>

              {/* Índice lateral */}
              <aside className="hidden md:block w-64 lg:w-72 shrink-0 sticky top-28 self-start bg-surface-low/50 border border-outline-ghost p-5 rounded shadow-lg max-h-[calc(100vh-10rem)] overflow-y-auto no-scrollbar">
                <h4 className="text-xs font-display text-on-surface-muted tracking-widest uppercase border-b border-outline-ghost pb-3 mb-4 font-semibold">
                  Leyes y Decretos
                </h4>
                <nav className="space-y-1">
                  {sections.map((sec) => {
                    const Icon = ICONS[sec.icon ?? ''] ?? Scroll;
                    const id = `sec-${sec.number}`;
                    const isActive = activeSection === id;
                    return (
                      <button
                        key={sec.id}
                        onClick={(e) => scrollToSection(e, id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-sm font-display text-xs lg:text-sm transition-all duration-200 group relative border-l-2 ${
                          isActive
                            ? 'bg-theme-container/20 text-theme-main border-theme-main pl-4 font-semibold shadow-[inset_1px_0_0_rgba(177,156,217,0.1)]'
                            : 'text-on-surface-muted hover:text-on-surface hover:bg-surface-high/40 border-transparent'
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-transform ${
                            isActive
                              ? 'scale-110 text-theme-main'
                              : 'opacity-70 group-hover:opacity-100 group-hover:scale-105'
                          }`}
                        />
                        <span className="truncate">
                          {sec.number}. {sec.title}
                        </span>
                        {isActive && (
                          <ChevronRight className="w-3.5 h-3.5 ml-auto text-theme-main animate-pulse" />
                        )}
                      </button>
                    );
                  })}
                </nav>

                {/* Enlace a La Plaza: el Códice se cambia votando */}
                <div className="mt-5 pt-4 border-t border-outline-ghost">
                  <Link
                    to="/plaza"
                    className="flex items-start gap-2.5 text-xs text-on-surface-muted hover:text-theme-main transition-colors group"
                  >
                    <Vote className="w-4 h-4 shrink-0 mt-0.5 text-theme-main" />
                    <span className="leading-relaxed">
                      Para cambiar cualquier norma, propón una votación en{' '}
                      <span className="text-theme-main group-hover:underline">La Plaza</span>.
                    </span>
                  </Link>
                </div>
              </aside>

              {/* Contenido */}
              <div className="flex-1 min-w-0 space-y-10">
                {sections.map((sec) => {
                  const Icon = ICONS[sec.icon ?? ''] ?? Scroll;
                  return (
                    <section
                      key={sec.id}
                      id={`sec-${sec.number}`}
                      data-section
                      className="scroll-mt-28 bg-surface-low border border-outline-ghost rounded p-6 md:p-8 hover:border-theme-main/30 transition-all duration-300 shadow-md"
                    >
                      <div className="flex items-center gap-3 mb-4 border-b border-outline-ghost pb-3">
                        <Icon className="w-6 h-6 text-theme-main" />
                        <h3 className="text-xl md:text-2xl font-display text-theme-main leading-none">
                          {sec.number}. {sec.title}
                        </h3>
                      </div>

                      <div className="space-y-4 font-body text-lg text-on-surface leading-relaxed">
                        {sec.rules.length === 0 ? (
                          <p className="text-on-surface-muted text-base">
                            Esta sección todavía no tiene normas.
                          </p>
                        ) : (
                          sec.rules.map((rule) => (
                            <div key={rule.id}>
                              <p className="flex items-start gap-2">
                                <strong className="text-theme-main font-display shrink-0">
                                  {rule.reference}
                                </strong>
                                <span>{rule.current?.body}</span>
                              </p>

                              {rule.current && rule.current.bullets.length > 0 && (
                                <ul className="list-disc list-inside pl-6 mt-1 space-y-1 text-on-surface/90">
                                  {rule.current.bullets.map((bullet, i) => (
                                    <li key={i}>{bullet}</li>
                                  ))}
                                </ul>
                              )}

                              {/* Trazabilidad: de dónde viene la norma vigente */}
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 pl-6">
                                {rule.current?.proposalId && (
                                  <Link
                                    to={`/plaza/${rule.current.proposalId}`}
                                    className="inline-flex items-center gap-1.5 text-xs text-on-surface-muted hover:text-theme-main transition-colors"
                                  >
                                    <Vote className="w-3.5 h-3.5" />
                                    Ver la votación que la aprobó
                                  </Link>
                                )}

                                {rule.historyCount > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setHistoryRuleId(rule.id)}
                                    className="inline-flex items-center gap-1.5 text-xs text-on-surface-muted hover:text-theme-main transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-theme-main rounded px-1"
                                  >
                                    <History className="w-3.5 h-3.5" />
                                    {rule.historyCount === 1
                                      ? 'Modificada una vez'
                                      : `Modificada ${rule.historyCount} veces`}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </section>
                  );
                })}

                {/* Enlace a La Plaza al pie, para quien lea en móvil */}
                <div className="md:hidden border border-outline-ghost bg-surface-low rounded p-5">
                  <Link
                    to="/plaza"
                    className="flex items-start gap-2.5 text-sm text-on-surface-muted"
                  >
                    <Vote className="w-4 h-4 shrink-0 mt-0.5 text-theme-main" />
                    <span className="leading-relaxed">
                      Para cambiar cualquier norma, propón una votación en{' '}
                      <span className="text-theme-main underline">La Plaza</span>.
                    </span>
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <RuleHistoryModal ruleId={historyRuleId} onClose={() => setHistoryRuleId(null)} />
    </div>
  );
};

export default Escrituras;
