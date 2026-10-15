import React from 'react';
import { Link } from 'react-router-dom';
import { History } from 'lucide-react';
import changelogData from '../data/changelog.json';

interface FooterProps {
  onOpenChangelog: () => void;
  version?: string;
}

const enlaceLegal = 'font-ui text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-on-surface-muted hover:text-gold-bright transition-colors';

const Footer: React.FC<FooterProps> = ({ onOpenChangelog, version: propVersion }) => {
  const currentVersion = propVersion || changelogData[0]?.version || '0.1.0';

  return (
    // z-10: por debajo del contenido de las páginas (z-20), para que sus modales y menús se vean por encima del pie
    <footer className="relative z-10 w-full font-body bg-[linear-gradient(180deg,var(--theme-surface)_0%,var(--theme-background)_100%)]">
      <div aria-hidden="true" className="hairline-gold" />
      {/* Brillo dorado tenue bajo el filo */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(ellipse_at_top,rgba(212,175,106,0.08),transparent_70%)] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6 md:px-10 pt-10 pb-8 flex flex-col items-center gap-8">
        {/* Marca */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <img src="/logo-2.png" alt="" className="w-10 h-10 object-contain drop-shadow-[0_0_10px_rgba(212,175,106,0.3)]" />
            <span className="text-2xl font-normal tracking-tight text-white" style={{ fontFamily: "'Teutonic No1', 'Cinzel', serif" }}>La Secta</span>
          </div>
          <div aria-hidden="true" className="ornament-divider w-48"><span className="ornament-diamond" /></div>
        </div>

        <nav aria-label="Información legal" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          <Link to="/aviso-legal" className={enlaceLegal}>Aviso Legal</Link>
          <span aria-hidden="true" className="w-1 h-1 rotate-45 bg-theme-main/40" />
          <Link to="/privacidad" className={enlaceLegal}>Política de Privacidad</Link>
          <span aria-hidden="true" className="w-1 h-1 rotate-45 bg-theme-main/40" />
          <Link to="/cookies" className={enlaceLegal}>Política de Cookies</Link>
        </nav>

        <div className="w-full flex flex-col-reverse md:flex-row items-center justify-between gap-6 pt-6 border-t border-outline-ghost/60">
          <span className="text-xs text-on-surface-muted/80 tracking-wide">© {new Date().getFullYear()} Todos los derechos reservados.</span>

          <div className="flex items-center gap-5">
            {/* Logo de contenido creado por la comunidad: lo pide la política de The
                Pandemonium Institute a quien usa sus recursos (los iconos de los personajes).
                Copia local de https://release.botc.app/resources/community/ccc-sleeve.png */}
            <a
              href="https://bloodontheclocktower.com/pages/community-created-content-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full opacity-80 transition-opacity hover:opacity-100"
            >
              <img src="/ccc-sleeve.png" alt="Community Created Content" lang="en" className="h-10 w-auto" loading="lazy" />
              <span className="sr-only"> (se abre en una ventana nueva)</span>
            </a>

            <button
              type="button"
              onClick={onOpenChangelog}
              className="group flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-theme-main/30 hover:border-theme-main/70 bg-background/50 hover:bg-theme-main/10 text-on-surface-muted hover:text-gold-bright transition-all cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-theme-main" />
              <span className="font-ui text-xs font-semibold tracking-wider">v{currentVersion}</span>
              <span lang="en" className="font-ui text-[0.6rem] uppercase font-bold tracking-[0.18em] px-1.5 py-0.5 bg-theme-main/15 text-theme-main rounded-sm group-hover:bg-theme-main group-hover:text-background transition-colors">
                Changelog
              </span>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
