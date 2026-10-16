import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { alpha } from '../rituales/ritualKinds';
import { BANDOS, EDICIONES, SIN_BANDO, type FiltrosPersonajes } from './filtrado';

interface FiltrosGrimorioProps {
  filtros: FiltrosPersonajes;
  onCambiar: (cambio: Partial<FiltrosPersonajes>) => void;
  onLimpiar: () => void;
  total: number;
  mostrados: number;
  /** Cuántos personajes saldrían al elegir esa edición o ese bando (con el resto de filtros como están). */
  cuentaEdicion: (id: string) => number;
  cuentaBando: (id: string) => number;
}

const personajes = (n: number) => `${n} ${n === 1 ? 'personaje' : 'personajes'}`;

/**
 * Buscador y filtros del compendio de personajes.
 *
 * - Las ediciones son fichas con su logo oficial (o un medallón) y los bandos,
 *   chips con el icono del bando; cada opción dice cuántos personajes saldrían
 *   al elegirla. Al marcar una opción no cambia su tamaño: solo el borde y el brillo.
 * - Fábulas y Loric no tienen bando: con ellas el filtro de bando no aparece.
 * - La tecla «/» lleva al buscador, que no distingue tildes ni mayúsculas.
 * - El lector oye cuántos personajes quedan al cambiar un filtro (con una pausa,
 *   para no anunciarlo en cada letra que se escribe).
 */
const FiltrosGrimorio = ({ filtros, onCambiar, onLimpiar, total, mostrados, cuentaEdicion, cuentaBando }: FiltrosGrimorioProps) => {
  const buscador = useRef<HTMLInputElement>(null);
  const filaEdiciones = useRef<HTMLDivElement>(null);
  const sinBando = SIN_BANDO.includes(filtros.edicion);

  // «/» enfoca el buscador, salvo si ya se está escribiendo en otro campo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
      e.preventDefault();
      buscador.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // En pantallas estrechas las ediciones se deslizan en horizontal: al llegar, la fila se coloca en la elegida.
  useEffect(() => {
    const fila = filaEdiciones.current;
    const elegida = fila?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (fila && elegida && fila.scrollWidth > fila.clientWidth) {
      fila.scrollLeft = elegida.offsetLeft - fila.offsetLeft - 8;
    }
    // Solo al montar: después es el usuario quien mueve la fila.
  }, []);

  // Aviso para el lector: el número de resultados, un momento después del último cambio, y se borra al rato.
  const [anuncio, setAnuncio] = useState('');
  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    const mostrar = window.setTimeout(() => setAnuncio(mostrados === 0 ? 'Ningún personaje coincide' : personajes(mostrados)), 700);
    const borrar = window.setTimeout(() => setAnuncio(''), 6000);
    return () => {
      window.clearTimeout(mostrar);
      window.clearTimeout(borrar);
    };
  }, [mostrados, filtros.q, filtros.edicion, filtros.bando]);

  const edicionActiva = EDICIONES.find((e) => e.id === filtros.edicion);
  const bandoActivo = BANDOS.find((b) => b.id === filtros.bando);
  const aplicados = [
    ...(filtros.q.trim() ? [{ id: 'q', label: `«${filtros.q.trim()}»`, quitar: () => onCambiar({ q: '' }) }] : []),
    ...(edicionActiva && edicionActiva.id !== 'all'
      ? [{ id: 'edicion', label: edicionActiva.label, lang: edicionActiva.lang, quitar: () => onCambiar({ edicion: 'all' }) }]
      : []),
    ...(bandoActivo && bandoActivo.id !== 'all' && !sinBando
      ? [{ id: 'bando', label: bandoActivo.label, quitar: () => onCambiar({ bando: 'all' }) }]
      : [])
  ];

  return (
    <div className="panel-premium rounded-sm p-5 md:p-7 flex flex-col gap-7">
      {/* Buscador */}
      <div role="search" className="relative">
        <label htmlFor="grimorio-buscar" className="sr-only">
          Buscar personaje
        </label>
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-main pointer-events-none" />
        <input
          ref={buscador}
          id="grimorio-buscar"
          type="search"
          value={filtros.q}
          onChange={(e) => onCambiar({ q: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && filtros.q) {
              e.preventDefault();
              onCambiar({ q: '' });
            }
          }}
          placeholder="Nombre, habilidad o palabra clave: Lavandera, Imp, envenenado…"
          autoComplete="off"
          spellCheck={false}
          className="campo !py-3.5 !pl-12 !pr-14 !text-base [&::-webkit-search-cancel-button]:appearance-none"
        />
        {filtros.q ? (
          <button
            type="button"
            onClick={() => {
              onCambiar({ q: '' });
              buscador.current?.focus();
            }}
            aria-label="Borrar la búsqueda"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 btn-sello btn-sello-icono !rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          <kbd
            aria-hidden="true"
            className="hidden md:flex absolute right-3.5 top-1/2 -translate-y-1/2 items-center justify-center w-7 h-7 rounded-sm border border-theme-main/30 font-ui text-xs text-theme-main/80 bg-background/60 pointer-events-none"
          >
            /
          </kbd>
        )}
      </div>

      {/* Edición */}
      <div role="group" aria-labelledby="grimorio-filtro-edicion" className="flex flex-col gap-3">
        <span id="grimorio-filtro-edicion" className="rotulo">
          Edición
        </span>
        <div ref={filaEdiciones} className="flex gap-2.5 overflow-x-auto snap-x pb-1 -mb-1 lg:grid lg:grid-cols-7 lg:overflow-visible">
          {EDICIONES.map((ed) => {
            const activo = filtros.edicion === ed.id;
            const cuenta = cuentaEdicion(ed.id);
            const Icon = ed.icon;
            return (
              <button
                key={ed.id}
                type="button"
                onClick={() => onCambiar({ edicion: ed.id })}
                aria-pressed={activo}
                className={`group relative snap-start shrink-0 w-32 lg:w-auto h-28 flex flex-col items-center justify-center gap-2 px-2 pt-2 rounded-sm border cursor-pointer transition-all duration-200 motion-reduce:transition-none ${
                  activo
                    ? 'border-theme-main bg-[linear-gradient(180deg,rgba(212,175,106,0.14),rgba(212,175,106,0.03))] shadow-[0_0_22px_rgba(212,175,106,0.18),inset_0_1px_0_rgba(212,175,106,0.35)]'
                    : 'border-outline-ghost bg-background/50 hover:border-theme-main/50 hover:bg-surface-container/60'
                } ${cuenta === 0 && !activo ? 'opacity-45' : ''}`}
              >
                {ed.logo ? (
                  <img
                    src={ed.logo}
                    alt=""
                    className={`h-14 w-auto max-w-full object-contain drop-shadow-[0_3px_6px_rgba(0,0,0,0.8)] transition-all duration-200 motion-reduce:transition-none ${
                      activo ? '' : 'grayscale-[0.7] opacity-70 group-hover:grayscale-0 group-hover:opacity-100'
                    }`}
                  />
                ) : (
                  <span className="medallon w-11 h-11">
                    <Icon className={`w-[1.1rem] h-[1.1rem] ${activo ? 'text-gold-bright' : 'text-theme-main/80'}`} />
                  </span>
                )}
                <span
                  lang={ed.lang}
                  className={`font-ui text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-center leading-tight ${
                    activo ? 'text-gold-bright' : 'text-on-surface-muted group-hover:text-on-surface'
                  }`}
                >
                  {ed.label}
                </span>
                <span
                  aria-hidden="true"
                  className={`absolute top-1.5 right-1.5 min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-full font-ui text-[0.6rem] tabular-nums ${
                    activo ? 'bg-theme-main text-[#1a1206] font-bold' : 'bg-surface-container text-on-surface-muted border border-outline-ghost'
                  }`}
                >
                  {cuenta}
                </span>
                <span className="sr-only">, {personajes(cuenta)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bando: las fábulas y los Loric no tienen bando, así que con ellas no aplica y no se muestra */}
      {!sinBando && (
        <div role="group" aria-labelledby="grimorio-filtro-bando" className="flex flex-col gap-3">
          <span id="grimorio-filtro-bando" className="rotulo">
            Bando
          </span>
          <div className="flex flex-wrap gap-2">
            {BANDOS.map((b) => {
              const activo = filtros.bando === b.id;
              const cuenta = cuentaBando(b.id);
              const Icon = b.icon;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onCambiar({ bando: b.id })}
                  aria-pressed={activo}
                  className={`inline-flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full border text-[0.9rem] cursor-pointer transition-all duration-200 motion-reduce:transition-none ${
                    activo
                      ? 'border-theme-main bg-theme-main/[0.1] text-gold-bright shadow-[0_0_16px_rgba(212,175,106,0.15)]'
                      : 'border-outline-ghost bg-background/50 text-on-surface/85 hover:border-theme-main/50 hover:text-on-surface'
                  } ${cuenta === 0 && !activo ? 'opacity-45' : ''}`}
                >
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center border"
                    style={{ borderColor: alpha(b.color, 0.55), backgroundColor: alpha(b.color, 0.12) }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: b.color }} />
                  </span>
                  {b.label}
                  <span aria-hidden="true" className="font-ui text-[0.7rem] tabular-nums text-on-surface-muted">
                    {cuenta}
                  </span>
                  <span className="sr-only">, {personajes(cuenta)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Resultado: cuántos salen, los filtros aplicados (se quitan uno a uno) y limpiar todo */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 pt-5 border-t border-outline-ghost/60">
        <p className="font-ui text-xs uppercase tracking-[0.14em] text-on-surface-muted">
          <span className="font-ui text-lg font-semibold normal-case tracking-normal text-gold-bright tabular-nums align-middle">{mostrados}</span>{' '}
          de {total} personajes
        </p>
        {aplicados.length > 0 && (
          <>
            <ul aria-label="Filtros aplicados" className="flex flex-wrap gap-2">
              {aplicados.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={f.quitar}
                    aria-label={`Quitar filtro: ${f.label}`}
                    className="group inline-flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full border border-theme-main/40 bg-theme-main/[0.06] text-sm text-on-surface hover:border-blood-bright/60 hover:bg-blood/20 transition-colors cursor-pointer"
                  >
                    <span lang={'lang' in f ? f.lang : undefined}>{f.label}</span>
                    <X className="w-3.5 h-3.5 text-theme-main group-hover:text-blood-bright" />
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={onLimpiar} className="btn-sello sm:ml-auto">
              Limpiar filtros
            </button>
          </>
        )}
      </div>

      <p role="status" className="sr-only">
        {anuncio}
      </p>
    </div>
  );
};

export default FiltrosGrimorio;
