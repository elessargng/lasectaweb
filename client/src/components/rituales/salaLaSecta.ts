/**
 * La sala de juego de La Secta: una partida online se puede jugar ahí en vez de
 * en botc.app. Se guarda como el enlace de la partida (absoluto: también va a
 * Villacuervos), y al entrar se abre la de esta misma web (en local, la local).
 */
export const SALA_LA_SECTA = 'https://www.lasecta.es/sala.html';

/** La ruta de la sala en esta web (para abrirla con la sesión de quien entra). */
export const RUTA_SALA = '/sala.html';

/** Si un enlace es el de la sala de La Secta (con www o sin él). */
export function esSalaLaSecta(enlace: string | null | undefined): boolean {
  if (!enlace) return false;
  try {
    const url = new URL(enlace);
    return /(^|\.)lasecta\.es$/.test(url.hostname) && url.pathname === RUTA_SALA;
  } catch {
    return false;
  }
}
