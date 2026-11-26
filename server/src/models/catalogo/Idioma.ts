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

/** El idioma original de los personajes. */
export const IDIOMA_ORIGINAL: Idioma = { id: 'en', nombre: 'English', codigo: 'en', tieneGeneros: false };
