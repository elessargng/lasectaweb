import type { TipoPersonaje } from './TipoPersonaje';

/** Un personaje de un guion, con lo necesario para mostrarlo. */
export interface PersonajeDeGuion {
  id: string;
  nombre: string;
  /** Tipo de personaje, o 'desconocido' si no está en el catálogo. */
  tipo: TipoPersonaje | 'desconocido';
  habilidad: string;
  icono: string | null;
  /** El icono cuando es bueno o malvado (null si no lo hay). */
  iconoBueno: string | null;
  iconoMalvado: string | null;
  recordatorioPrimeraNoche: string | null;
  recordatorioOtrasNoches: string | null;
  /**
   * Los textos de sus fichas recordatorio, en el original: los suyos y, detrás,
   * los globales (los que se ponen aunque no esté en juego, p. ej. «Is The Drunk»).
   */
  recordatorios: string[];
  /** Altera la preparación de la partida (p. ej. el Barón: más forasteros). */
  preparacion: boolean;
  /**
   * Puede ir repetido en la bolsa aunque no esté el Pope, pero solo él (p. ej.
   * el Village Idiot o la Legion: «bag-duplicate»).
   */
  repetible: boolean;
  /** Está en el catálogo o es propio del guion; si no, solo se sabe su id. */
  conocido: boolean;
}
