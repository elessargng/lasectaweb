import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, GitCommitHorizontal, List } from 'lucide-react';
import type { Ritual } from '../../utils/ritualsApi';
import { urlDelServidor } from '../../utils/api';
import RitualPhotoTimeline from './RitualPhotoTimeline';
import { PhotoLink } from './RitualPhotos';
import { addDays, describeDates, startOfDay } from './ritualDates';

interface RitualPhotoAlbumProps {
  /** Todos los eventos con fotos que se pueden ver, del más reciente al más antiguo. */
  rituals: Ritual[];
  onOpen: (ritual: Ritual) => void;
}

type Vista = 'lista' | 'linea';

const VISTAS: Array<[Vista, string, typeof List]> = [
  ['lista', 'Lista', List],
  ['linea', 'Línea', GitCommitHorizontal]
];

const MESES = Array.from({ length: 12 }, (_, m) => {
  const nombre = new Date(2000, m, 1).toLocaleDateString('es-ES', { month: 'long' });
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
});

const fotos = (n: number) => (n === 1 ? 'una foto' : `${n} fotos`);

/**
 * Las fotos de los eventos de un periodo (de entrada, el año en curso), en una lista
 * vertical o en una línea horizontal con un punto por evento: al elegir uno, sus fotos
 * salen debajo en un carrusel.
 */
export const RitualPhotoAlbum = ({ rituals, onOpen }: RitualPhotoAlbumProps) => {
  const esteAnio = new Date().getFullYear();
  const [anio, setAnio] = useState(esteAnio);
  const [desde, setDesde] = useState(0);
  const [hasta, setHasta] = useState(11);
  const [vista, setVista] = useState<Vista>('lista');
  const [elegido, setElegido] = useState<string | null>(null);

  // Los años con fotos y, aunque no tenga, el actual
  const anios = useMemo(
    () => [...new Set([esteAnio, ...rituals.map((r) => new Date(r.startsAt).getFullYear())])].sort((a, b) => b - a),
    [rituals, esteAnio]
  );

  const inicio = new Date(anio, desde, 1);
  const fin = new Date(anio, hasta + 1, 1);
  const enPeriodo = rituals.filter((r) => new Date(r.startsAt) < fin && new Date(r.endsAt ?? r.startsAt) >= inicio);
  const elegidoEnPeriodo = enPeriodo.find((r) => r.id === elegido) ?? null;
  const periodo =
    desde === 0 && hasta === 11
      ? `${anio}`
      : desde === hasta
        ? `${MESES[desde].toLowerCase()} de ${anio}`
        : `de ${MESES[desde].toLowerCase()} a ${MESES[hasta].toLowerCase()} de ${anio}`;

  const cambiarDesde = (m: number) => {
    setDesde(m);
    if (m > hasta) setHasta(m);
  };
  const cambiarHasta = (m: number) => {
    setHasta(m);
    if (m < desde) setDesde(m);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* El periodo y la forma de verlo */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div>
          <label htmlFor="fotos-anio" className="campo-etiqueta">
            Año
          </label>
          <select id="fotos-anio" value={anio} onChange={(e) => setAnio(Number(e.target.value))} className="campo w-auto">
            {anios.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="fotos-desde" className="campo-etiqueta">
            Desde
          </label>
          <select id="fotos-desde" value={desde} onChange={(e) => cambiarDesde(Number(e.target.value))} className="campo w-auto">
            {MESES.map((nombre, m) => (
              <option key={nombre} value={m}>
                {nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="fotos-hasta" className="campo-etiqueta">
            Hasta
          </label>
          <select id="fotos-hasta" value={hasta} onChange={(e) => cambiarHasta(Number(e.target.value))} className="campo w-auto">
            {MESES.map((nombre, m) => (
              <option key={nombre} value={m}>
                {nombre}
              </option>
            ))}
          </select>
        </div>
        <div role="group" aria-label="Mostrar como" className="segmentado sm:ml-auto">
          {VISTAS.map(([v, label, Icon]) => (
            <button key={v} type="button" onClick={() => setVista(v)} aria-pressed={vista === v}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Cuántos hay: se anuncia al cambiar el periodo */}
      <p role="status" className="text-sm text-on-surface-muted -mt-2">
        {enPeriodo.length === 0
          ? `No hay fotos de eventos en ${periodo}.`
          : `${enPeriodo.length === 1 ? 'Un evento' : `${enPeriodo.length} eventos`} con fotos en ${periodo}.`}
      </p>

      {enPeriodo.length > 0 &&
        (vista === 'lista' ? (
          <RitualPhotoTimeline rituals={enPeriodo} onOpen={onOpen} />
        ) : (
          <>
            <LineaDeEventos
              rituals={[...enPeriodo].reverse()}
              inicio={inicio}
              fin={fin}
              mesesDesde={desde}
              mesesHasta={hasta}
              elegido={elegidoEnPeriodo?.id ?? null}
              onElegir={setElegido}
            />
            {elegidoEnPeriodo ? (
              <CarruselFotos key={elegidoEnPeriodo.id} ritual={elegidoEnPeriodo} onOpen={onOpen} />
            ) : (
              <p className="text-center py-8 text-on-surface-muted italic font-body border border-dashed border-outline-ghost/70">
                Elige un evento de la línea para ver sus fotos.
              </p>
            )}
          </>
        ))}
    </div>
  );
};

interface LineaDeEventosProps {
  /** Del más antiguo al más reciente. */
  rituals: Ritual[];
  inicio: Date;
  fin: Date;
  mesesDesde: number;
  mesesHasta: number;
  elegido: string | null;
  onElegir: (id: string) => void;
}

/** Lo que separa dos puntos en la misma altura (en % del ancho); si están más cerca, uno sube. */
const SEPARACION = 4;
const ALTO_CARRIL = 22;

/**
 * El periodo como una línea, con las marcas de los meses (o de las semanas, si es un
 * mes) y un rombo por evento, en su fecha; las jornadas llevan además una cinta hasta
 * su último día. Cada rombo es un botón con el evento, sus fechas y sus fotos.
 */
const LineaDeEventos = ({ rituals, inicio, fin, mesesDesde, mesesHasta, elegido, onElegir }: LineaDeEventosProps) => {
  const total = fin.getTime() - inicio.getTime();
  const pos = (fecha: Date) => Math.min(100, Math.max(0, ((fecha.getTime() - inicio.getTime()) / total) * 100));

  // Las marcas: los meses del periodo, o las semanas si solo es uno
  const marcas: Array<{ x: number; texto: string }> =
    mesesDesde === mesesHasta
      ? [1, 8, 15, 22, 29]
          .map((d) => new Date(inicio.getFullYear(), mesesDesde, d))
          .filter((d) => d < fin)
          .map((d) => ({ x: pos(d), texto: String(d.getDate()) }))
      : Array.from({ length: mesesHasta - mesesDesde + 1 }, (_, i) => {
          const d = new Date(inicio.getFullYear(), mesesDesde + i, 1);
          return { x: pos(d), texto: d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '') };
        });

  // Cada evento en el carril más bajo donde no pisa al anterior
  const finDeCarril: number[] = [];
  const puntos = rituals.map((r) => {
    const x = pos(new Date(r.startsAt));
    const xFin = r.endsAt ? pos(addDays(startOfDay(new Date(r.endsAt)), 1)) : x;
    let carril = finDeCarril.findIndex((ocupado) => x - ocupado >= SEPARACION);
    if (carril === -1) carril = finDeCarril.length;
    finDeCarril[carril] = Math.max(x, xFin);
    return { ritual: r, x, xFin, carril };
  });
  const carriles = Math.max(1, finDeCarril.length);
  // Arriba queda sitio para la etiqueta del punto más alto, que si no se recortaría
  const alto = carriles * ALTO_CARRIL + 40 + 28;

  return (
    // En pantallas estrechas la línea se desliza por dentro, sin mover la página
    <div className="overflow-x-auto pb-2 -mx-1 px-1">
      <div className="relative min-w-[36rem] mx-3" style={{ height: alto }}>
        {/* La línea y sus marcas (decorativas: cada punto dice su fecha) */}
        <div aria-hidden="true">
          <span className="absolute inset-x-0 h-px bg-theme-main/45" style={{ bottom: 24 }} />
          {marcas.map(({ x, texto }) => (
            <span key={texto + x} className="absolute flex flex-col items-center -translate-x-1/2" style={{ left: `${x}%`, bottom: 0 }}>
              <span className="w-px h-2 bg-theme-main/45" />
              <span className="mt-1 font-ui text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-on-surface-muted">{texto}</span>
            </span>
          ))}
        </div>

        <ol>
          {puntos.map(({ ritual, x, xFin, carril }) => {
            const activo = ritual.id === elegido;
            const n = ritual.photos?.length ?? 0;
            const abajo = 24 - 7 + carril * ALTO_CARRIL;
            return (
              <li key={ritual.id}>
                {xFin - x > 0.5 && (
                  <span
                    aria-hidden="true"
                    className={`absolute h-1 rounded-full ${activo ? 'bg-theme-main' : 'bg-theme-main/35'}`}
                    style={{ left: `${x}%`, width: `${xFin - x}%`, bottom: abajo + 5 }}
                  />
                )}
                <button
                  type="button"
                  onClick={() => onElegir(ritual.id)}
                  aria-pressed={activo}
                  aria-label={`${ritual.title}, ${describeDates(ritual)}, ${fotos(n)}`}
                  data-tip={ritual.title}
                  className="absolute -translate-x-1/2 w-6 h-6 flex items-center justify-center cursor-pointer rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main group/punto"
                  style={{ left: `${x}%`, bottom: abajo - 5 }}
                >
                  <span
                    aria-hidden="true"
                    className={`block rotate-45 border transition-transform motion-reduce:transition-none ${
                      activo
                        ? 'w-3.5 h-3.5 bg-theme-main border-gold-bright shadow-[0_0_12px_rgba(212,175,106,0.8)]'
                        : 'w-3 h-3 bg-background border-theme-main group-hover/punto:bg-theme-main/60 group-hover/punto:scale-125'
                    }`}
                  />
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
};

/**
 * Las fotos de un evento, de una en una: la foto entera (abre la imagen), las flechas
 * para pasar y las miniaturas para saltar. Al pasar, el lector oye cuál es y qué se ve.
 */
const CarruselFotos = ({ ritual, onOpen }: { ritual: Ritual; onOpen: (ritual: Ritual) => void }) => {
  const photos = ritual.photos ?? [];
  const [i, setI] = useState(0);
  const [aviso, setAviso] = useState('');
  const tituloRef = useRef<HTMLHeadingElement>(null);

  // Al elegir un evento en la línea, el foco va a su título
  useEffect(() => {
    tituloRef.current?.focus();
  }, []);

  if (photos.length === 0) return null;
  const actual = Math.min(i, photos.length - 1);
  const photo = photos[actual];

  const ir = (j: number) => {
    const k = (j + photos.length) % photos.length;
    setI(k);
    setAviso(`Foto ${k + 1} de ${photos.length}: ${photos[k].alt}`);
  };

  return (
    <section aria-labelledby="fotos-carrusel-titulo" className="flex flex-col gap-4 p-4 md:p-6 border border-theme-main/25 rounded-sm bg-background/40">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3
            id="fotos-carrusel-titulo"
            ref={tituloRef}
            tabIndex={-1}
            className="font-display text-xl md:text-2xl text-gilded leading-tight break-words focus:outline-none"
          >
            {ritual.title}
          </h3>
          <p className="mt-1 text-sm text-on-surface-muted first-letter:uppercase">
            {describeDates(ritual)} · {fotos(photos.length)}
          </p>
        </div>
        <button type="button" onClick={() => onOpen(ritual)} className="btn-sello shrink-0">
          Ver el evento
        </button>
      </div>

      <figure className="flex flex-col gap-2">
        <div className="flex items-center gap-2 md:gap-3">
          {photos.length > 1 && (
            <button type="button" onClick={() => ir(actual - 1)} aria-label="Foto anterior" data-tip="Anterior" className="btn-sello btn-sello-icono shrink-0">
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <PhotoLink photo={photo} fit />
          </div>
          {photos.length > 1 && (
            <button type="button" onClick={() => ir(actual + 1)} aria-label="Foto siguiente" data-tip="Siguiente" className="btn-sello btn-sello-icono shrink-0">
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
        <figcaption className="flex flex-wrap justify-center gap-x-3 text-xs text-on-surface-muted">
          {photos.length > 1 && (
            <span aria-hidden="true" className="tabular-nums">
              {actual + 1} / {photos.length}
            </span>
          )}
          {photo.uploadedByUsername && <span>Subida por {photo.uploadedByUsername}</span>}
        </figcaption>
      </figure>

      <p role="status" className="sr-only">
        {aviso}
      </p>

      {photos.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((p, j) => (
            <li key={p.id} className="shrink-0">
              <button
                type="button"
                onClick={() => ir(j)}
                aria-label={`Foto ${j + 1}`}
                aria-current={j === actual ? 'true' : undefined}
                className={`block w-16 h-12 overflow-hidden rounded-sm border cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main ${
                  j === actual ? 'border-theme-main' : 'border-outline-ghost/70 opacity-60 hover:opacity-100'
                }`}
              >
                <img src={urlDelServidor(p.src)} alt="" loading="lazy" className="w-full h-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default RitualPhotoAlbum;
