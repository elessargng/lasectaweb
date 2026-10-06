import { useEffect, useRef, useState } from 'react';
import { CalendarPlus, ChevronDown, Download, FileJson, Image as ImageIcon } from 'lucide-react';
import type { Ritual } from '../../utils/ritualsApi';
import {
  IMAGE_TEMPLATES,
  exportIcs,
  exportImage,
  exportJson,
  isImageExportAvailable,
  type ImageTemplate
} from '../../utils/ritualExport';
import { RITUAL_KINDS, type RitualKind } from './ritualKinds';

interface RitualExportMenuProps {
  /** Los rituales que se ven: ya filtrados por clase y limitados al mes. */
  rituals: Ritual[];
  month: Date;
  /** Las clases que están a la vista, para contarlo y dejarlo en la exportación. */
  shownKinds: RitualKind[];
}

/** Botón "Exportar" de la agenda: calendario (.ics), JSON o imagen. */
export const RitualExportMenu = ({ rituals, month, shownKinds }: RitualExportMenuProps) => {
  const [open, setOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [template, setTemplate] = useState<ImageTemplate>('defecto');
  const ref = useRef<HTMLDivElement>(null);

  // Una jornada se repite en varios días de la agenda, pero se exporta una vez.
  const count = new Set(rituals.map((r) => r.occurrenceKey ?? r.id)).size;
  const empty = count === 0;
  const monthName = month.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const run = (action: () => void | Promise<void>) => {
    action();
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 border text-xs font-display uppercase tracking-wider transition-colors ${
          open ? 'border-theme-main/60 text-theme-main bg-theme-container/40' : 'border-outline-ghost text-on-surface-muted hover:text-on-surface'
        }`}
      >
        <Download className="w-3.5 h-3.5" /> Exportar <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 z-40 w-80 max-w-[calc(100vw-2rem)] bg-surface-container border border-outline-ghost shadow-2xl"
        >
          <div className="px-4 py-3 border-b border-outline-ghost/60">
            <p className="text-sm text-on-surface first-letter:uppercase">{monthName}</p>
            <p className="text-xs text-on-surface-muted">
              {empty ? 'Nada que exportar con los filtros actuales' : `${count} ${count === 1 ? 'ritual' : 'rituales'} con los filtros actuales`}
            </p>
            <div className="flex flex-wrap gap-1 mt-2">
              {shownKinds.map((k) => (
                <span key={k} className="w-2 h-2 rotate-45" style={{ backgroundColor: RITUAL_KINDS[k].color }} title={RITUAL_KINDS[k].label} />
              ))}
            </div>
          </div>

          <MenuItem
            icon={CalendarPlus}
            title="Calendario (.ics)"
            hint="Para importar en Google Calendar, Outlook o el calendario del móvil"
            disabled={empty}
            onClick={() => run(() => exportIcs(rituals, month))}
          />
          <MenuItem
            icon={FileJson}
            title="JSON"
            hint="Los datos en bruto, para otras herramientas"
            disabled={empty}
            onClick={() => run(() => exportJson(rituals, month, shownKinds))}
          />
          <MenuItem
            icon={ImageIcon}
            title="Imagen (.jpg)"
            hint="Para compartir en redes"
            disabled={empty}
            expanded={imageOpen}
            onClick={() => setImageOpen((o) => !o)}
          />

          {imageOpen && !empty && (
            <div className="px-4 pb-4 pt-1 flex flex-col gap-2 border-t border-outline-ghost/40 bg-surface-container-low/60">
              <span className="text-[10px] font-display uppercase tracking-wider text-on-surface-muted mt-2">Plantilla</span>
              {IMAGE_TEMPLATES.map((t) => (
                <label key={t.id} className="flex items-start gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="plantilla"
                    checked={template === t.id}
                    onChange={() => setTemplate(t.id)}
                    className="mt-1 accent-violet-300"
                  />
                  <span>
                    <span className="block text-on-surface">{t.label}</span>
                    <span className="block text-xs text-on-surface-muted">{t.hint}</span>
                  </span>
                </label>
              ))}
              <button
                type="button"
                onClick={() => run(() => exportImage(rituals, month, template))}
                className="mt-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border border-theme-main/40 text-xs font-display uppercase tracking-wider text-theme-main hover:bg-theme-container/40 transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Descargar imagen
              </button>
              {!isImageExportAvailable(template) && (
                <p className="text-[11px] italic text-on-surface-muted">Esta plantilla aún no está disponible.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface MenuItemProps {
  icon: typeof Download;
  title: string;
  hint: string;
  disabled?: boolean;
  expanded?: boolean;
  onClick: () => void;
}

const MenuItem = ({ icon: Icon, title, hint, disabled, expanded, onClick }: MenuItemProps) => (
  <button
    type="button"
    role="menuitem"
    disabled={disabled}
    onClick={onClick}
    aria-expanded={expanded}
    className="w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
  >
    <Icon className="w-4 h-4 mt-0.5 text-theme-main shrink-0" />
    <span className="flex-1">
      <span className="block text-sm text-on-surface">{title}</span>
      <span className="block text-xs text-on-surface-muted">{hint}</span>
    </span>
    {expanded !== undefined && <ChevronDown className={`w-4 h-4 mt-0.5 text-on-surface-muted transition-transform ${expanded ? 'rotate-180' : ''}`} />}
  </button>
);

export default RitualExportMenu;
