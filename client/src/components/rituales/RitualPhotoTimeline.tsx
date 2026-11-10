import { MapPin } from 'lucide-react';
import type { Ritual } from '../../utils/ritualsApi';
import { formatSpokenDate, isMultiDay } from './ritualDates';
import { PhotoGrid } from './RitualPhotos';

interface RitualPhotoTimelineProps {
  /** Los eventos con fotos, del más reciente al más antiguo. */
  rituals: Ritual[];
  onOpen: (ritual: Ritual) => void;
}

/** «12 – 14 de octubre de 2026», o el día si dura uno. */
function describeDates(ritual: Ritual): string {
  if (!isMultiDay(ritual)) return formatSpokenDate(ritual.startsAt);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
  const start = new Date(ritual.startsAt).toLocaleDateString('es-ES', opts);
  const end = new Date(ritual.endsAt!).toLocaleDateString('es-ES', opts);
  return `Del ${start} al ${end}`;
}

/**
 * Las fotos de los eventos en una línea de tiempo, del más reciente al más antiguo:
 * las públicas y las privadas de quien las mira (con su rótulo «Privada»).
 */
export const RitualPhotoTimeline = ({ rituals, onOpen }: RitualPhotoTimelineProps) => {
  if (rituals.length === 0) {
    return (
      <p className="text-center py-12 text-on-surface-muted italic font-body border border-dashed border-outline-ghost/70">
        Aún no hay fotos de ningún evento.
      </p>
    );
  }

  return (
    <ol className="relative border-l border-theme-main/30 ml-6 md:ml-7">
      {rituals.map((ritual) => {
        const start = new Date(ritual.startsAt);
        return (
          <li key={ritual.id} className="relative pl-9 md:pl-10 pb-10 last:pb-0">
            {/* El sello de la fecha: lo dice el texto de debajo */}
            <div
              aria-hidden="true"
              className="absolute -left-6 md:-left-7 top-0 w-12 md:w-14 flex flex-col items-center py-1.5 border border-theme-main/30 rounded-sm bg-[radial-gradient(circle_at_50%_30%,#1f2538,#0d0f17)]"
            >
              <span className="font-ui text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-theme-main/90">
                {start.toLocaleDateString('es-ES', { month: 'short' })}
              </span>
              <span className="font-display text-xl leading-none text-on-surface">{start.getDate()}</span>
              <span className="font-ui text-[0.55rem] text-on-surface-muted mt-0.5 tabular-nums">{start.getFullYear()}</span>
            </div>

            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <h3 className="font-display text-xl md:text-2xl text-gilded leading-tight break-words">{ritual.title}</h3>
                <p className="mt-1 text-sm text-on-surface-muted first-letter:uppercase">
                  {describeDates(ritual)}
                  {ritual.location && (
                    <span className="inline-flex items-center gap-1 ml-3">
                      <MapPin className="w-3.5 h-3.5 text-theme-main/70" /> {ritual.location}
                    </span>
                  )}
                </p>
              </div>
              <button type="button" onClick={() => onOpen(ritual)} className="btn-sello shrink-0">
                Ver el evento
              </button>
            </div>

            <PhotoGrid photos={ritual.photos ?? []} className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" />
          </li>
        );
      })}
    </ol>
  );
};

export default RitualPhotoTimeline;
