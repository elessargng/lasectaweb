import { useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import type { SalaResultado } from './useSala';

/** Lo que hay que mover el puntero para que deje de ser un clic y sea un arrastre (px). */
const UMBRAL = 6;

interface Arrastre {
  desde: string;
  /** La ficha sobre la que se soltaría ahora (null: ninguna). */
  hasta: string | null;
  x: number;
  y: number;
}

interface Opciones {
  /** Se puede (narradores con el Gardener en juego, sin editar ni revelar). */
  activo: boolean;
  pedir: (accion: string, datos?: unknown) => Promise<SalaResultado>;
  onError: (mensaje: string) => void;
  /** Se ha hecho: lo que se anuncia (desde y hasta, ids de asiento). */
  onHecho: (desde: string, hasta: string) => void;
}

/**
 * Con el Gardener, el narrador arrastra una ficha sobre otra y se intercambian
 * sus personajes (y alineamientos). Las fichas llevan data-ficha con su asiento.
 * Mientras no se mueve el puntero es un clic (abre el menú de la ficha); al
 * arrastrar, ese clic no llega. Para el teclado y el lector, la opción
 * «Intercambiar con…» del menú de la ficha.
 */
export function useIntercambiarFichas({ activo, pedir, onError, onHecho }: Opciones) {
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);
  const inicio = useRef<{ desde: string; x: number; y: number } | null>(null);
  // Tras soltar, el clic que sigue no abre el menú
  const sinClic = useRef(false);

  const fichaEn = (x: number, y: number, desde: string) => {
    for (const el of document.elementsFromPoint(x, y)) {
      const id = (el as HTMLElement).closest<HTMLElement>('[data-ficha]')?.dataset.ficha;
      if (id && id !== desde) return id;
    }
    return null;
  };

  const intercambiar = async (desde: string, hasta: string) => {
    const r = await pedir('narrador:intercambiarFichas', { desde, hasta });
    if (r.ok) onHecho(desde, hasta);
    else onError(r.error);
  };

  /** Lo que lleva la capa de cada ficha. */
  const propsFicha = (asientoId: string) =>
    activo
      ? {
          'data-ficha': asientoId,
          onPointerDown: (e: PointerEvent<HTMLElement>) => {
            if (e.button !== 0) return;
            inicio.current = { desde: asientoId, x: e.clientX, y: e.clientY };
          },
          onPointerMove: (e: PointerEvent<HTMLElement>) => {
            const i = inicio.current;
            if (!i) return;
            if (!arrastre) {
              if (Math.hypot(e.clientX - i.x, e.clientY - i.y) < UMBRAL) return;
              e.currentTarget.setPointerCapture(e.pointerId);
            }
            setArrastre({ desde: i.desde, hasta: fichaEn(e.clientX, e.clientY, i.desde), x: e.clientX, y: e.clientY });
          },
          onPointerUp: () => {
            inicio.current = null;
            if (!arrastre) return;
            // El clic llega justo después de soltar (si llega): pasado ese momento, ya no se ignora
            sinClic.current = true;
            window.setTimeout(() => (sinClic.current = false), 0);
            setArrastre(null);
            if (arrastre.hasta) void intercambiar(arrastre.desde, arrastre.hasta);
          },
          onPointerCancel: () => {
            inicio.current = null;
            setArrastre(null);
          },
          onClickCapture: (e: MouseEvent<HTMLElement>) => {
            if (!sinClic.current) return;
            sinClic.current = false;
            e.preventDefault();
            e.stopPropagation();
          },
        }
      : {};

  return { arrastre: activo ? arrastre : null, propsFicha, intercambiar };
}
