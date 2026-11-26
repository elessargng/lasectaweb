/**
 * Clocktower online, la sala de juego de La Secta: una partida online se puede
 * jugar ahí en vez de en botc.app. Se guarda como el enlace de la partida
 * (absoluto: también va a Villacuervos), y al entrar se abre la de esta misma web
 * (en local, la local).
 */
export const BOTC_LA_SECTA = 'https://www.lasecta.es/botc.html';

/** La ruta de Clocktower online en esta web (para abrirla con la sesión de quien entra). */
export const RUTA_BOTC = '/botc.html';

/** La ruta de antes: los rituales guardados aún la llevan (redirige a RUTA_BOTC). */
const RUTA_ANTIGUA = '/sala.html';

/** Si un enlace es el de Clocktower online de La Secta (con www o sin él, y también el de antes). */
export function esBotcLaSecta(enlace: string | null | undefined): boolean {
  if (!enlace) return false;
  try {
    const url = new URL(enlace);
    return /(^|\.)lasecta\.es$/.test(url.hostname) && (url.pathname === RUTA_BOTC || url.pathname === RUTA_ANTIGUA);
  } catch {
    return false;
  }
}
