import { muertes, nochesPorAsiento, personajesPorAsiento } from '../../partida/proyecciones/historiaAsientos';
import type { SalaDeJuego } from '../../SalaDeJuego';
import { describirEnvio, instantaneaGrimorio, type Grimorio } from '../grimorio';
import { ventajaDelMal } from '../noche/criterioDroison';

/**
 * La partida en una foto, para decidir: el grimorio de ahora y lo que ha pasado
 * hasta ahora, sacado del diario de la partida (ver proyecciones/historiaAsientos).
 * Es lo que recibe la estrategia del narrador virtual con cada decisión; de ella,
 * cada decisión toma lo que le sirve (ver extractores). Solo datos: se puede
 * convertir en JSON tal cual. Los asientos, por su número (como en el grimorio).
 */
export interface FotoPartida {
  grimorio: Grimorio;
  /** Por número de asiento, sus noches: a quién eligió, qué le dijo el narrador (y si era falso) y cómo estaba. */
  noches: Record<number, NocheFoto[]>;
  /** Quién ha muerto, cuándo y por qué (la ejecución, la expulsión, el narrador o el personaje que lo mató). */
  muertes: { asiento: number; momento: 'dia' | 'noche'; numero: number; causa: string }[];
  /** Por número de asiento, los personajes que ha llevado, si ha cambiado (el esbirro que pasa a ser el Imp). */
  personajesAntes: Record<number, string[]>;
  /** Cómo va el mal: los malvados vivos sobre los vivos, menos los del principio (positivo: va ganando). */
  ventajaDelMal: number;
  /** El número de cada asiento, por su id (para saber de quién trata una decisión). */
  numeros: Record<string, number>;
}

export interface NocheFoto {
  noche: number;
  /** Cada elección, los números de asiento elegidos. */
  eligio: number[][];
  /** Lo que le dijo el narrador, en palabras, y si era falso. */
  recibio: { que: string; falsa: boolean }[];
  droison: 'envenenado' | 'borracho' | null;
}

/** La foto de la partida de ahora (ver FotoPartida). */
export function fotoPartida(juego: SalaDeJuego): FotoPartida {
  const { partida } = juego;
  const diario = partida.registro.hechos();
  const numeros = Object.fromEntries(partida.plaza().map((a, i) => [a.id, i + 1]));
  const numero = (id: string) => numeros[id] ?? 0;
  const porNumero = <A, B>(mapa: Map<string, A>, f: (a: A) => B) =>
    Object.fromEntries([...mapa].filter(([id]) => numeros[id]).map(([id, a]) => [numero(id), f(a)]));
  const cambiaron = new Map([...personajesPorAsiento(diario)].filter(([, personajes]) => personajes.length > 1));
  return {
    grimorio: instantaneaGrimorio(juego),
    noches: porNumero(nochesPorAsiento(diario), (noches) =>
      noches.map((n) => ({
        noche: n.noche,
        eligio: n.eligio.map((ids) => ids.map(numero)),
        recibio: n.infos.map((i) => ({ que: describirEnvio(juego, i.envio), falsa: i.falsa })),
        droison: n.droison,
      })),
    ),
    muertes: [...muertes(diario)].filter(([id]) => numeros[id]).map(([id, m]) => ({ asiento: numero(id), ...m })),
    personajesAntes: porNumero(cambiaron, (personajes) => personajes),
    ventajaDelMal: Math.round(ventajaDelMal(juego) * 100) / 100,
    numeros,
  };
}
