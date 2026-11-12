import type { FotoPartida } from '../contexto/FotoPartida';

/**
 * Lo que decide un narrador virtual (patrón Estrategia): cada narrador decide a
 * su manera; las etapas de la partida le preguntan a ella y no saben cuál es.
 * Cada decisión dice qué se decide (`motivo`), sobre quién (`sujeto`), entre qué
 * opciones, y llega con la foto de la partida del momento: «Tonto y tú» la ignora y
 * elige al azar; Jarvis le cuenta a su modelo lo que de ella sirve para esa decisión
 * (ver contexto/extractores). Lo que no es una decisión (cuánto espera entre paso y
 * paso de la noche, el orden al revelar) no pasa por aquí: va al azar.
 */

/** Qué se decide. */
export type MotivoDecision =
  /** La bolsa, hueco a hueco: qué partida narra. */
  | 'bolsa'
  /** Quién es en realidad el que no va en la bolsa y cree ser otro (el Borracho). */
  | 'creeSerOtro'
  /** A quién elige el narrador por un asiento libre. */
  | 'asientoLibre'
  /** El esbirro que pasa a ser el Imp. */
  | 'nuevoImp'
  /** Un farol del demonio. */
  | 'farol'
  /** El Red Herring de la Pitonisa. */
  | 'redHerring'
  /** El jugador de verdad que enseña la Lavandera, el Bibliotecario o el Investigador. */
  | 'correcto'
  /** El otro jugador que enseñan («Wrong»). */
  | 'incorrecto'
  /** Qué manda en un despertar que hay que revisar (registra o no como otro). */
  | 'revision'
  /** A un rol de información droison, si se le dice la verdad. */
  | 'droisonVerdad'
  /** La información falsa que se le da. */
  | 'informacionFalsa'
  /** Lo que le han hecho a alguien puede acabar de varias maneras (el Alcalde la rebota): a quién le llega. */
  | 'desenlace'
  /** Nomina a la Virgen quien puede registrar como aldeano (el Espía): si registra como tal. */
  | 'registraComoAldeano'
  /** El Exterminador dispara a la Reclusa: si registra como demonio. */
  | 'registraComoDemonio'
  /** El Violinista: el bueno que elige el demonio si no contesta. */
  | 'violinistaBueno'
  /** La pregunta libre del Artista: sí, no o que la reformule. */
  | 'artista'
  /** La pregunta montada del Artista, si no la hace el Artista sano: qué se le contesta. */
  | 'artistaSinHabilidad'
  /** El Patoso que no ha elegido a tiempo (o en un asiento libre): a quién elige. */
  | 'patoso';

/**
 * Lo que la plaza sabe de una opción y le sirve al narrador para decidir: es la
 * verdad, es creíble, inculpa a un bueno, confirma el farol de un malvado, no le
 * cuesta nada al mal, es un forastero, encaja con el concepto de la partida…
 */
export type RasgoOpcion = 'verdad' | 'verosimil' | 'inculpaABueno' | 'confirmaFarol' | 'inofensivaParaElMal' | 'forastero' | 'concepto';

export interface Opcion<T> {
  /** Corta y única en la decisión (la que contesta el modelo). */
  clave: string;
  descripcion: string;
  valor: T;
  rasgos?: RasgoOpcion[];
  /** Cuánto pesa al elegir al azar (1 si no se dice). */
  peso?: number;
}

export interface Decision<T> {
  motivo: MotivoDecision;
  /** Qué se decide, en una frase. */
  pregunta: string;
  /** Cómo decidirlo, si no vale lo de siempre para su motivo (la bolsa, con sus conceptos). */
  instrucciones?: string;
  /** Al menos una. */
  opciones: Opcion<T>[];
  /** El asiento (su id) del que trata la decisión, si es de uno: a quién se le da la información, quién pregunta… */
  sujeto?: string;
  /**
   * Lo que solo sabe quien decide y no está en la partida (la bolsa: el hueco que se
   * llena y lo ya decidido): se le cuenta a la estrategia con lo demás.
   */
  datos?: Record<string, unknown>;
}

export interface PreguntaSiONo {
  motivo: MotivoDecision;
  pregunta: string;
  /** Lo que significa cada respuesta. */
  si: string;
  no: string;
  /** La probabilidad de «sí» que aconseja la plaza (0..1): lo que haría un narrador al azar. */
  probabilidad?: number;
  /** El asiento (su id) del que trata la pregunta, si es de uno. */
  sujeto?: string;
}

export interface EstrategiaNarrador {
  elegir<T>(decision: Decision<T>, foto: FotoPartida): Promise<T>;
  siONo(pregunta: PreguntaSiONo, foto: FotoPartida): Promise<boolean>;
}

/**
 * Varias de las opciones, de una en una (cada vez sin las ya elegidas): los
 * objetivos de un asiento libre, los faroles…
 */
export async function elegirVarios<T>(
  elegir: (decision: Decision<T>) => Promise<T>,
  decision: Decision<T>,
  cuantos: number,
): Promise<T[]> {
  const elegidos: T[] = [];
  let quedan = decision.opciones;
  while (elegidos.length < cuantos && quedan.length) {
    const uno = await elegir({ ...decision, opciones: quedan });
    elegidos.push(uno);
    quedan = quedan.filter((o) => o.valor !== uno);
  }
  return elegidos;
}
