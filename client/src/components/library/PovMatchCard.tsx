import React from 'react';
import type {
  LibraryPovMatch,
  CharacterType
} from '../../utils/libraryApi';
import {
  Play,
  Pencil,
  Trash2,
  Move,
  Users,
  Eye,
  Sparkles,
  Layers,
  Skull,
  Shield,
  Compass,
  Scroll,
  HelpCircle
} from 'lucide-react';
import AccessBadge from '../AccessBadge';

interface PovMatchCardProps {
  match: LibraryPovMatch;
  isAdmin: boolean;
  onOpenPlayer: (match: LibraryPovMatch) => void;
  onEdit: (match: LibraryPovMatch) => void;
  onMove: (match: LibraryPovMatch) => void;
  onDelete: (match: LibraryPovMatch) => void;
}

const getCharacterTypeBadgeInfo = (type: CharacterType) => {
  switch (type) {
    case 'demonio':
      return { label: 'Demonio', icon: Skull, bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' };
    case 'esbirro':
      return { label: 'Esbirro', icon: Skull, bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' };
    case 'forastero':
      return { label: 'Forastero', icon: HelpCircle, bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/30' };
    case 'aldeano':
      return { label: 'Aldeano', icon: Shield, bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' };
    case 'viajero':
      return { label: 'Viajero', icon: Compass, bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' };
    case 'narrador':
      return { label: 'Narrador', icon: Scroll, bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' };
    default:
      return { label: type, icon: Users, bg: 'bg-slate-500/15', text: 'text-slate-400', border: 'border-slate-500/30' };
  }
};

export const PovMatchCard: React.FC<PovMatchCardProps> = ({
  match,
  isAdmin,
  onOpenPlayer,
  onEdit,
  onMove,
  onDelete
}) => {
  const povCount = (match.povs || []).length;
  
  // Extraer tipos presentes únicos en esta partida
  const availableTypes = Array.from(
    new Set((match.povs || []).map(p => p.characterType))
  );

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-surface-container/80 via-surface-container/50 to-surface-container-low/40 border border-outline-ghost/60 hover:border-theme-main/60 transition-all gap-4 group shadow-md hover:shadow-xl hover:shadow-theme-main/5">
      <div className="flex items-start md:items-center gap-4 min-w-0 flex-1">
        {/* Visual Distintivo "Partida POV / Multicámara" en vez de simple miniatura de YT */}
        <button
          type="button"
          onClick={() => onOpenPlayer(match)}
          className="relative shrink-0 block rounded-xl overflow-hidden border border-theme-main/40 bg-gradient-to-br from-background via-surface-container-high to-background p-0.5 group/thumb cursor-pointer shadow-lg hover:border-theme-main hover:shadow-theme-main/20 transition-all text-left"
          title={`Reproducir partida multicámara: ${match.title}`}
        >
          <div className="w-28 h-18 sm:w-32 sm:h-20 rounded-[10px] bg-surface-container flex flex-col items-center justify-center relative overflow-hidden p-2">
            {/* Fondo con diseño geométrico y resplandor temático */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-theme-main/20 via-background/60 to-background opacity-80" />
            <div className="absolute -top-6 -right-6 w-16 h-16 bg-red-500/10 rounded-full blur-md pointer-events-none" />
            <div className="absolute -bottom-6 -left-6 w-16 h-16 bg-theme-main/10 rounded-full blur-md pointer-events-none" />

            {/* Icono central multicámara con badge interactivo */}
            <div className="relative z-10 flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-theme-main/20 border border-theme-main/50 flex items-center justify-center text-theme-main shadow-inner group-hover/thumb:scale-110 group-hover/thumb:bg-theme-main group-hover/thumb:text-background transition-all duration-300">
                <Play className="w-4 h-4 fill-current ml-0.5" />
              </div>
              <div className="flex items-center gap-1 text-[10px] font-display font-bold uppercase tracking-wider text-theme-main bg-background/80 px-1.5 py-0.5 rounded border border-theme-main/30 shadow-sm">
                <Layers className="w-2.5 h-2.5" />
                <span>{povCount} POVs</span>
              </div>
            </div>

            {/* Indicador de multicámara en esquina */}
            <div className="absolute top-1 left-1.5 flex items-center gap-0.5 text-[9px] font-mono text-on-surface-muted/60">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span>MULTICAM</span>
            </div>
          </div>
        </button>

        {/* Detalles de la Partida POV */}
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => onOpenPlayer(match)}
              className="font-display font-semibold text-base md:text-lg text-on-surface hover:text-theme-main transition-colors flex items-center gap-1.5 text-left group/title cursor-pointer"
            >
              <span>{match.title}</span>
              <Eye className="w-4 h-4 opacity-0 group-hover/title:opacity-100 transition-opacity text-theme-main" />
            </button>

            {/* Badge distintivo de Partida POV */}
            <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full bg-theme-main/15 text-theme-main border border-theme-main/30 shadow-sm">
              <Sparkles className="w-3 h-3" />
              <span>Partida POV</span>
            </span>

            {/* Badges de acceso */}
            <AccessBadge accessLevel={match.accessLevel} allowedRoles={match.allowedRoles} />
          </div>

          {match.description && (
            <p className="text-xs text-on-surface-muted mt-1 line-clamp-2 leading-relaxed">
              {match.description}
            </p>
          )}

          {/* Resumen visual de perspectivas disponibles */}
          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
            <span className="text-[11px] text-on-surface-muted/80 font-display font-medium flex items-center gap-1 mr-1">
              <Users className="w-3.5 h-3.5 text-theme-main" />
              <span>Perspectivas:</span>
            </span>

            {availableTypes.map(type => {
              const info = getCharacterTypeBadgeInfo(type);
              const countInType = (match.povs || []).filter(p => p.characterType === type).length;
              const Icon = info.icon;
              return (
                <span
                  key={type}
                  className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md ${info.bg} ${info.text} border ${info.border}`}
                  title={`${countInType} ${info.label}${countInType > 1 ? 's' : ''}`}
                >
                  <Icon className="w-2.5 h-2.5" />
                  <span>{info.label} ({countInType})</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Botón principal de Ver Partida & Acciones Admin */}
      <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
        <button
          type="button"
          onClick={() => onOpenPlayer(match)}
          className="px-3.5 py-1.5 text-xs font-display font-semibold text-background bg-theme-main hover:bg-theme-main/90 rounded-xl transition-all flex items-center gap-1.5 shadow-md hover:shadow-theme-main/20 cursor-pointer"
          title="Abrir reproductor interactivo multicámara"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Ver Partida</span>
        </button>

        {isAdmin && (
          <div className="flex items-center gap-1 border-l border-outline-ghost/40 pl-2">
            <button
              onClick={() => onMove(match)}
              className="p-1.5 text-xs text-sky-400/80 hover:text-sky-400 hover:bg-sky-500/10 rounded-lg transition-all"
              title="Mover partida de sección"
            >
              <Move className="w-4 h-4" />
            </button>

            <button
              onClick={() => onEdit(match)}
              className="p-1.5 text-xs text-on-surface-muted hover:text-white hover:bg-surface-container-high rounded-lg transition-all"
              title="Editar partida y POVs"
            >
              <Pencil className="w-4 h-4" />
            </button>

            <button
              onClick={() => onDelete(match)}
              className="p-1.5 text-xs text-red-400/80 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
              title="Eliminar partida POV"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
export default PovMatchCard;
