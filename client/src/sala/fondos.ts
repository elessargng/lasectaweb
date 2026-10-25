/**
 * Los fondos de la sala que elige cada uno para sí (Preferencias > Interfaz):
 * el del guion (o el que ha puesto el narrador), o siempre uno fijo. Están en
 * public/fondos.
 */

/** El de La Secta: el de por defecto si la sala no tiene uno propio. */
export const FONDO_LA_SECTA = '/fondos/la-secta.webp';

/** Los fondos, en el orden en que salen en las preferencias. */
export const FONDOS = [
  {
    id: 'guion',
    nombre: 'El del guion',
    descripcion: 'El que trae el guion o pone el narrador; si no hay, el de La Secta.',
  },
  { id: 'botc', nombre: 'botc.app', descripcion: 'El grimorio de botc.app.', ruta: '/fondos/botc.webp' },
  { id: 'laSecta', nombre: 'La Secta', descripcion: 'El sello de La Secta.', ruta: FONDO_LA_SECTA },
  {
    id: 'laSectaEstrella',
    nombre: 'La Secta, con estrella',
    descripcion: 'El sello de La Secta sobre una estrella con runas.',
    ruta: '/fondos/la-secta-estrella.webp',
  },
  {
    id: 'laSectaLaton',
    nombre: 'La Secta, de latón',
    descripcion: 'El sello de La Secta en un marco de latón.',
    ruta: '/fondos/la-secta-laton.webp',
  },
  {
    id: 'laSectaVioleta',
    nombre: 'La Secta, violeta',
    descripcion: 'El sello de La Secta sobre piedra violeta.',
    ruta: '/fondos/la-secta-violeta.webp',
  },
] as const;

export type PreferenciaFondo = (typeof FONDOS)[number]['id'];
export const FONDO_DEFECTO: PreferenciaFondo = 'guion';
export const esPreferenciaFondo = (v: unknown): v is PreferenciaFondo => FONDOS.some((f) => f.id === v);

/**
 * La imagen que se ve de fondo: con «El del guion», la de la sala (`deLaSala`, ya
 * con su dirección completa) o, si no tiene, la de La Secta; si no, la elegida.
 */
export function rutaFondo(preferencia: PreferenciaFondo, deLaSala: string | null): string {
  const elegido = FONDOS.find((f) => f.id === preferencia);
  if (elegido && 'ruta' in elegido) return elegido.ruta;
  return deLaSala ?? FONDO_LA_SECTA;
}
