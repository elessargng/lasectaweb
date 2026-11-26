/** Géneros en que pueden ir los textos de un idioma que los distingue («jugadores» o «jugadoras»). */
export const GENEROS = ['masculino', 'femenino'] as const;
export type Genero = (typeof GENEROS)[number];
export const GENERO_POR_DEFECTO: Genero = 'masculino';
