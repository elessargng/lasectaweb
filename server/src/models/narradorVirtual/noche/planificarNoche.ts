import { TRAMOS_NOCHE, tramoPorTipo, type HabilidadNocturna, type TramoNoche } from '../../partida/habilidades/HabilidadNocturna';

/** Un tramo de la noche y quiénes se resuelven en él, en el orden de la hoja de noche. */
export interface TramoPlanificado {
  tramo: TramoNoche;
  personajes: string[];
}

/**
 * El plan de una noche: los pasos de la hoja de noche (también los que no están
 * en juego: cuentan para las esperas), repartidos por tramos (ver TRAMOS_NOCHE)
 * en su orden y, dentro de cada uno, en el de la hoja. La primera noche empieza con
 * la información de los esbirros y del demonio. Los que no tienen habilidad de
 * noche guiada no salen. Sin nombres de personajes: cada habilidad dice su tramo o
 * va por su tipo.
 */
export function planificarNoche({
  orden,
  primera,
  habilidades,
  tipoDe,
}: {
  /** La hoja de noche del guion (primeraNoche u otrasNoches). */
  orden: readonly string[];
  primera: boolean;
  habilidades: ReadonlyMap<string, HabilidadNocturna>;
  /** El tipo de un personaje del guion. */
  tipoDe: (personaje: string) => string | undefined;
}): TramoPlanificado[] {
  const pasos = [...(primera ? ['esbirros', 'demonios'] : []), ...orden].filter((p, i, todos) => habilidades.has(p) && todos.indexOf(p) === i);
  const tramoDe = (p: string) => habilidades.get(p)!.tramo ?? tramoPorTipo(tipoDe(p));
  return TRAMOS_NOCHE.map((tramo) => ({ tramo, personajes: pasos.filter((p) => tramoDe(p) === tramo) })).filter((t) => t.personajes.length > 0);
}
