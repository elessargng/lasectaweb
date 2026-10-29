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

/** Una pregunta al modelo JEV: elegir una de las opciones (`choice`) o sí o no (`noul`). */
export type PreguntaJev =
  | { type: 'choice'; instructions: string; criteria: Record<string, string> }
  | { type: 'noul'; instructions: string; criteria: { true: string; false: string } };

/** Lo que contesta a cada pregunta: la opción (con lo seguro que está) o la probabilidad de sí. */
export type RespuestaJev =
  | { type: 'choice'; choice: string; confidence?: number; probabilities?: Record<string, number> }
  | { type: 'noul'; noul: number };

/** El modelo que guía a Jarvis (en los tests, uno falso). Falla con un error si no contesta. */
export interface ClienteJev {
  decidir(state: unknown, questions: Record<string, PreguntaJev>): Promise<Record<string, RespuestaJev>>;
}

/** Cómo se llega al modelo de un usuario. */
export interface DatosJev {
  endpoint: string;
  modelo: string;
  apiKey: string;
}

/** Lo que necesita el narrador virtual para Jarvis: el modelo de quien lo añade y cómo hablar con él. */
export interface ModelosJarvis {
  /** El de un participante: sus datos (ya comprobados alguna vez), 'sinCuenta' si es invitado o null si no lo tiene. */
  modeloDe(participanteId: string): Promise<DatosJev | 'sinCuenta' | null>;
  cliente(datos: DatosJev): ClienteJev & { comprobar(): Promise<string | null> };
}

/**
 * Las bolsas que ha montado el narrador virtual en las últimas partidas de quien
 * lo añade (por su cuenta), para no repetirlas.
 */
export interface BolsasRecientes {
  /** Las últimas, la más reciente primero (cada una, sus personajes). */
  de(participanteId: string): Promise<string[][]>;
  apuntar(participanteId: string, personajes: string[]): Promise<void>;
}

/** El temporizador de verdad. */
export const temporizadorReal: Temporizador = {
  programar: (ms, hacer) => {
    const t = setTimeout(hacer, ms);
    return () => clearTimeout(t);
  },
};
