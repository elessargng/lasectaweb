import type { PersonajePropio } from './PersonajePropio';

/** Un guion tal como se importa: nombre, autor y sus entradas (ids del catálogo o personajes propios). */
export interface GuionImportado {
  nombre: string;
  autor: string | null;
  entradas: (string | PersonajePropio)[];
  /** Las reglas propias del guion (las del Bootlegger: `_meta.bootlegger`), una por línea. */
  bootlegger: string[];
  /** La imagen de fondo del guion (`_meta.background`, una dirección https), o null. */
  fondo: string | null;
}
