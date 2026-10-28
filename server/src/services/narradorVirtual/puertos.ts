import type { SalaResultado } from '../../contrato/sala';

/**
 * Lo que el narrador virtual necesita de fuera, como interfaces (se le inyectan):
 * así no sabe de sockets ni de relojes, y en los tests se le dan unos falsos.
 */

/**
 * La mesa vista por el narrador virtual: hace lo que haría un narrador, con las
 * mismas acciones de la sala (y los mismos permisos), y la sala se difunde a todos.
 */
export interface MesaNarrador {
  accion(nombre: string, datos?: unknown): Promise<SalaResultado>;
}

/** Programa algo para dentro de un rato; devuelve cómo cancelarlo. */
export interface Temporizador {
  programar(ms: number, hacer: () => void): () => void;
}

/** Lo que dice el narrador virtual, para que lo oigan todos (la voz del navegador). */
export interface Voz {
  decir(texto: string): void;
}

/** Un número al azar entre 0 (incluido) y 1, como Math.random (en los tests, con semilla). */
export type Azar = () => number;

/** El temporizador de verdad. */
export const temporizadorReal: Temporizador = {
  programar: (ms, hacer) => {
    const t = setTimeout(hacer, ms);
    return () => clearTimeout(t);
  },
};
