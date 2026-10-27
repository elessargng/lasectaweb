import { randomInt } from 'crypto';
import { barajar } from '../azar';
import { tieneRecordatorio, type ContextoReglas, type ReglaPersonaje } from './ReglaPersonaje';

export const NPC_REVOLUTIONARY = 'revolutionary';

/**
 * Los personajes ya barajados, con dos del mismo alineamiento por su tipo en
 * las posiciones x e y (aldeanos y forasteros, buenos; esbirros y demonios,
 * malvados; los viajeros no cuentan). El par se elige al azar entre todos los
 * posibles, así que sale malvado tan a menudo como pares malvados hay. Los
 * demás siguen en su orden barajado. Sin ningún par posible, los deja igual.
 */
function mismoAlineamiento(ctx: ContextoReglas, personajes: string[], x: number, y: number): string[] {
  const tipo = (id: string) => ctx.personaje(id)?.tipo;
  const buenos = personajes.filter((id) => tipo(id) === 'townsfolk' || tipo(id) === 'outsider');
  const malvados = personajes.filter((id) => tipo(id) === 'minion' || tipo(id) === 'demon');
  const pares = (n: number) => (n * (n - 1)) / 2;
  const total = pares(buenos.length) + pares(malvados.length);
  if (total === 0) return personajes;
  const grupo = randomInt(total) < pares(buenos.length) ? buenos : malvados;
  // Dos distintos del grupo, cada uno a una de las dos posiciones
  const [primero, segundo] = barajar(grupo.map((_, i) => i)).slice(0, 2);
  const elegidos = [grupo[primero], grupo[segundo]];
  const resto = [...personajes];
  for (const id of elegidos) resto.splice(resto.indexOf(id), 1);
  return personajes.map((_, i) => (i === x ? elegidos[0] : i === y ? elegidos[1] : resto.shift()!));
}

/**
 * Revolutionary (legendario): si exactamente dos de los asientos que reciben
 * personaje llevan su recordatorio, les tocan dos del mismo alineamiento.
 */
export const revolucionario: ReglaPersonaje = {
  personaje: NPC_REVOLUTIONARY,
  repartir: (ctx, asientos, personajes) => {
    const marcados = asientos.flatMap((a, i) => (tieneRecordatorio(a, NPC_REVOLUTIONARY) ? [i] : []));
    return marcados.length === 2 ? mismoAlineamiento(ctx, personajes, marcados[0], marcados[1]) : personajes;
  },
};
