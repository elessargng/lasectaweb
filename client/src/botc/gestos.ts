import { useCallback, useEffect, useRef, useState } from 'react';
import { ACCIONES_ATAJO, ATRIBUTO_CAPTURANDO, type AccionAtajo } from './atajos';

/**
 * Gestos táctiles de la sala, para móviles y tabletas (Preferencias > Atajos):
 * cada acción con atajo de teclado puede tener además un gesto, siempre con
 * varios dedos (con uno chocarían con el scroll, las fichas y el arrastre de
 * asientos). Se eligen de una lista fija y empiezan sin asignar.
 */
export const GESTOS = [
  { id: 'toque2', nombre: 'Toque con 2 dedos' },
  { id: 'dobleToque2', nombre: 'Doble toque con 2 dedos' },
  { id: 'toque3', nombre: 'Toque con 3 dedos' },
  { id: 'deslizar2-arriba', nombre: 'Deslizar 2 dedos ↑' },
  { id: 'deslizar2-abajo', nombre: 'Deslizar 2 dedos ↓' },
  { id: 'deslizar2-izquierda', nombre: 'Deslizar 2 dedos ←' },
  { id: 'deslizar2-derecha', nombre: 'Deslizar 2 dedos →' },
  { id: 'deslizar3-arriba', nombre: 'Deslizar 3 dedos ↑' },
  { id: 'deslizar3-abajo', nombre: 'Deslizar 3 dedos ↓' },
  { id: 'deslizar3-izquierda', nombre: 'Deslizar 3 dedos ←' },
  { id: 'deslizar3-derecha', nombre: 'Deslizar 3 dedos →' },
] as const;
export type Gesto = (typeof GESTOS)[number]['id'];
export type GestosAsignados = Partial<Record<AccionAtajo, Gesto>>;

/** Cómo se lee un gesto: «Deslizar 3 dedos ↓». */
export function describirGesto(g: Gesto): string {
  return GESTOS.find((x) => x.id === g)?.nombre ?? g;
}

const esGesto = (g: unknown): g is Gesto => GESTOS.some((x) => x.id === g);

/** Gestos válidos a partir de lo que sea (guardado, de un perfil…): lo que no valga, fuera. */
export function normalizarGestos(datos: unknown): GestosAsignados {
  const guardados = (datos && typeof datos === 'object' ? datos : {}) as Record<string, unknown>;
  const gestos: GestosAsignados = {};
  for (const { accion } of ACCIONES_ATAJO) {
    const g = guardados[accion];
    if (esGesto(g)) gestos[accion] = g;
  }
  return gestos;
}

/** Los gestos viven en memoria, como los atajos: con cuenta se guardan en el servidor (configuracion.ts). */
export function useGestos() {
  const [gestos, setGestos] = useState<GestosAsignados>({});

  /** Asigna (o quita, con null) el gesto de una acción; si lo tenía otra, se le quita. */
  const cambiar = useCallback((accion: AccionAtajo, gesto: Gesto | null) => {
    setGestos((prev) => {
      const nuevos: GestosAsignados = {};
      for (const [a, g] of Object.entries(prev) as [AccionAtajo, Gesto][]) if (g !== gesto) nuevos[a] = g;
      if (gesto) nuevos[accion] = gesto;
      else delete nuevos[accion];
      return nuevos;
    });
  }, []);
  /** Pone los de una configuración guardada. */
  const reemplazar = useCallback((datos: unknown) => setGestos(normalizarGestos(datos)), []);

  return { gestos, cambiar, reemplazar };
}

/** Un toque: todos los dedos fuera antes de esto (ms) y sin moverse más de esto (px). */
const TOQUE_MS = 350;
const TOQUE_PX = 15;
/** Entre los dos toques de un doble toque, como mucho (ms). */
const DOBLE_TOQUE_MS = 350;
/** Un deslizamiento: al menos esto de recorrido medio (px), en menos de esto (ms). */
const DESLIZAR_PX = 60;
const DESLIZAR_MS = 1000;

/** Dónde no se reconocen gestos: escribiendo, en un diálogo o mientras se espera una tecla nueva. */
function ignorarDesde(objetivo: EventTarget | null): boolean {
  const el = objetivo instanceof Element ? objetivo : null;
  if (!el) return false;
  if (el instanceof HTMLElement && el.isContentEditable) return true;
  return !!el.closest(`input, textarea, select, [role="dialog"], [${ATRIBUTO_CAPTURANDO}]`);
}

/**
 * Reconoce los gestos de toda la ventana y hace lo de cada uno de `activos`
 * (los que valen ahora, con lo que hace cada uno). No impide el scroll ni el
 * zoom del navegador: si los dedos se separan o se juntan es un pellizco, no un
 * deslizamiento, y no cuenta.
 */
export function useReconocerGestos(activos: [Gesto, () => void][]): void {
  const activosRef = useRef(activos);
  useEffect(() => {
    activosRef.current = activos;
  });

  useEffect(() => {
    // El gesto en curso: desde que se apoya el primer dedo hasta que se levanta el último
    let inicio = 0;
    let dedos = 0;
    let ignorado = false;
    const desde = new Map<number, { x: number; y: number }>();
    const hasta = new Map<number, { x: number; y: number }>();
    // Un toque de 2 dedos esperando por si llega el segundo (doble toque)
    let toquePendiente: { hora: number; temporizador: number } | null = null;

    const hacer = (gesto: Gesto): boolean => {
      const encontrado = activosRef.current.find(([g]) => g === gesto);
      if (!encontrado) return false;
      navigator.vibrate?.(15);
      encontrado[1]();
      return true;
    };
    const asignado = (gesto: Gesto) => activosRef.current.some(([g]) => g === gesto);

    const alApoyar = (e: TouchEvent) => {
      if (desde.size === 0) {
        inicio = e.timeStamp;
        dedos = 0;
        ignorado = ignorarDesde(e.target);
        hasta.clear();
      }
      for (const t of Array.from(e.changedTouches)) {
        desde.set(t.identifier, { x: t.clientX, y: t.clientY });
        hasta.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
      dedos = Math.max(dedos, e.touches.length);
    };
    const alMover = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (desde.has(t.identifier)) hasta.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
    };
    const alCancelar = () => {
      desde.clear();
      hasta.clear();
      ignorado = true;
    };

    const alLevantar = (e: TouchEvent) => {
      alMover(e);
      if (e.touches.length > 0) return; // quedan dedos: el gesto sigue
      const duracion = e.timeStamp - inicio;
      const movimientos = [...desde].map(([id, a]) => {
        const b = hasta.get(id) ?? a;
        return { x: b.x - a.x, y: b.y - a.y };
      });
      desde.clear();
      hasta.clear();
      if (ignorado || (dedos !== 2 && dedos !== 3) || movimientos.length !== dedos) return;

      // Un toque (y, con 2 dedos, quizá el primero de un doble toque)
      if (duracion < TOQUE_MS && movimientos.every((m) => Math.hypot(m.x, m.y) < TOQUE_PX)) {
        if (dedos === 3) {
          if (hacer('toque3')) e.preventDefault();
          return;
        }
        if (toquePendiente && e.timeStamp - toquePendiente.hora < DOBLE_TOQUE_MS) {
          window.clearTimeout(toquePendiente.temporizador);
          toquePendiente = null;
          if (hacer('dobleToque2')) e.preventDefault();
          return;
        }
        // Sin doble toque asignado, el toque simple no espera
        if (!asignado('dobleToque2')) {
          if (hacer('toque2')) e.preventDefault();
          return;
        }
        const hora = e.timeStamp;
        toquePendiente = {
          hora,
          temporizador: window.setTimeout(() => {
            toquePendiente = null;
            hacer('toque2');
          }, DOBLE_TOQUE_MS),
        };
        return;
      }

      // Un deslizamiento: todos los dedos hacia el mismo lado (si no, es un pellizco)
      if (duracion > DESLIZAR_MS) return;
      const media = {
        x: movimientos.reduce((s, m) => s + m.x, 0) / dedos,
        y: movimientos.reduce((s, m) => s + m.y, 0) / dedos,
      };
      const horizontal = Math.abs(media.x) > Math.abs(media.y);
      const recorrido = horizontal ? media.x : media.y;
      if (Math.abs(recorrido) < DESLIZAR_PX) return;
      const juntos = movimientos.every((m) => {
        const propio = horizontal ? m.x : m.y;
        return Math.sign(propio) === Math.sign(recorrido) && Math.abs(propio) >= Math.abs(recorrido) / 2;
      });
      if (!juntos) return;
      const direccion = horizontal ? (recorrido > 0 ? 'derecha' : 'izquierda') : recorrido > 0 ? 'abajo' : 'arriba';
      if (hacer(`deslizar${dedos}-${direccion}` as Gesto)) e.preventDefault();
    };

    // Solo al levantar se puede impedir lo que haría el navegador (no hace falta antes)
    window.addEventListener('touchstart', alApoyar, { capture: true, passive: true });
    window.addEventListener('touchmove', alMover, { capture: true, passive: true });
    window.addEventListener('touchend', alLevantar, { capture: true, passive: false });
    window.addEventListener('touchcancel', alCancelar, true);
    return () => {
      if (toquePendiente) window.clearTimeout(toquePendiente.temporizador);
      window.removeEventListener('touchstart', alApoyar, true);
      window.removeEventListener('touchmove', alMover, true);
      window.removeEventListener('touchend', alLevantar, true);
      window.removeEventListener('touchcancel', alCancelar, true);
    };
  }, []);
}
