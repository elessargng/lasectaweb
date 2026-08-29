import { Globe, Lock, Shield } from 'lucide-react';
import { LIBRARY_ASSIGNABLE_ROLES, type LibraryAccessLevel } from '../utils/libraryApi';

interface AccessLevelSelectorProps {
  accessLevel: LibraryAccessLevel;
  allowedRoles: string[];
  onAccessLevelChange: (level: LibraryAccessLevel) => void;
  onAllowedRolesChange: (roles: string[]) => void;
  /** Texto de ayuda mostrado bajo el selector (ej: aviso de cascada en carpetas) */
  helpText?: string;
}

const BUTTON_BASE =
  'flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-medium transition-all';
const BUTTON_INACTIVE =
  'bg-surface-container border-outline-ghost/60 text-on-surface-muted hover:border-outline-ghost hover:text-on-surface';

/**
 * Selector de restricción de acceso compartido por carpetas, documentos y enlaces
 * de La Biblioteca.
 */
export default function AccessLevelSelector({
  accessLevel,
  allowedRoles,
  onAccessLevelChange,
  onAllowedRolesChange,
  helpText
}: AccessLevelSelectorProps) {
  const options: { level: LibraryAccessLevel; label: string; icon: typeof Globe; active: string }[] = [
    { level: 'all', label: 'Todos', icon: Globe, active: 'bg-theme-main/20 border-theme-main text-theme-main font-semibold' },
    { level: 'registered', label: 'Registrados', icon: Lock, active: 'bg-amber-500/20 border-amber-500 text-amber-300 font-semibold' },
    { level: 'roles', label: 'Por Roles', icon: Shield, active: 'bg-purple-500/20 border-purple-500 text-purple-300 font-semibold' }
  ];

  const toggleRole = (role: string, checked: boolean) => {
    if (checked) {
      onAllowedRolesChange([...allowedRoles, role]);
    } else {
      onAllowedRolesChange(allowedRoles.filter(r => r !== role));
    }
  };

  return (
    <div>
      <label className="block text-xs font-display tracking-wider text-on-surface-muted uppercase mb-1">
        Restricción de Acceso
      </label>
      <div className="grid grid-cols-3 gap-2 mb-2">
        {options.map(({ level, label, icon: Icon, active }) => (
          <button
            key={level}
            type="button"
            onClick={() => onAccessLevelChange(level)}
            className={`${BUTTON_BASE} ${accessLevel === level ? active : BUTTON_INACTIVE}`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {accessLevel === 'roles' && (
        <div className="p-3 rounded-xl bg-surface-container-low/60 border border-purple-500/30 flex flex-col gap-2 mt-2">
          <span className="text-xs font-medium text-purple-200">Selecciona los roles con acceso:</span>
          <div className="flex items-center gap-4 flex-wrap">
            {LIBRARY_ASSIGNABLE_ROLES.map(role => (
              <label key={role} className="inline-flex items-center gap-2 text-xs text-on-surface cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowedRoles.includes(role)}
                  onChange={e => toggleRole(role, e.target.checked)}
                  className="rounded bg-surface-container border-outline-ghost text-purple-500 focus:ring-purple-500/40"
                />
                <span className="capitalize">{role}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {helpText && (
        <p className="text-[11px] text-on-surface-muted mt-2 leading-relaxed">{helpText}</p>
      )}
    </div>
  );
}
