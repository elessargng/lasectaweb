/**
 * Modelo de los guiones y sus personajes, propio de La Secta: no depende del
 * formato de ninguna fuente externa (cada fuente se traduce a este modelo).
 */

/** Tipos de personaje, en el orden en que salen en un guion. */
export const TIPOS_PERSONAJE = ['townsfolk', 'outsider', 'minion', 'demon', 'traveller', 'fabled', 'loric'] as const;
export type TipoPersonaje = (typeof TIPOS_PERSONAJE)[number];

/** Cuándo se despierta un personaje en una noche: su posición y lo que hace el narrador. */
export interface Despertar {
  /** Posición en el orden de esa noche (menor, antes); null si no se despierta. */
  orden: number | null;
  recordatorio: string | null;
}

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

/** Un personaje tal como lo da una fuente (sin las copias locales de los iconos). */
export interface PersonajeDeFuente extends Omit<Personaje, 'icono' | 'iconoBueno' | 'iconoMalvado'> {
  /** Direcciones de los iconos en la fuente (las mismas reglas que en Personaje). */
  iconoOrigen: string | null;
  iconoBuenoOrigen: string | null;
  iconoMalvadoOrigen: string | null;
}

/** Un personaje definido dentro de un guion importado (no está en el catálogo). */
export interface PersonajePropio {
  id: string;
  nombre: string;
  tipo: TipoPersonaje;
  habilidad: string;
  /** Dirección https de su icono, si la trae. */
  icono: string | null;
  primeraNoche: Despertar;
  otrasNoches: Despertar;
  /** Altera la preparación de la partida («setup» en el JSON). */
  preparacion: boolean;
  /** Los textos de sus recordatorios («reminders» y, detrás, «remindersGlobal»). */
  recordatorios: string[];
}

/** Un guion tal como se importa: nombre, autor y sus entradas (ids del catálogo o personajes propios). */
export interface GuionImportado {
  nombre: string;
  autor: string | null;
  entradas: (string | PersonajePropio)[];
  /** Las reglas propias del guion (las del Bootlegger: `_meta.bootlegger`), una por línea. */
  bootlegger: string[];
}

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
  /** Está en el catálogo o es propio del guion; si no, solo se sabe su id. */
  conocido: boolean;
}

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
  /** Las reglas del Djinn entre personajes del guion (de la copia local); vacío si no hay. */
  djinn: ReglaDjinn[];
}

/**
 * Una regla del Djinn («jinx»): cómo cambian dos personajes cuando están en el
 * mismo guion. Los ids son los del catálogo.
 */
export interface ReglaDjinn {
  personajes: [string, string];
  texto: string;
}

/** Los tipos que van como NPCs de la partida (no se sientan en la mesa). */
export const TIPOS_NPC: readonly TipoPersonaje[] = ['fabled', 'loric'];

/** Un guion por defecto que se puede elegir. */
export interface GuionPredeterminado {
  id: string;
  nombre: string;
  autor: string;
}

/** Un idioma (paquete de traducción) en el que se pueden ver los personajes. */
export interface Idioma {
  /** Id del paquete («castelgard»); «en» es el original, en inglés. */
  id: string;
  /** Nombre que se muestra («Castelgard», «Català»…). */
  nombre: string;
  /** Código de idioma para el navegador y los lectores de pantalla («es», «ca»…). */
  codigo: string;
  /** Tiene una versión de los textos para cada género (masculino y femenino). */
  tieneGeneros: boolean;
}

/** Géneros en que pueden ir los textos de un idioma que los distingue («jugadores» o «jugadoras»). */
export const GENEROS = ['masculino', 'femenino'] as const;
export type Genero = (typeof GENEROS)[number];
export const GENERO_POR_DEFECTO: Genero = 'masculino';

/** Lo que cambia de un personaje en otro idioma (lo que no se traduce, se queda en el original). */
export interface TraduccionPersonaje {
  personajeId: string;
  nombre: string | null;
  habilidad: string | null;
  recordatorios: string | null;
  recordatoriosGlobales: string | null;
  recordatorioPrimeraNoche: string | null;
  recordatorioOtrasNoches: string | null;
}

/** El idioma original de los personajes. */
export const IDIOMA_ORIGINAL: Idioma = { id: 'en', nombre: 'English', codigo: 'en', tieneGeneros: false };
