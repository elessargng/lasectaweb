import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { alineamientoDe } from './fichas';
import { nombreDeTipo, type PersonajeMostrado } from './guiones';
import type { SalaAlineamiento } from './useSala';

interface PistaPersonajeProps {
  personaje: PersonajeMostrado;
  alineamiento: SalaAlineamiento | null;
  /** La ficha junto a la que sale. */
  ancla: HTMLElement;
}

/** Separación con la ficha y con los bordes de la ventana (px). */
const HUECO = 10;
const MARGEN = 8;

/**
 * La pista de una ficha de la mesa (al pasar el ratón, con el foco o al tocarla):
 * el nombre del personaje en el color de su bando (azul los buenos, rojo los
 * malvados), su tipo y su habilidad. Va encima de la ficha (o debajo, si no
 * cabe), en el body para que no la tape nada, y sin salirse de la ventana. No
 * recibe el ratón. Solo visual: el lector ya oye el personaje en la ficha.
 */
const PistaPersonaje = ({ personaje, alineamiento, ancla }: PistaPersonajeProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [sitio, setSitio] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    const colocar = () => {
      const r = ancla.getBoundingClientRect();
      const caja = ref.current?.getBoundingClientRect();
      if (!caja) return;
      const left = Math.min(Math.max(MARGEN, r.left + r.width / 2 - caja.width / 2), window.innerWidth - caja.width - MARGEN);
      const arriba = r.top - caja.height - HUECO;
      setSitio({ left, top: arriba >= MARGEN ? arriba : r.bottom + HUECO });
    };
    colocar();
    window.addEventListener('resize', colocar);
    window.addEventListener('scroll', colocar, true);
    return () => {
      window.removeEventListener('resize', colocar);
      window.removeEventListener('scroll', colocar, true);
    };
  }, [ancla, personaje.id]);

  const bando = alineamientoDe(personaje, alineamiento);
  const color = bando === 'bueno' ? 'text-good-bright' : bando === 'malvado' ? 'text-blood-pale' : 'text-gold-bright';
  return createPortal(
    <div
      ref={ref}
      aria-hidden="true"
      className="sala-pista sala-cofre pointer-events-none fixed z-[45] w-max max-w-[min(20rem,calc(100vw-1rem))] px-4 py-3"
      style={sitio ?? { left: 0, top: 0, visibility: 'hidden' }}
    >
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span lang={personaje.nombre.lang} className={`font-display text-lg leading-tight ${color}`}>
          {personaje.nombre.texto}
        </span>
        <span className="font-ui text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-on-surface-muted">{nombreDeTipo(personaje.tipo)}</span>
      </p>
      {personaje.habilidad.texto && (
        <p lang={personaje.habilidad.lang} className="mt-1.5 border-t border-gold/20 pt-1.5 text-sm leading-snug text-on-surface">
          {personaje.habilidad.texto}
        </p>
      )}
    </div>,
    document.body,
  );
};

export default PistaPersonaje;
