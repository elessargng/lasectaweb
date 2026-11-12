import type { EnvioDespertar } from '../../compartido/despertar';
import type { CausaMuerte, EntradaDiario } from '../../compartido/diario';

/**
 * Lo que ha pasado a cada asiento (por su id), sacado del diario de la partida: lo
 * que eligió y lo que le dijo el narrador cada noche (y si era falso), cómo estaba,
 * cuándo y por qué murió y qué personajes ha llevado. Lo usan la crónica del
 * narrador virtual y lo que se le cuenta a su estrategia (ver narradorVirtual/contexto).
 */

type Despertar = Extract<EntradaDiario, { tipo: 'despertar' }>;
type Droison = 'envenenado' | 'borracho' | null;

/** Una información que le dio el narrador. */
export interface InformacionDada {
  envio: EnvioDespertar;
  /** No era la verdad (el narrador virtual mintió a un rol envenenado o borracho). */
  falsa: boolean;
}

/** Lo que hizo un asiento una noche. */
export interface NocheDeAsiento {
  noche: number;
  /** Cada elección, sus asientos (la Pitonisa elige dos de una vez). */
  eligio: string[][];
  /** Lo que le dijo el narrador (sin las peticiones de elegir). */
  infos: InformacionDada[];
  /** Cómo estaba al acabar la noche. */
  droison: Droison;
}

export interface MuerteDeAsiento {
  momento: 'dia' | 'noche';
  numero: number;
  causa: CausaMuerte;
}

const envioDe = (d: Despertar): EnvioDespertar => ({
  ficha: d.ficha,
  tarjeta: d.tarjeta,
  jugadores: d.jugadores.flatMap((a) => a.id ?? []),
  personajes: d.personajes,
  texto: d.texto,
  alineamiento: d.alineamiento,
});

const forma = (e: EnvioDespertar) => JSON.stringify([e.ficha, e.tarjeta, e.jugadores, e.personajes, e.texto]);
/** Si dos envíos dicen lo mismo. */
export const mismoEnvio = (a: EnvioDespertar, b: EnvioDespertar) => forma(a) === forma(b);

/**
 * Por asiento, sus noches (solo las que eligió o recibió algo): cada elección es lo
 * primero con jugadores que contesta tras pedírsela el narrador; lo que le dice el
 * narrador, lo demás que le manda (es falso si así lo apuntó el narrador virtual,
 * ver «informacion»). Cómo estaba, como amaneció.
 */
export function nochesPorAsiento(diario: readonly EntradaDiario[]): Map<string, NocheDeAsiento[]> {
  const porAsiento = new Map<string, NocheDeAsiento[]>();
  const noche = (asiento: string, numero: number) => {
    const lista = porAsiento.get(asiento) ?? [];
    let n = lista.find((x) => x.noche === numero);
    if (!n) {
      lista.push((n = { noche: numero, eligio: [], infos: [], droison: null }));
      porAsiento.set(asiento, lista);
    }
    return n;
  };
  // Lo que pidió elegir el narrador, por asiento, hasta que contesta
  const pidiendo = new Set<string>();
  // Las mentiras de esta noche: a qué asiento y lo que se le dio
  const falsas: { asiento: string; dada: EnvioDespertar }[] = [];
  for (const e of diario) {
    if (e.tipo === 'informacion' && e.asiento.id && !mismoEnvio(e.verdadera, e.dada)) falsas.push({ asiento: e.asiento.id, dada: e.dada });
    if (e.tipo === 'amanece') {
      for (const a of e.plaza) if (a.id && porAsiento.get(a.id)?.some((n) => n.noche === e.fase.numero)) noche(a.id, e.fase.numero).droison = a.droison ?? null;
      falsas.length = 0;
    }
    if (e.tipo !== 'despertar' || e.fase.momento !== 'noche' || !e.asiento.id) continue;
    const asiento = e.asiento.id;
    if (e.delNarrador && e.eleccion !== null) {
      pidiendo.add(asiento);
    } else if (e.delNarrador) {
      const envio = envioDe(e);
      noche(asiento, e.fase.numero).infos.push({ envio, falsa: falsas.some((f) => f.asiento === asiento && mismoEnvio(f.dada, envio)) });
    } else if (pidiendo.has(asiento) && e.ficha === 'jugador' && e.jugadores.length) {
      pidiendo.delete(asiento);
      noche(asiento, e.fase.numero).eligio.push(envioDe(e).jugadores);
    }
  }
  return porAsiento;
}

/** Por asiento, su muerte (la última, si no ha revivido): cuándo y por qué. */
export function muertes(diario: readonly EntradaDiario[]): Map<string, MuerteDeAsiento> {
  const porAsiento = new Map<string, MuerteDeAsiento>();
  for (const e of diario) {
    if ((e.tipo !== 'muere' && e.tipo !== 'revive') || !e.asiento.id) continue;
    if (e.tipo === 'revive') porAsiento.delete(e.asiento.id);
    else porAsiento.set(e.asiento.id, { momento: e.fase.momento === 'noche' ? 'noche' : 'dia', numero: e.fase.numero, causa: e.causa ?? 'narrador' });
  }
  return porAsiento;
}

/** Lo último que le dio el narrador virtual a ese asiento con ese personaje estando droison: la verdad y lo que se le dio. */
export function informacionDada(diario: readonly EntradaDiario[], asiento: string, personaje: string): { verdadera: EnvioDespertar; dada: EnvioDespertar } | null {
  for (let i = diario.length - 1; i >= 0; i--) {
    const e = diario[i];
    if (e.tipo === 'informacion' && e.asiento.id === asiento && e.personaje === personaje) return { verdadera: e.verdadera, dada: e.dada };
  }
  return null;
}

/** Las causas del final que ha apuntado el narrador virtual, sin repetir (ver «causa»). */
export const causasApuntadas = (diario: readonly EntradaDiario[]): string[] => [
  ...new Set(diario.flatMap((e) => (e.tipo === 'causa' ? [e.id] : []))),
];

/** La última noche que se ha jugado (0 si ninguna). */
export const ultimaNoche = (diario: readonly EntradaDiario[]): number =>
  diario.reduce((n, e) => (e.tipo === 'anochece' ? Math.max(n, e.fase.numero) : n), 0);

/**
 * Por asiento, los personajes que ha llevado en la partida, por orden y sin repetir
 * seguidos: el que tenía al empezar (la primera noche) y cada cambio de después.
 */
export function personajesPorAsiento(diario: readonly EntradaDiario[]): Map<string, string[]> {
  const porAsiento = new Map<string, string[]>();
  const poner = (asiento: string, personaje: string | null) => {
    if (!personaje) return;
    const lista = porAsiento.get(asiento) ?? [];
    if (lista[lista.length - 1] !== personaje) lista.push(personaje);
    porAsiento.set(asiento, lista);
  };
  let empezada = false;
  for (const e of diario) {
    if (e.tipo === 'anochece' && !empezada) {
      empezada = true;
      for (const a of e.plaza) if (a.id) poner(a.id, a.personaje);
    } else if (empezada && e.tipo === 'personaje' && e.asiento.id) poner(e.asiento.id, e.personaje);
  }
  return porAsiento;
}
