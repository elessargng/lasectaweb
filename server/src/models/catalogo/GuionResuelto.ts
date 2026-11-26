import type { PersonajeDeGuion } from './PersonajeDeGuion';
import type { ReglaDjinn } from './ReglaDjinn';

/** Un guion listo para usar: sus personajes (en el orden del guion) y el orden de cada noche. */
export interface GuionResuelto {
  nombre: string;
  autor: string | null;
  /** La edición oficial («troublebrewing»…) si es uno de los guiones por defecto; null si se ha importado. */
  edicion: string | null;
  personajes: PersonajeDeGuion[];
  /** Ids de los personajes que se despiertan, en orden. */
  primeraNoche: string[];
  otrasNoches: string[];
  /**
   * Los legendarios y lóricos del catálogo que el guion no trae: los narradores
   * pueden añadirlos a la partida como NPCs (los que trae el guion, también).
   * No salen en la hoja del guion ni en el orden de noche.
   */
  npcs: PersonajeDeGuion[];
  /**
   * Los viajeros del catálogo que el guion no trae: se pueden poner en una ficha
   * o meter en la bolsa (los viajeros no dependen del guion). Tampoco salen en
   * la hoja del guion ni en el orden de noche.
   */
  viajeros: PersonajeDeGuion[];
  /** Las reglas propias del guion (las del Bootlegger), una por línea; vacío si no trae. */
  bootlegger: string[];
  /** La imagen de fondo que trae el guion (https), o null: al cargarlo, es el fondo de la sala. */
  fondo: string | null;
  /** Las reglas del Djinn entre personajes del guion (de la copia local); vacío si no hay. */
  djinn: ReglaDjinn[];
}
