/**
 * Lo que el narrador virtual necesita de fuera, como interfaces (se le inyectan):
 * así no sabe de sockets ni de relojes, y en los tests se le dan unos falsos.
 */

import type { Alineamiento } from '../compartido/jugador';

/**
 * El narrador virtual en la plaza: hace lo que haría un narrador, con las mismas
 * acciones de la sala (y los mismos permisos), y la sala se difunde a todos.
 */
export interface Narrador {
  accion(nombre: string, datos?: unknown): Promise<RespuestaAccion>;
  /** Llena la bolsa con estos personajes (los que ha elegido). */
  llenarBolsa(personajes: string[]): Promise<RespuestaAccion>;
  /** Suena el gong. */
  sonarGong(): Promise<RespuestaAccion>;
  /** Pone el reloj: una cuenta atrás para todos con su mensaje. */
  ponerReloj(segundos: number, mensaje: string): Promise<RespuestaAccion>;
  /** Revela el grimorio: ha ganado ese bando. */
  revelarGrimorio(ganador: Alineamiento): Promise<RespuestaAccion>;
  /** Revela la ficha de un asiento, para todos. */
  revelarFicha(jugadorId: string): Promise<RespuestaAccion>;
  /** Pide que se señale (listas vacías: todos; segundos null: sin cuenta atrás). */
  empezarSenalamiento(peticion: {
    mensaje: string;
    segundos: number | null;
    senaladores: readonly string[];
    objetivos: readonly string[];
  }): Promise<RespuestaAccion>;
  /** Quita el señalamiento. */
  terminarSenalamiento(): Promise<RespuestaAccion>;
  /** Pone un personaje en una casilla de los faroles del demonio. */
  prepararFarol(posicion: number, personajeId: string | null): Promise<RespuestaAccion>;
  /** Anochece. */
  irANoche(): Promise<RespuestaAccion>;
  /** Amanece. */
  amanecer(): Promise<RespuestaAccion>;
  /** Limpia el grimorio: vuelve a la preparación, como al principio. */
  limpiarGrimorio(): Promise<RespuestaAccion>;
}

/** Lo que contesta la sala a una acción: hecha (con lo que devuelva) o no, y por qué. */
export type RespuestaAccion = { ok: true; valor?: string } | { ok: false; error: string };

/** Programa algo para dentro de un rato; devuelve cómo cancelarlo. */
export interface Temporizador {
  programar(ms: number, hacer: () => void): () => void;
}

/** Lo que dice el narrador virtual, para que lo oigan todos (la voz del navegador). */
export interface Voz {
  decir(texto: string): void;
}

/** El azar (ver models/partida/azar). */
export type { Azar } from '../partida/azar';

/**
 * El modelo de IA con el que decide Jarvis, sea cual sea (en los tests, uno falso):
 * con lo que pasa en la partida (`contexto`) y cómo decidirlo, elige. Falla con un
 * error si no contesta.
 */
export interface ModeloNarrador {
  /** Una de las opciones (clave → descripción): la clave que elige. */
  elegir(contexto: unknown, instrucciones: string, opciones: Record<string, string>): Promise<string>;
  /** La probabilidad de «sí» (de 0 a 1), sabiendo lo que significa cada respuesta. */
  siONo(contexto: unknown, instrucciones: string, si: string, no: string): Promise<number>;
}

/** Para Jarvis: el modelo de quien lo añade, ya comprobado; o por qué no se puede. */
export interface ModelosNarrador {
  modeloDe(participanteId: string): Promise<ModeloNarrador | string>;
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
