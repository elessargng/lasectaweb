import { createContext, useContext } from 'react';

/**
 * La llamada estilo botc.app (Preferencias > Interfaz): los botones de llamar y
 * de mandar un mensaje no van junto al nombre, sino dentro del cuadro de cada
 * uno, y solo se ven al pulsar Intro (o con el foco en ellos; en pantallas
 * táctiles, siempre).
 */
export interface LlamadaBotc {
  /** La preferencia está puesta. */
  activa: boolean;
  /** Se ha pulsado Intro: los botones se ven en los cuadros. */
  visibles: boolean;
  /** Se esconden (al usar uno de ellos). */
  ocultar: () => void;
}

export const LlamadaBotcContexto = createContext<LlamadaBotc>({ activa: false, visibles: false, ocultar: () => {} });

export const useLlamadaBotc = () => useContext(LlamadaBotcContexto);

/** Lo que atiende Intro por su cuenta: con el foco ahí, Intro no muestra los botones. */
const ATIENDE_INTRO =
  'button, a[href], input, select, textarea, summary, [contenteditable], [role="button"], [role="link"], [role="menuitem"], [role="option"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [tabindex]:not([tabindex="-1"])';

/** Si esta pulsación de Intro (o Escape) es para mostrar u ocultar los botones de llamada. */
export function esTeclaLlamadaBotc(e: KeyboardEvent): boolean {
  if (e.defaultPrevented || e.repeat || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return false;
  const el = e.target instanceof Element ? e.target : null;
  if (el?.closest(ATIENDE_INTRO)) return false;
  // Con un diálogo abierto, las teclas son suyas
  return !document.querySelector('[aria-modal="true"]');
}
