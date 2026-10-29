import type { Grimorio } from '../grimorio';

/**
 * Lo que decide un narrador virtual (patrón Estrategia): cada narrador decide a
 * su manera; las etapas de la partida le preguntan a ella y no saben cuál es.
 * Cada decisión dice qué se decide (`motivo`), entre qué opciones, y llega con el
 * grimorio del momento: «Tonto y tú» lo ignora y elige al azar; Jarvis se lo
 * manda a su modelo. Lo que no es una decisión (cuánto espera entre paso y paso
 * de la noche, el orden al revelar) no pasa por aquí: va al azar.
 */

/** Qué se decide. */
export type MotivoDecision =
  /** La bolsa, hueco a hueco: qué partida narra. */
  | 'bolsa'
  /** El aldeano que en realidad es el Borracho. */
  | 'borracho'
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
  /** El demonio ataca al Alcalde: si la muerte rebota. */
  | 'alcaldeRebota'
  /** A quién rebota. */
  | 'alcaldeAQuien'
  /** El Espía nomina a la Virgen: si registra como aldeano. */
  | 'espiaComoAldeano'
  /** El Exterminador dispara a la Reclusa: si registra como demonio. */
  | 'reclusaComoDemonio'
  /** El Violinista: el bueno que elige el demonio si no contesta. */
  | 'violinistaBueno';

/**
 * Lo que la mesa sabe de una opción y le sirve al narrador para decidir: es la
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
  /**
   * Para lo que se decide antes de que haya grimorio (la bolsa): lo que se le cuenta
   * a la estrategia en su lugar (los personajes del guion, lo ya decidido…). Con
   * esto, Jarvis no manda el grimorio.
   */
  sinGrimorio?: Record<string, unknown>;
}

export interface PreguntaSiONo {
  motivo: MotivoDecision;
  pregunta: string;
  /** Lo que significa cada respuesta. */
  si: string;
  no: string;
  /** La probabilidad de «sí» que aconseja la mesa (0..1): lo que haría un narrador al azar. */
  probabilidad?: number;
}

export interface EstrategiaNarrador {
  elegir<T>(decision: Decision<T>, grimorio: Grimorio): Promise<T>;
  siONo(pregunta: PreguntaSiONo, grimorio: Grimorio): Promise<boolean>;
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
