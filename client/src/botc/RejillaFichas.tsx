import { Minus, Plus, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { urlDelServidor } from '../utils/api';
import { iconoDe } from './fichas';
import type { PersonajeMostrado } from './guiones';

/** Cómo va cada ficha de la rejilla. */
export interface MarcaFicha {
  /** Elegida (aria-pressed): resaltada en latón. */
  pulsada: boolean;
  /** Ya la lleva alguien (está en juego): apagada, con el sello «Asignado». */
  asignada?: boolean;
  /** No se puede elegir ahora (aria-disabled); pulsarla sigue llamando a `onPulsar`, para explicar por qué. */
  bloqueada?: boolean;
}

export interface GrupoFichas {
  tipo: string;
  /** El título del grupo («Aldeanos 2/5»). */
  titulo: ReactNode;
  /** Clase de color del título. */
  color: string;
  personajes: PersonajeMostrado[];
}

interface RejillaFichasProps {
  /** Prefijo de los ids de los títulos (uno por diálogo). */
  idBase: string;
  grupos: GrupoFichas[];
  marca: (p: PersonajeMostrado) => MarcaFicha;
  onPulsar: (p: PersonajeMostrado) => void;
  /** Señalar los que alteran la preparación (el Barón…), como en la bolsa. */
  conPreparacion?: boolean;
  /**
   * Fichas repetidas (la bolsa con el Pope o un repetible): cuántas hay de un personaje y cómo
   * cambiarlo; con alguna, debajo salen «−», el número y «+». null: sin repetidas.
   */
  cantidad?: (p: PersonajeMostrado) => { valor: number; max: number; onCambiar: (n: number) => void } | null;
}

/**
 * Los personajes por tipos, cada uno un botón con su icono y su nombre: lo que
 * comparten la bolsa y los faroles del narrador. Las elegidas van pulsadas
 * (aria-pressed); las que ya están en juego, apagadas y con el sello «Asignado»,
 * que también se lee.
 */
const botonCantidad =
  'flex h-6 w-6 items-center justify-center rounded-full border border-outline-ghost text-on-surface-muted hover:border-theme-main hover:text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main aria-disabled:cursor-not-allowed aria-disabled:opacity-40';

const RejillaFichas = ({ idBase, grupos, marca, onPulsar, conPreparacion = false, cantidad }: RejillaFichasProps) => (
  <div className="flex flex-col gap-5">
    {grupos.map(({ tipo, titulo, color, personajes }) => {
      if (personajes.length === 0) return null;
      return (
        <section key={tipo} aria-labelledby={`${idBase}-${tipo}`}>
          <h3 id={`${idBase}-${tipo}`} className={`mb-2 text-sm font-semibold uppercase tracking-wide ${color}`}>
            {titulo}
          </h3>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2">
            {personajes.map((p) => {
              const icono = iconoDe(p, null);
              const { pulsada, asignada = false, bloqueada = false } = marca(p);
              const preparacion = conPreparacion && p.preparacion;
              const cuantas = cantidad?.(p) ?? null;
              return (
                <li key={p.id} className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    aria-pressed={pulsada}
                    aria-disabled={bloqueada || undefined}
                    onClick={() => onPulsar(p)}
                    className={`relative flex w-full flex-col items-center gap-1 rounded border border-transparent p-2 text-center text-sm opacity-60 hover:border-theme-main/60 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main aria-pressed:border-theme-main aria-pressed:bg-theme-container aria-pressed:opacity-100 aria-disabled:cursor-not-allowed aria-disabled:hover:border-transparent aria-disabled:hover:opacity-60 ${
                      asignada ? 'bg-background/60' : ''
                    }`}
                  >
                    {preparacion && (
                      // Altera la preparación: señal de advertencia (el lector lo oye en el texto de abajo)
                      <TriangleAlert size={18} className="absolute right-1 top-1 text-gold-bright" />
                    )}
                    {icono ? (
                      <img
                        src={urlDelServidor(icono)}
                        alt=""
                        className={`h-14 w-14 object-contain ${asignada ? 'grayscale brightness-75' : ''}`}
                        loading="lazy"
                      />
                    ) : (
                      <span aria-hidden="true" className="h-14 w-14 rounded-full border border-outline-ghost" />
                    )}
                    <span lang={p.nombre.lang}>{p.nombre.texto}</span>
                    {preparacion && <span className="sr-only"> (altera la preparación)</span>}
                    {cuantas && cuantas.valor > 1 && (
                      <span className="absolute bottom-1 right-1 rounded-full bg-theme-main px-1.5 text-[0.65rem] font-bold text-background">
                        <span className="sr-only">, </span>×{cuantas.valor}
                      </span>
                    )}
                    {asignada && (
                      <span className="absolute left-1 top-1 rounded-sm border border-outline-ghost bg-background/90 px-1 font-ui text-[0.6rem] uppercase tracking-wide text-on-surface-muted">
                        <span className="sr-only">, </span>
                        Asignado
                      </span>
                    )}
                  </button>
                  {/* Repetidas (Pope o repetible): una menos, cuántas, una más */}
                  {cuantas && cuantas.valor > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Quitar una ficha de ${p.nombre.texto}`}
                        onClick={() => cuantas.onCambiar(cuantas.valor - 1)}
                        className={botonCantidad}
                      >
                        <Minus size={12} />
                      </button>
                      <span aria-hidden="true" className="min-w-[1ch] text-center text-sm tabular-nums">
                        {cuantas.valor}
                      </span>
                      <button
                        type="button"
                        aria-label={`Añadir otra ficha de ${p.nombre.texto}`}
                        aria-disabled={cuantas.valor >= cuantas.max || undefined}
                        onClick={() => cuantas.valor < cuantas.max && cuantas.onCambiar(cuantas.valor + 1)}
                        className={botonCantidad}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      );
    })}
  </div>
);

export default RejillaFichas;
