import { FORASTEROS } from '@contrato/reparto';
import type { SalaDistribucion } from './useSala';

/**
 * Comprobar el reparto de la partida (aldeanos, forasteros, esbirros y demonios)
 * contra el que toca por el número de jugadores, con los personajes que alteran
 * la preparación. Lo usan el resumen del reparto (abajo a la derecha) y la bolsa.
 */

// El reparto ajustado y lo que cambia cada personaje, compartidos con el servidor (narrador virtual)
export { repartoAjustado } from '@contrato/reparto';

/**
 * Cuántos forasteros puede haber con los personajes que alteran la preparación
 * (de menos a más), o 'cualquiera'. Sin reparto (menos de 5 jugadores), null.
 */
function forasterosPosibles(distribucion: SalaDistribucion, presentes: string[]): number[] | 'cualquiera' | null {
  const { jugadores, aldeanos, forasteros } = distribucion;
  if (aldeanos === null || forasteros === null) return null;
  // Los forasteros que puede haber de más o de menos: la suma de lo de cada personaje
  let desvios = new Set([0]);
  for (const id of new Set(presentes)) {
    const regla = FORASTEROS[id]?.(jugadores);
    if (!regla) continue;
    if (regla === 'cualquiera') return 'cualquiera';
    desvios = new Set([...desvios].flatMap((d) => regla.map((r) => d + r)));
  }
  return [...desvios]
    .map((d) => forasteros + d)
    .filter((f) => f >= 0 && f <= aldeanos + forasteros)
    .sort((a, b) => a - b);
}

/**
 * Qué no cuadra del reparto en juego que delate a alguien que no es lo que cree:
 * los forasteros (el Borracho cree ser un aldeano) y los esbirros (la Marioneta
 * cree ser buena). Sin reparto, nada.
 */
export function descuadres(
  cuentas: Record<string, number>,
  distribucion: SalaDistribucion,
  presentes: string[],
): { forasteros: boolean; esbirros: boolean } {
  const posibles = forasterosPosibles(distribucion, presentes);
  if (posibles === null || distribucion.esbirros === null) return { forasteros: false, esbirros: false };
  return {
    forasteros: posibles !== 'cualquiera' && !posibles.includes(cuentas.outsider ?? 0),
    esbirros: (cuentas.minion ?? 0) < distribucion.esbirros,
  };
}

/** «0», «0 o 1», «0, 1 o 2». */
const enumerar = (numeros: number[]) =>
  numeros.length <= 1 ? String(numeros[0] ?? 0) : `${numeros.slice(0, -1).join(', ')} o ${numeros[numeros.length - 1]}`;

/**
 * Lo que no cuadra del reparto, en frases cortas («Forasteros: 2; deberían ser
 * 0 o 1»); vacío si cuadra. `cuentas`: cuántos hay de cada tipo (townsfolk,
 * outsider, minion, demon); `presentes`: los personajes en juego (o en la
 * bolsa) y los NPCs, para los que alteran la preparación. Sin reparto (menos de
 * 5 jugadores), nada.
 */
export function problemasDelReparto(
  cuentas: Record<string, number>,
  distribucion: SalaDistribucion,
  presentes: string[],
): string[] {
  const { aldeanos, forasteros, esbirros, demonios } = distribucion;
  const posibles = forasterosPosibles(distribucion, presentes);
  if (aldeanos === null || forasteros === null || esbirros === null || demonios === null || posibles === null) return [];
  const hay = (tipo: string) => cuentas[tipo] ?? 0;

  const problemas: string[] = [];
  if (hay('minion') !== esbirros) problemas.push(`Esbirros: ${hay('minion')}; deberían ser ${esbirros}`);
  if (hay('demon') !== demonios) problemas.push(`Demonios: ${hay('demon')}; deberían ser ${demonios}`);
  const buenos = aldeanos + forasteros;
  if (posibles === 'cualquiera') {
    if (hay('townsfolk') + hay('outsider') !== buenos) {
      problemas.push(`Aldeanos y forasteros: ${hay('townsfolk') + hay('outsider')}; deberían ser ${buenos} entre los dos`);
    }
    return problemas;
  }
  if (!posibles.includes(hay('outsider'))) {
    problemas.push(`Forasteros: ${hay('outsider')}; deberían ser ${enumerar(posibles)}`);
  }
  if (hay('townsfolk') + hay('outsider') !== buenos) {
    problemas.push(`Aldeanos: ${hay('townsfolk')}; deberían ser ${enumerar(posibles.map((f) => buenos - f).reverse())}`);
  }
  return problemas;
}

/**
 * La firma de un reparto: cuántos jugadores y cuántos de cada tipo («7:5/0/1/1»).
 * Es lo que se guarda al darlo por bueno a mano: si cambia, vuelve a avisar.
 */
export const firmaDelReparto = (cuentas: Record<string, number>, jugadores: number) =>
  `${jugadores}:${['townsfolk', 'outsider', 'minion', 'demon'].map((t) => cuentas[t] ?? 0).join('/')}`;
