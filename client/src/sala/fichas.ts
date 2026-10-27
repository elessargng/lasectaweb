import { createContext, useContext } from 'react';
import type { PersonajeMostrado, Texto } from './guiones';
import { RECORDATORIO_TEXTO } from '@contrato/sala';
import type { SalaAlineamiento, SalaAsiento, SalaNota, SalaRecordatorio } from './useSala';

/**
 * Los personajes en las fichas de la mesa: qué personajes se pueden poner (los
 * del guion, en el idioma de cada uno), cómo se ve cada uno según su
 * alineamiento y el grimorio propio de un jugador (sus notas, solo en su navegador).
 */

/**
 * Recordatorios con texto propio (sin personaje): su «personaje» es este y su
 * texto, el que se escribió, de hasta RECORDATORIO_TEXTO_MAX (van en redondo en
 * una ficha pequeña). Vienen del contrato con el servidor.
 */
export { RECORDATORIO_TEXTO, SALA_RECORDATORIO_TEXTO_MAX as RECORDATORIO_TEXTO_MAX } from '@contrato/sala';
export const esRecordatorioTexto = (r: SalaRecordatorio) => r.personaje === RECORDATORIO_TEXTO;

/**
 * Los iconos de un recordatorio con texto propio que no son de un personaje (los
 * de ICONOS_RECORDATORIO_TEXTO del contrato, con su nombre). El primero es el de por defecto.
 */
export const ICONOS_LIBRES = [
  { id: '_secta', nombre: 'Logo de La Secta' },
  { id: '_pluma', nombre: 'Pluma' },
  { id: '_interrogante', nombre: 'Interrogante' },
] as const;
export const ICONO_LIBRE_INICIAL = ICONOS_LIBRES[0].id;

/** Notas como mucho por asiento, y su largo máximo. */
export { SALA_NOTAS_MAX as NOTAS_MAX, SALA_NOTA_LARGO_MAX as NOTA_LARGO_MAX } from '@contrato/sala';

/** Los tipos que pueden ir en la ficha de un jugador (no los legendarios ni los lóricos). */
export const TIPOS_EN_FICHA = ['townsfolk', 'outsider', 'minion', 'demon', 'traveller'];

/** Lo que lleva una ficha: el personaje (id) y su alineamiento si se ha cambiado (null: el de su tipo). */
export interface ContenidoFicha {
  personaje: string | null;
  alineamiento: SalaAlineamiento | null;
}

/** El alineamiento de un tipo si nadie lo cambia: los viajeros no tienen (null). */
export function alineamientoDeTipo(tipo: string): SalaAlineamiento | null {
  if (tipo === 'townsfolk' || tipo === 'outsider') return 'bueno';
  if (tipo === 'minion' || tipo === 'demon') return 'malvado';
  return null;
}

/** El alineamiento que tiene la ficha: el elegido o, si no, el de su tipo. */
export const alineamientoDe = (p: PersonajeMostrado, elegido: SalaAlineamiento | null) =>
  elegido ?? alineamientoDeTipo(p.tipo);

/** El icono según el alineamiento: el bueno o el malvado (si lo hay) o, sin alineamiento, el de por defecto. */
export function iconoDe(p: PersonajeMostrado, elegido: SalaAlineamiento | null): string | null {
  const alineamiento = alineamientoDe(p, elegido);
  if (alineamiento === 'bueno') return p.iconoBueno ?? p.icono;
  if (alineamiento === 'malvado') return p.iconoMalvado ?? p.icono;
  return p.icono;
}

export interface ContextoFichas {
  /** Hay guion: sin él no se pueden poner personajes (ni cambiar alineamientos). */
  hayGuion: boolean;
  /** Los personajes del guion que pueden ir en una ficha, en su orden. */
  personajes: PersonajeMostrado[];
  /** Todos los viajeros: los del guion (en su orden) y luego los demás del catálogo. */
  viajeros: PersonajeMostrado[];
  /** Los de `personajes` y los de `viajeros`. */
  porId: Map<string, PersonajeMostrado>;
  /** El grimorio propio del jugador: lo que ha anotado en cada ficha (por asiento). */
  notas: Record<string, ContenidoFicha>;
  anotar: (asientoId: string, contenido: ContenidoFicha) => void;
  /** Todos los personajes del guion (también legendarios y lóricos): los recordatorios pueden ser de cualquiera. */
  todos: PersonajeMostrado[];
  todosPorId: Map<string, PersonajeMostrado>;
  /** Los recordatorios que ha puesto el jugador en su grimorio propio, por asiento. */
  notasRecordatorios: Record<string, SalaRecordatorio[]>;
  anotarRecordatorios: (asientoId: string, recordatorios: SalaRecordatorio[]) => void;
  /** Las notas que ha escrito el jugador en su grimorio propio, por asiento. */
  notasEscritas: Record<string, SalaNota[]>;
  escribirNotas: (asientoId: string, notas: SalaNota[]) => void;
}

/**
 * Los personajes (que no son demonios) que matan o causan una muerte de noche:
 * el Asesino, el Padrino, el Chismoso, el Jugador, el Niño Lunar, el Calderero,
 * el Acróbata, el Licántropo, la Abuela, la Cortesana y la Bruja del Foso.
 */
const MATAN_DE_NOCHE = [
  'assassin',
  'godfather',
  'gossip',
  'gambler',
  'moonchild',
  'tinker',
  'acrobat',
  'lycanthrope',
  'grandmother',
  'harlot',
  'pithag',
];

/** Si sus recordatorios sirven para decir quién mata de noche: los demonios (también los propios de un guion) y MATAN_DE_NOCHE. */
export const mataDeNoche = (p: { id: string; tipo: string }) => p.tipo === 'demon' || MATAN_DE_NOCHE.includes(p.id);

export const FichasContexto = createContext<ContextoFichas>({
  hayGuion: false,
  personajes: [],
  viajeros: [],
  porId: new Map(),
  notas: {},
  anotar: () => {},
  todos: [],
  todosPorId: new Map(),
  notasRecordatorios: {},
  anotarRecordatorios: () => {},
  notasEscritas: {},
  escribirNotas: () => {},
});

/**
 * Los recordatorios que se ven junto a la ficha de un asiento: los de la partida
 * (solo le llegan a quien ve el grimorio) y, con grimorio propio, los anotados.
 */
export function recordatoriosDeFicha(
  asiento: SalaAsiento,
  anotados: Record<string, SalaRecordatorio[]> | null,
): SalaRecordatorio[] {
  return [...(asiento.recordatorios ?? []), ...(anotados?.[asiento.id] ?? [])];
}

/** El texto de un recordatorio en el idioma de quien mira (el original si no hay traducción). */
export function textoRecordatorio(r: SalaRecordatorio, personaje: PersonajeMostrado | undefined): Texto {
  // El texto propio está escrito aquí, en español
  if (esRecordatorioTexto(r)) return { texto: r.texto, lang: 'es' };
  return personaje?.recordatorios[r.indice] ?? { texto: r.texto, lang: 'en' };
}

/** Para el lector: «Envenenado (Envenenador)». */
export function describirRecordatorio(r: SalaRecordatorio, personaje: PersonajeMostrado | undefined): string {
  const texto = textoRecordatorio(r, personaje).texto;
  return personaje ? `${texto} (${personaje.nombre.texto})` : texto;
}

export const useFichas = () => useContext(FichasContexto);

/** Los tipos que se reparten, con su nombre y su color (azul los buenos, rojo los malvados). */
export const TIPOS_REPARTO = [
  { tipo: 'townsfolk', clave: 'aldeanos', nombre: 'Aldeanos', color: 'text-good-bright' },
  { tipo: 'outsider', clave: 'forasteros', nombre: 'Forasteros', color: 'text-good-bright' },
  { tipo: 'minion', clave: 'esbirros', nombre: 'Esbirros', color: 'text-blood-pale' },
  { tipo: 'demon', clave: 'demonios', nombre: 'Demonios', color: 'text-blood-pale' },
] as const;

/** Cuántos personajes de cada tipo hay en la bolsa. */
export function contarBolsa(bolsa: string[], tipoDe: (id: string) => string | undefined): Record<string, number> {
  const cuenta: Record<string, number> = {};
  for (const id of bolsa) {
    const tipo = tipoDe(id);
    if (tipo) cuenta[tipo] = (cuenta[tipo] ?? 0) + 1;
  }
  return cuenta;
}

/** «Monje, Soldado y Ermitaño» (o «ninguno»). */
export function listaFaroles(faroles: (string | null)[], porId: Map<string, PersonajeMostrado>): string {
  const nombres = faroles.flatMap((id) => (id && porId.get(id) ? [porId.get(id)!.nombre.texto] : []));
  if (nombres.length === 0) return 'ninguno';
  return nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

/**
 * Los viajeros en dos grupos: los del guion (en su orden) y los demás del
 * catálogo. Los grupos vacíos no salen.
 */
export function gruposViajeros(viajeros: PersonajeMostrado[], delGuion: PersonajeMostrado[]) {
  const enGuion = new Set(delGuion.filter((p) => p.tipo === 'traveller').map((p) => p.id));
  return [
    { tipo: 'viajeros-guion', titulo: 'Del guion', personajes: viajeros.filter((p) => enGuion.has(p.id)) },
    { tipo: 'viajeros-otros', titulo: enGuion.size > 0 ? 'Otros viajeros' : 'Viajeros', personajes: viajeros.filter((p) => !enGuion.has(p.id)) },
  ].filter((g) => g.personajes.length > 0);
}

/**
 * Un recordatorio «Is The …» (el del Borracho, el Alquimista, el Filósofo, la
 * Marioneta o el Aprendiz): dice quién es de verdad el de esa ficha, aunque lleve
 * otro personaje (el que cree ser, o la habilidad que ha ganado). Se mira su
 * texto original, que es el mismo en cualquier idioma. Uno con texto propio nunca lo es.
 */
export const esRecordatorioDeIdentidad = (r: SalaRecordatorio) => !esRecordatorioTexto(r) && /^is the\b/i.test(r.texto.trim());

/**
 * Quién es de verdad el de un asiento: el personaje de su «Is The …» (el último)
 * o, sin él, el de su ficha. Solo lo sabe quien ve los recordatorios (el
 * grimorio): a los jugadores no les llegan.
 */
export function identidadDe(asiento: SalaAsiento): { personaje: string | null; porRecordatorio: boolean } {
  const r = [...(asiento.recordatorios ?? [])].reverse().find(esRecordatorioDeIdentidad);
  return r ? { personaje: r.personaje, porRecordatorio: true } : { personaje: asiento.personaje, porRecordatorio: false };
}

/**
 * El alineamiento del asiento: el que haya puesto el narrador o, si no, el de
 * quien es de verdad (un Alquimista con la ficha de un esbirro es bueno; una
 * Marioneta con la de un aldeano, malvada). Un viajero de verdad (el Aprendiz)
 * es del bando de la habilidad que gana: el de su ficha. null: el de su ficha.
 */
export function alineamientoReal(asiento: SalaAsiento, porId: Map<string, PersonajeMostrado>): SalaAlineamiento | null {
  if (asiento.alineamiento) return asiento.alineamiento;
  const { personaje, porRecordatorio } = identidadDe(asiento);
  const real = porRecordatorio && personaje ? porId.get(personaje) : undefined;
  if (!real) return null;
  if (real.tipo === 'traveller') {
    const ficha = asiento.personaje ? porId.get(asiento.personaje) : undefined;
    return ficha ? alineamientoDeTipo(ficha.tipo) : null;
  }
  return alineamientoDeTipo(real.tipo);
}
