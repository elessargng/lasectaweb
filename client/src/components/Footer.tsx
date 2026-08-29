import React from 'react';
import { Link } from 'react-router-dom';
import { History, Sparkles } from 'lucide-react';
import changelogData from '../data/changelog.json';

interface FooterProps {
  onOpenChangelog: () => void;
  version?: string;
}

const Footer: React.FC<FooterProps> = ({ onOpenChangelog, version: propVersion }) => {
  const currentVersion = propVersion || changelogData[0]?.version || '0.1.0';

  return (
    <footer className="w-full bg-theme-container border-t border-outline-ghost shadow-2xl relative z-30 font-body">
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-6 md:py-8 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-4">
        {/* Left Section: Brand & Copyright */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-on-surface-muted text-sm">
          <div className="flex items-center gap-1.5">
            <img 
              src="/logo-2.png" 
              alt="Logo de La Secta" 
              className="w-8 h-8 object-contain opacity-80" 
            />
            <span className="text-base font-normal tracking-tight text-on-surface" style={{ fontFamily: "'Teutonic No1', 'Cinzel', serif" }}>La Secta</span>
          </div>
          <span className="hidden sm:inline text-outline-ghost">•</span>
          <span className="text-xs opacity-75">© {new Date().getFullYear()} Todos los derechos reservados.</span>
        </div>

        {/* Center/Right Section: Legal links & Version badge */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-on-surface-muted">
          <nav className="flex flex-wrap items-center gap-3 sm:gap-5">
            <Link 
              to="/aviso-legal" 
              className="hover:text-theme-main transition-colors decoration-theme-main/30 hover:underline"
            >
              Aviso Legal
            </Link>
            <span className="text-outline-ghost/60">•</span>
            <Link 
              to="/privacidad" 
              className="hover:text-theme-main transition-colors decoration-theme-main/30 hover:underline"
            >
              Política de Privacidad
            </Link>
            <span className="text-outline-ghost/60">•</span>
            <Link 
              to="/cookies" 
              className="hover:text-theme-main transition-colors decoration-theme-main/30 hover:underline"
            >
              Política de Cookies
            </Link>
          </nav>

          {/* Changelog Version Button */}
          <button
            onClick={onOpenChangelog}
            className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-low/80 border border-outline-ghost hover:border-theme-main/60 hover:bg-theme-main/10 text-on-surface-muted hover:text-theme-main transition-all text-xs font-display cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-theme-main/50 sm:ml-2"
            title="Ver historial de cambios (Changelog)"
          >
            <Sparkles className="w-3.5 h-3.5 text-theme-main group-hover:rotate-12 transition-transform" />
            <span className="font-semibold tracking-wide">v{currentVersion}</span>
            <span className="hidden xs:inline text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 bg-theme-main/20 text-theme-main rounded-sm ml-1 group-hover:bg-theme-main group-hover:text-background transition-colors">
              Changelog
            </span>
            <History className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity ml-0.5" />
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
