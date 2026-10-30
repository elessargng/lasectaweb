import { barajar } from '../../../contrato/bolsaAleatoria';
import type { Azar } from '../puertos';

/**
 * Qué partida monta el narrador virtual (Trouble Brewing o No Greater Joy): para
 * que no salga siempre la misma bolsa, cada partida sortea un concepto del bien y
 * uno del mal, y cada hueco de aldeano tiene una categoría. El código pone el azar
 * y los huecos; quien decide (Jarvis o «Tonto y tú») elige el personaje de cada
 * uno. Las categorías llevan los aldeanos de todos los guiones: de cada una solo
 * salen los del guion de la partida.
 */

/** Las categorías de los aldeanos, por lo que aportan al bien. */
export type CategoriaAldeano = 'infoPrimeraNoche' | 'infoRecurrente' | 'trampasDemonio' | 'accion';

export const CATEGORIAS_ALDEANOS: Record<CategoriaAldeano, readonly string[]> = {
  infoPrimeraNoche: ['washerwoman', 'librarian', 'investigator', 'chef', 'clockmaker'],
  infoRecurrente: ['empath', 'fortuneteller', 'undertaker', 'chambermaid'],
  trampasDemonio: ['soldier', 'monk', 'mayor', 'ravenkeeper', 'sage'],
  accion: ['slayer', 'virgin', 'artist'],
};

/** Cada categoría en palabras (en la pregunta de su hueco). */
export const NOMBRE_CATEGORIA: Record<CategoriaAldeano, string> = {
  infoPrimeraNoche: 'información la primera noche',
  infoRecurrente: 'información cada noche',
  trampasDemonio: 'trampa para el demonio',
  accion: 'acción de día',
};

const CATEGORIAS = Object.keys(CATEGORIAS_ALDEANOS) as CategoriaAldeano[];

/** Las de información: lo que mejor puede creer ser el Borracho. */
export const CATEGORIAS_INFORMACION: readonly CategoriaAldeano[] = ['infoPrimeraNoche', 'infoRecurrente'];

export const categoriaDe = (personaje: string): CategoriaAldeano | null => CATEGORIAS.find((c) => CATEGORIAS_ALDEANOS[c].includes(personaje)) ?? null;

export type ConceptoBien = 'informacionTemprana' | 'informacionLenta' | 'resistir' | 'irAPorEllo';
export type ConceptoMal = 'desinformacion' | 'infiltracion' | 'supervivenciaDemonio' | 'caos';

/** Los del bien: qué categoría de aldeano pesa más. */
export const CONCEPTOS_BIEN: Record<ConceptoBien, { descripcion: string; categoria: CategoriaAldeano }> = {
  informacionTemprana: {
    descripcion: 'el bien arranca con mucha información desde la primera noche y tiene que saber interpretarla',
    categoria: 'infoPrimeraNoche',
  },
  informacionLenta: {
    descripcion: 'el bien reúne información noche a noche y resuelve la partida con paciencia',
    categoria: 'infoRecurrente',
  },
  resistir: {
    descripcion: 'el bien aguanta al demonio con protecciones y trampas y gana tiempo para encontrarlo',
    categoria: 'trampasDemonio',
  },
  irAPorEllo: {
    descripcion: 'el bien tiene habilidades para actuar a la luz del día',
    categoria: 'accion',
  },
};

/** Los del mal: el esbirro que fija y los forasteros que prefiere. */
export const CONCEPTOS_MAL: Record<ConceptoMal, { descripcion: string; esbirro: string; forasteros: readonly string[] }> = {
  desinformacion: {
    descripcion: 'el mal siembra información falsa: el veneno y la borrachera hacen dudar de lo que se sabe',
    esbirro: 'poisoner',
    forasteros: ['drunk'],
  },
  infiltracion: {
    descripcion: 'el mal se cuela entre los buenos con un esbirro que pasa por bueno y lo ve todo',
    esbirro: 'spy',
    forasteros: ['recluse'],
  },
  supervivenciaDemonio: {
    descripcion: 'el mal protege a su demonio: aunque caiga, la partida sigue',
    esbirro: 'scarletwoman',
    forasteros: [],
  },
  caos: {
    descripcion: 'el mal llena la mesa de forasteros que enredan las votaciones y las ejecuciones',
    esbirro: 'baron',
    forasteros: ['saint', 'butler', 'recluse'],
  },
};

/**
 * Lo que pesa cada combinación de conceptos en el sorteo: 1 si no está aquí.
 * Resistir frente a la infiltración deja al bien con poca información ante un Espía.
 */
export const PESOS_COMBINACIONES: Partial<Record<`${ConceptoBien}×${ConceptoMal}`, number>> = {
  'resistir×infiltracion': 0.3,
};

/** Cuánto más sale la categoría del concepto del bien en los huecos que sobran. */
const PESO_FAVORECIDA = 3;
/** Cuánto más pesa al azar un forastero del concepto del mal. */
export const PESO_PREFERIDO = 3;
/** Las opciones que se ofrecen como mucho en cada hueco. */
export const MAX_OPCIONES = 4;

export interface Conceptos {
  bien: ConceptoBien;
  mal: ConceptoMal;
}

/** Uno de los que hay, al azar con su peso (1 si no se dice). */
export function alAzarConPeso<O extends { peso?: number }>(opciones: readonly O[], azar: Azar): O {
  const total = opciones.reduce((s, o) => s + (o.peso ?? 1), 0);
  let tirada = azar() * total;
  for (const o of opciones) {
    tirada -= o.peso ?? 1;
    if (tirada < 0) return o;
  }
  return opciones[opciones.length - 1];
}

/**
 * El concepto del bien y el del mal, juntos y con el peso de su combinación. Con
 * los personajes del guion, solo los del mal cuyo esbirro está en él (si no hay
 * ninguno, todos).
 */
export function sortearConceptos(azar: Azar, personajes?: readonly string[]): Conceptos {
  const todos = Object.keys(CONCEPTOS_MAL) as ConceptoMal[];
  const delGuion = personajes ? todos.filter((m) => personajes.includes(CONCEPTOS_MAL[m].esbirro)) : todos;
  const combinaciones = (Object.keys(CONCEPTOS_BIEN) as ConceptoBien[]).flatMap((bien) =>
    (delGuion.length ? delGuion : todos).map((mal) => ({ bien, mal, peso: PESOS_COMBINACIONES[`${bien}×${mal}`] ?? 1 })),
  );
  const { bien, mal } = alAzarConPeso(combinaciones, azar);
  return { bien, mal };
}

/**
 * La categoría de cada hueco de aldeano: el primero, la favorecida; los
 * siguientes, las que aún no tienen hueco, en orden al azar (con menos huecos que
 * categorías, se quedan fuera de las otras); los que sobran, al azar con más peso
 * para la favorecida.
 */
export function categoriasDeHuecos(cuantos: number, favorecida: CategoriaAldeano, azar: Azar): CategoriaAldeano[] {
  const huecos = [favorecida, ...barajar(CATEGORIAS.filter((c) => c !== favorecida), azar)].slice(0, cuantos);
  while (huecos.length < cuantos) huecos.push(otraCategoria(CATEGORIAS, favorecida, azar));
  return huecos;
}

/** Una de esas categorías al azar, con más peso para la favorecida. */
export function otraCategoria(categorias: readonly CategoriaAldeano[], favorecida: CategoriaAldeano, azar: Azar): CategoriaAldeano {
  return alAzarConPeso(
    categorias.map((c) => ({ c, peso: c === favorecida ? PESO_FAVORECIDA : 1 })),
    azar,
  ).c;
}

/**
 * Lo que se ofrece en un hueco: barajado (que el orden no pese) y, si hay más de
 * MAX_OPCIONES, unas cuantas al azar, con las `preferidas` antes que el resto.
 */
export function ofrecer<P extends { id: string }>(candidatos: readonly P[], azar: Azar, preferidas: readonly string[] = []): P[] {
  const barajados = barajar(candidatos, azar);
  const primero = [...barajados.filter((p) => preferidas.includes(p.id)), ...barajados.filter((p) => !preferidas.includes(p.id))];
  return barajar(primero.slice(0, MAX_OPCIONES), azar);
}
