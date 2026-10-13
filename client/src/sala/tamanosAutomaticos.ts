import { RANGOS } from './preferencias';

/**
 * Tamaños automáticos de la sala (Preferencias > Interfaz > Automático).
 */

const entre = (n: number, min: number, max: number) => Math.round(Math.min(max, Math.max(min, n)));

/** Espacio que deja cada asiento a su lado, en proporción a su lado (para que no se toquen). */
const HOLGURA = 0.2;
/** Alto reservado para el nombre que va encima de cada asiento. */
const ALTO_NOMBRE = 24;

/**
 * El lado de los cuadros de los asientos: el mayor que cabe en una mesa de
 * `ladoMesa` px con `asientos` asientos en círculo sin que se toquen, y sin
 * pasar de la cuarta parte de la mesa (para que quede sitio dentro del círculo).
 *
 * Los centros de los cuadros están a (L - a) / 2 del centro, así que dos
 * vecinos distan (L - a) · sen(π / n), que tiene que ser al menos a · (1 + holgura).
 */
export function tamanoAvatarAuto(ladoMesa: number, asientos: number): number {
  const lado = Math.max(0, ladoMesa - 2 * ALTO_NOMBRE);
  const { min, max } = RANGOS.tamanoAvatar;
  if (asientos < 2) return entre(lado / 4, min, max);
  const s = Math.sin(Math.PI / asientos);
  return entre(Math.min((lado * s) / (1 + HOLGURA + s), lado / 4), min, max);
}

/** Las fichas, en proporción al cuadro. */
export function tamanoFichaAuto(avatar: number): number {
  const { min, max } = RANGOS.tamanoFicha;
  return entre(avatar * 0.45, min, max);
}

/**
 * Los cuadros de narrador, fuera de la mesa: según la ventana. No dependen de la
 * mesa porque la columna del narrador le quita ancho (se afectarían entre sí).
 */
export function tamanoNarradorAuto(anchoVentana: number, altoVentana: number): number {
  const { min, max } = RANGOS.tamanoAvatar;
  return entre(Math.min(anchoVentana, altoVentana) / 6, 96, Math.min(max, 200)) || min;
}
