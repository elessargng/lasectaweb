import { LIBRARY_ICON_NAMES, LIBRARY_ICONS, DEFAULT_LIBRARY_ICON } from '../utils/libraryIcons';

interface IconPickerProps {
  value?: string | null;
  onChange: (icon: string | null) => void;
  label?: string;
  helpText?: string;
}

/**
 * Selector del icono asociado a una carpeta de La Biblioteca.
 * El valor almacenado es el nombre del icono dentro del catálogo `LIBRARY_ICONS`.
 */
export default function IconPicker({ value, onChange, label = 'Icono de la carpeta', helpText }: IconPickerProps) {
  const DefaultIcon = DEFAULT_LIBRARY_ICON;

  return (
    <div>
      <label className="block text-xs font-display tracking-wider text-on-surface-muted uppercase mb-1">
        {label}
      </label>

      <div className="p-2 rounded-xl bg-surface-container-low/60 border border-outline-ghost/60">
        <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5 max-h-44 overflow-y-auto pr-1">
          <button
            type="button"
            onClick={() => onChange(null)}
            title="Sin icono (por defecto)"
            className={`aspect-square flex items-center justify-center rounded-lg border transition-all ${
              !value
                ? 'bg-theme-main/20 border-theme-main text-theme-main'
                : 'bg-surface-container border-outline-ghost/50 text-on-surface-muted hover:text-on-surface hover:border-outline-ghost'
            }`}
          >
            <DefaultIcon className="w-4 h-4" />
          </button>

          {LIBRARY_ICON_NAMES.map(name => {
            const Icon = LIBRARY_ICONS[name];
            const isActive = value === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => onChange(name)}
                title={name}
                className={`aspect-square flex items-center justify-center rounded-lg border transition-all ${
                  isActive
                    ? 'bg-theme-main/20 border-theme-main text-theme-main'
                    : 'bg-surface-container border-outline-ghost/50 text-on-surface-muted hover:text-on-surface hover:border-outline-ghost'
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>
      </div>

      {helpText && (
        <p className="text-[11px] text-on-surface-muted mt-2 leading-relaxed">{helpText}</p>
      )}
    </div>
  );
}
