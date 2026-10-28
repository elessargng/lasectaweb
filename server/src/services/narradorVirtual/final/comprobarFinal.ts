import type { SalaAsiento } from '../../../contrato/sala';
import { droison, tieneRecordatorio } from '../../partida/reglas/ReglaPersonaje';
import type { SalaService } from '../../SalaService';
import type { ContextoEtapa } from '../etapas/Etapa';
import { contextoNoche, tipoReal } from '../mesaDeJuego';
import { ponerRecordatorio } from '../noche/requisitos';

/** Con cuántos vivos (contando al demonio que muere) la Mujer Escarlata pasa a ser el demonio. */
const VIVOS_PARA_HEREDAR = 5;

export type Ganador = 'bueno' | 'malvado';

/** Es un demonio: lo es de verdad o es la Mujer Escarlata que ya lo ha heredado («Is The Demon»). */
export const esDemonio = (sala: SalaService, asiento: SalaAsiento): boolean =>
  tipoReal(sala, asiento) === 'demon' || tieneRecordatorio(asiento, 'scarletwoman', /^is the demon$/i);

/** Los vivos que cuentan para el final: sin muerte y sin viajeros. */
const vivos = (sala: SalaService) => sala.asientos().filter((a) => !a.muerto && !a.muertePendiente && tipoReal(sala, a) !== 'traveller');

/** Con cuántos vivos gana el Alcalde si el día acaba sin ejecución. */
const VIVOS_ALCALDE = 3;

/**
 * Si la partida ha terminado tras una muerte (o al acabar el día), y quién gana:
 * - ejecutado el Santo (sano), el malvado;
 * - sin demonio vivo, el bueno (salvo que la Mujer Escarlata, viva y sana, lo herede:
 *   había 5 vivos o más, contando al demonio; se le pone «Is The Demon» y sigue);
 * - con solo dos vivos, el malvado;
 * - acabado el día sin ejecución, con tres vivos y el Alcalde vivo (y sano), el bueno.
 * Si no, null.
 */
export async function comprobarFinal(
  ctx: ContextoEtapa,
  { ejecutado, sinEjecucion = false }: { ejecutado?: string; sinEjecucion?: boolean } = {},
): Promise<Ganador | null> {
  const { sala } = ctx;
  const noche = contextoNoche(sala);
  const ejecutadoHoy = ejecutado ? sala.asientos().find((a) => a.id === ejecutado) : undefined;
  if (ejecutadoHoy && sala.identidad(ejecutadoHoy) === 'saint' && !droison(noche, ejecutadoHoy)) return 'malvado';
  const quedan = vivos(sala);
  if (
    sinEjecucion &&
    quedan.length === VIVOS_ALCALDE &&
    quedan.some((a) => esDemonio(sala, a)) &&
    quedan.some((a) => sala.identidad(a) === 'mayor' && !droison(noche, a))
  ) {
    return 'bueno';
  }
  if (!quedan.some((a) => esDemonio(sala, a))) {
    const escarlata = quedan.find((a) => sala.identidad(a) === 'scarletwoman' && !droison(noche, a));
    if (escarlata && quedan.length + 1 >= VIVOS_PARA_HEREDAR) {
      await ponerRecordatorio(ctx, escarlata.id, 'scarletwoman', 'Is The Demon');
      return quedan.length <= 2 ? 'malvado' : null;
    }
    return 'bueno';
  }
  return quedan.length <= 2 ? 'malvado' : null;
}
