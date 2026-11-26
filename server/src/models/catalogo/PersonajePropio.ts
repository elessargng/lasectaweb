import type { Despertar } from './Despertar';
import type { TipoPersonaje } from './TipoPersonaje';

/** Un personaje definido dentro de un guion importado (no está en el catálogo). */
export interface PersonajePropio {
  id: string;
  nombre: string;
  tipo: TipoPersonaje;
  habilidad: string;
  /** Dirección https de su icono, si la trae. */
  icono: string | null;
  /** Su icono cuando es bueno o malvado, si los trae (la segunda y la tercera imagen de «image»). */
  iconoBueno: string | null;
  iconoMalvado: string | null;
  primeraNoche: Despertar;
  otrasNoches: Despertar;
  /** Altera la preparación de la partida («setup» en el JSON). */
  preparacion: boolean;
  /** Puede ir repetido en la bolsa (un «bag-duplicate» en su «special»). */
  repetible: boolean;
  /** Los textos de sus recordatorios («reminders» y, detrás, «remindersGlobal»). */
  recordatorios: string[];
}
