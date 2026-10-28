/**
 * Llenar la bolsa al azar, como el botón de la bolsa del narrador (lo usan el
 * cliente, alias @contrato, y el narrador virtual). Solo valores puros.
 */
import { repartoAjustado } from './reparto';
import type { SalaDistribucion } from './sala';

/** Lo que hace falta de cada personaje para elegirlo. */
export interface PersonajeParaBolsa {
  id: string;
  tipo: string;
}

/**
 * Personajes que no van en la bolsa aunque salgan: el jugador recibe la ficha de
 * otro (un aldeano). Si salen al azar, en su lugar va un aldeano más y el
 * narrador le pone a mano su ficha a quien corresponda. El tipo es el que falta.
 */
export const NO_VAN_EN_BOLSA: Record<string, 'outsider' | 'minion'> = { drunk: 'outsider', marionette: 'minion' };

export interface BolsaAlAzar<P extends PersonajeParaBolsa = PersonajeParaBolsa> {
  /** Lo que va en la bolsa (sin viajeros). */
  personajes: string[];
  /** Los que han salido pero no van en la bolsa (el Borracho, la Marioneta): con el tipo que falta. */
  fuera: { personaje: P; falta: 'outsider' | 'minion' }[];
  /** Tipos de los que el guion no tiene bastantes. */
  escasos: string[];
}

/** Baraja (Fisher-Yates) sin tocar la lista. */
export function barajar<T>(lista: readonly T[], azar: () => number): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/**
 * Llena la bolsa al azar con los personajes del guion, como se hace a mano: primero
 * los demonios, luego los esbirros, luego los forasteros y por último los aldeanos.
 * Así los que cambian la preparación sin dejar elegir (el Barón, el Fang Gu, el
 * Vigormortis…, ver repartoAjustado) ya se cuentan al elegir los forasteros y los
 * aldeanos. El Borracho y la Marioneta, si salen, no van: en su lugar, un aldeano
 * más. Sin reparto (menos de 5 jugadores), null.
 */
export function llenarAlAzar<P extends PersonajeParaBolsa>(
  personajes: P[],
  distribucion: SalaDistribucion,
  npcs: string[],
  azar: () => number = Math.random,
): BolsaAlAzar<P> | null {
  const { aldeanos, forasteros, esbirros, demonios } = distribucion;
  if (aldeanos === null || forasteros === null || esbirros === null || demonios === null) return null;

  const escasos = new Set<string>();
  const elegir = (tipo: string, cuantos: number) => {
    const candidatos = personajes.filter((p) => p.tipo === tipo);
    if (candidatos.length < cuantos) escasos.add(tipo);
    return barajar(candidatos, azar).slice(0, cuantos);
  };

  const malos = [...elegir('demon', demonios), ...elegir('minion', esbirros)];
  // Con los malos ya elegidos (y los NPCs, como el Centinela), los forasteros y aldeanos que tocan
  const ajustado = repartoAjustado(distribucion, [...malos.map((p) => p.id), ...npcs]);
  const elegidos = [...malos, ...elegir('outsider', ajustado.forasteros ?? 0)];
  const fuera = elegidos.filter((p) => p.id in NO_VAN_EN_BOLSA).map((p) => ({ personaje: p, falta: NO_VAN_EN_BOLSA[p.id] }));
  // Un aldeano más por cada uno que no va
  const buenos = elegir('townsfolk', (ajustado.aldeanos ?? 0) + fuera.length);

  return {
    personajes: [...elegidos.filter((p) => !(p.id in NO_VAN_EN_BOLSA)), ...buenos].map((p) => p.id),
    fuera,
    escasos: [...escasos],
  };
}
