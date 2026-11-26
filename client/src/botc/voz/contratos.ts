/**
 * Los contratos de la voz del narrador virtual. Cada pieza depende de estas
 * interfaces, no de las clases que las cumplen (quién es quién se decide en
 * index.ts), y cada interfaz pide solo lo que usa quien la necesita.
 */

/** Una voz que dice frases, en orden, y que se puede callar. */
export interface Voz {
  /** Encola la frase: no corta a la que esté sonando. */
  decir(texto: string): void;
  /** Calla lo que esté diciendo y lo que tuviera pendiente. */
  callar(): void;
}

/** Cuánto lleva una descarga, de 0 a 1. */
export type AlProgreso = (fraccion: number) => void;

/** El modelo de la voz neuronal: dónde se guarda y cómo se le pide el audio de una frase. */
export interface ModeloVoz {
  /** Si ya está en este navegador (no hace falta descargarlo). */
  descargado(): Promise<boolean>;
  /** Lo descarga y lo guarda en este navegador. */
  descargar(alProgreso: AlProgreso): Promise<void>;
  /** Lo carga en memoria, para que la primera frase no espere a eso. */
  preparar(): Promise<void>;
  /** El audio de la frase. */
  sintetizar(texto: string): Promise<Blob>;
  /** Lo suelta de la memoria (al cambiar de voz o apagarla); sigue guardado en el navegador. */
  liberar(): void;
}

/** Lo que hace sonar un audio ya hecho. */
export interface Reproductor {
  /** Se resuelve al acabar de sonar (o al pararlo). */
  reproducir(audio: Blob): Promise<void>;
  parar(): void;
}
