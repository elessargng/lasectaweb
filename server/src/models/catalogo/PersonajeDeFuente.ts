import type { Personaje } from './Personaje';

/** Un personaje tal como lo da una fuente (sin las copias locales de los iconos). */
export interface PersonajeDeFuente extends Omit<Personaje, 'icono' | 'iconoBueno' | 'iconoMalvado'> {
  /** Direcciones de los iconos en la fuente (las mismas reglas que en Personaje). */
  iconoOrigen: string | null;
  iconoBuenoOrigen: string | null;
  iconoMalvadoOrigen: string | null;
}
