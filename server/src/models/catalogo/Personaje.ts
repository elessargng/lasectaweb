/**
 * Modelo de los guiones y sus personajes, propio de La Secta: no depende del
 * formato de ninguna fuente externa (cada fuente se traduce a este modelo).
 */

import type { Despertar } from './Despertar';
import type { TipoPersonaje } from './TipoPersonaje';

/** Un personaje del catálogo (copia local sincronizada desde la fuente). */
export interface Personaje {
  /** Id normalizado: minúsculas, sin separadores («fortuneteller»). */
  id: string;
  nombre: string;
  tipo: TipoPersonaje;
  edicion: string;
  habilidad: string;
  recordatorios: string | null;
  recordatoriosGlobales: string | null;
  primeraNoche: Despertar;
  otrasNoches: Despertar;
  /** Afecta a la preparación de la partida (p. ej. el Barón). */
  preparacion: boolean;
  especial: string | null;
  /**
   * Rutas públicas de las copias locales de los iconos: el de por defecto (el de
   * su alineamiento o, los viajeros, neutral) y el que se usa cuando el personaje
   * es bueno o malvado. null si no lo hay; puede ser el mismo que el de por defecto.
   */
  icono: string | null;
  iconoBueno: string | null;
  iconoMalvado: string | null;
}

/**
 * El «special» que deja meter un personaje repetido en la bolsa: en el catálogo,
 * entre los de `especial` (separados por comas); en un JSON, como {name, type}.
 */
export const ESPECIAL_REPETIBLE = 'bag-duplicate';
