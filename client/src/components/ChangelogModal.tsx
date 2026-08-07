import React, { useEffect, useState } from 'react';
import { X, Sparkles, Tag, Calendar, CheckCircle2, History } from 'lucide-react';
import Button from './Button';
import defaultChangelogData from '../data/changelog.json';

export interface ChangelogItem {
  category: string;
  items: string[];
}

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  description: string;
  changes: ChangelogItem[];
}

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, onClose }) => {
  const [changelogData, setChangelogData] = useState<ChangelogEntry[]>(defaultChangelogData);

  useEffect(() => {
    // Attempt to fetch fresh changelog.json from public folder if updated on server
    fetch('/changelog.json')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setChangelogData(data);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-background/85 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-surface border border-outline-ghost rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Runic Corner Details */}
        <span className="absolute top-2 left-3 text-xs text-theme-main/30 font-display select-none pointer-events-none">ᚠ</span>
        <span className="absolute top-2 right-12 text-xs text-theme-main/30 font-display select-none pointer-events-none">ᚦ</span>
        <span className="absolute bottom-2 left-3 text-xs text-theme-main/30 font-display select-none pointer-events-none">ᚨ</span>
        <span className="absolute bottom-2 right-3 text-xs text-theme-main/30 font-display select-none pointer-events-none">ᛟ</span>

        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-outline-ghost/80 bg-surface-low/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-theme-main/10 border border-theme-main/30 flex items-center justify-center text-theme-main">
              <History size={20} />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-on-surface flex items-center gap-2">
                Historial de Cambios
              </h2>
              <p className="text-xs font-body text-on-surface-muted">
                Novedades y notas de la versión para los miembros de La Secta
              </p>
            </div>
          </div>
          <Button 
            onClick={onClose} 
            variant="text" 
            className="text-on-surface-muted hover:text-theme-main transition-colors p-1"
            aria-label="Cerrar"
          >
            <X size={22} />
          </Button>
        </div>

        {/* Modal Body - Timeline of Releases */}
        <div className="p-6 overflow-y-auto space-y-8 font-body">
          {changelogData.map((entry, index) => (
            <div 
              key={entry.version}
              className={`relative border-l-2 ${index === 0 ? 'border-theme-main' : 'border-outline-ghost'} pl-6 ml-2 space-y-4`}
            >
              {/* Timeline Indicator Dot */}
              <div 
                className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 ${
                  index === 0 
                    ? 'bg-theme-main border-background ring-4 ring-theme-main/20' 
                    : 'bg-surface border-outline-ghost'
                }`}
              />

              {/* Release Header */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-display font-semibold bg-theme-main/15 text-theme-main border border-theme-main/30">
                    <Tag size={12} />
                    v{entry.version}
                  </span>
                  {index === 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-display font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                      <Sparkles size={10} />
                      Última versión
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-on-surface-muted font-body">
                  <Calendar size={13} className="text-theme-main/70" />
                  <span>{formatDate(entry.date)}</span>
                </div>
              </div>

              {/* Version Title & Description */}
              <div>
                <h3 className="text-lg font-display font-semibold text-on-surface">
                  {entry.title}
                </h3>
                {entry.description && (
                  <p className="text-sm text-on-surface-muted mt-1 leading-relaxed">
                    {entry.description}
                  </p>
                )}
              </div>

              {/* Categories & Items */}
              <div className="space-y-4 pt-1">
                {entry.changes.map((group, gIdx) => (
                  <div key={gIdx} className="bg-surface-low/60 border border-outline-ghost/60 rounded-md p-4 space-y-3">
                    <h4 className="text-xs font-display font-bold uppercase tracking-wider text-theme-main flex items-center gap-1.5">
                      <Sparkles size={13} />
                      {group.category}
                    </h4>
                    <ul className="space-y-2">
                      {group.items.map((item, itemIdx) => (
                        <li key={itemIdx} className="flex items-start gap-2.5 text-sm text-on-surface/90">
                          <CheckCircle2 size={16} className="text-theme-main/80 shrink-0 mt-0.5" />
                          <span className="leading-snug">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-outline-ghost/80 bg-surface-low/50 flex justify-between items-center">
          <span className="text-xs text-on-surface-muted italic">
            <span style={{ fontFamily: "'Teutonic No1', 'Cinzel', serif" }}>La Secta</span> Web • v{changelogData[0]?.version || '0.1.0'}
          </span>
          <Button onClick={onClose} variant="primary" className="px-6 py-2 text-sm">
            Entendido
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChangelogModal;
