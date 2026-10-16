import { useCallback, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';

/**
 * Atajos de teclado de la sala (Preferencias > Atajos de teclado). Cada uno es
 * una tecla con sus modificadores.
 */
export interface Atajo {
  /** Tecla física (KeyboardEvent.code): no cambia con Mayús ni con la distribución. */
  code: string;
  /** Lo que se escribe con ella (KeyboardEvent.key), para describirla. */
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

export type AccionAtajo = 'levantarMano' | 'cambiarFase' | 'revelarGrimorio' | 'microfono' | 'camara' | 'salirConversacion';

/** Las acciones con atajo, en el orden en que salen en las preferencias. */
export const ACCIONES_ATAJO: { accion: AccionAtajo; etiqueta: string }[] = [
  { accion: 'levantarMano', etiqueta: 'Levantar o bajar la mano' },
  { accion: 'cambiarFase', etiqueta: 'Ir a la noche o amanecer (narradores)' },
  { accion: 'revelarGrimorio', etiqueta: 'Revelar el grimorio (narradores)' },
  { accion: 'microfono', etiqueta: 'Activar o silenciar el micrófono' },
  { accion: 'camara', etiqueta: 'Activar o apagar la cámara' },
  { accion: 'salirConversacion', etiqueta: 'Salir de la conversación privada' },
];

const ESPACIO: Atajo = { code: 'Space', key: ' ', ctrl: false, alt: false, shift: false, meta: false };
const N: Atajo = { code: 'KeyN', key: 'n', ctrl: false, alt: false, shift: false, meta: false };
const G: Atajo = { code: 'KeyG', key: 'g', ctrl: false, alt: false, shift: false, meta: false };
const PUNTO: Atajo = { code: 'Period', key: '.', ctrl: false, alt: false, shift: false, meta: false };
const COMA: Atajo = { code: 'Comma', key: ',', ctrl: false, alt: false, shift: false, meta: false };
const RETROCESO: Atajo = { code: 'Backspace', key: 'Backspace', ctrl: false, alt: false, shift: false, meta: false };

export const ATAJOS_INICIALES: Record<AccionAtajo, Atajo> = {
  levantarMano: ESPACIO,
  cambiarFase: N,
  revelarGrimorio: G,
  microfono: PUNTO,
  camara: COMA,
  salirConversacion: RETROCESO,
};

/** Teclas que no sirven solas: son modificadores. */
const SOLO_MODIFICADOR = ['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock'];

const NOMBRES: Record<string, string> = {
  ' ': 'Espacio',
  Enter: 'Intro',
  Escape: 'Escape',
  Backspace: 'Retroceso (borrar)',
  Delete: 'Suprimir',
  ArrowUp: 'Flecha arriba',
  ArrowDown: 'Flecha abajo',
  ArrowLeft: 'Flecha izquierda',
  ArrowRight: 'Flecha derecha',
  '.': 'Punto',
  ',': 'Coma',
};

/** Cómo se lee y se ve un atajo: «Ctrl + Mayús + M», «Espacio». */
export function describirAtajo(a: Atajo): string {
  const partes = [a.ctrl && 'Ctrl', a.alt && 'Alt', a.shift && 'Mayús', a.meta && 'Meta'].filter(Boolean) as string[];
  const tecla = NOMBRES[a.key] ?? (a.key.length === 1 ? a.key.toLocaleUpperCase('es') : a.key);
  return [...partes, tecla].join(' + ');
}

/** El atajo que forma una pulsación, o null si es solo un modificador. */
export function atajoDe(e: KeyboardEvent | ReactKeyboardEvent): Atajo | null {
  if (SOLO_MODIFICADOR.includes(e.key)) return null;
  return { code: e.code, key: e.key, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey };
}

/** Si una pulsación es ese atajo (misma tecla física y mismos modificadores). */
export function esAtajo(e: KeyboardEvent, a: Atajo): boolean {
  return e.code === a.code && e.ctrlKey === a.ctrl && e.altKey === a.alt && e.shiftKey === a.shift && e.metaKey === a.meta;
}

/** Lo que guardaba antes la sala en el navegador (para llevarlo a la cuenta la primera vez). */
export const KEY_ANTIGUA = 'sala:atajos';

function valido(a: unknown): a is Atajo {
  const x = a as Atajo;
  return (
    !!x &&
    typeof x.code === 'string' &&
    typeof x.key === 'string' &&
    ['ctrl', 'alt', 'shift', 'meta'].every((m) => typeof x[m as keyof Atajo] === 'boolean')
  );
}

/** Atajos válidos a partir de lo que sea (guardado, de un perfil…): lo que falte o no valga, el inicial. */
export function normalizarAtajos(datos: unknown): Record<AccionAtajo, Atajo> {
  const guardados = (datos && typeof datos === 'object' ? datos : {}) as Record<string, unknown>;
  const atajos = { ...ATAJOS_INICIALES };
  for (const { accion } of ACCIONES_ATAJO) {
    const guardado = guardados[accion];
    if (valido(guardado)) {
      const { code, key, ctrl, alt, shift, meta } = guardado;
      atajos[accion] = { code, key, ctrl, alt, shift, meta };
    }
  }
  return atajos;
}

/** Los atajos viven en memoria: con cuenta se guardan en el servidor (configuracion.ts). */
export function useAtajos() {
  const [atajos, setAtajos] = useState(ATAJOS_INICIALES);

  const cambiar = useCallback((accion: AccionAtajo, atajo: Atajo) => {
    setAtajos((prev) => ({ ...prev, [accion]: atajo }));
  }, []);
  /** Pone los de una configuración guardada. */
  const reemplazar = useCallback((datos: unknown) => setAtajos(normalizarAtajos(datos)), []);

  return { atajos, cambiar, reemplazar };
}

/** Marca del botón que está esperando una tecla nueva (Preferencias > Atajos). */
export const ATRIBUTO_CAPTURANDO = 'data-capturando-atajo';

const TIPOS_DE_TEXTO = ['text', 'search', 'email', 'password', 'url', 'tel', 'number'];

/**
 * Los atajos tienen prioridad sobre el control con el foco (se atienden antes que
 * él). Solo hay dos excepciones, sin las que no se podría usar la sala:
 * escribir en un campo de texto (si no, cada espacio levantaría la mano) y el
 * botón que está esperando una tecla nueva para un atajo.
 */
export function puedeUsarAtajo(e: KeyboardEvent): boolean {
  const el = e.target instanceof HTMLElement ? e.target : null;
  if (!el) return true;
  if (el.isContentEditable || el.closest(`[${ATRIBUTO_CAPTURANDO}]`)) return false;
  if (el instanceof HTMLTextAreaElement) return false;
  return !(el instanceof HTMLInputElement && TIPOS_DE_TEXTO.includes(el.type));
}
