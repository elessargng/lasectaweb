import { JUGADORES_NARRADOR_VIRTUAL } from '../compartido/narradorVirtual';
import type { PersonajeDeGuion } from '../guiones';
import { repartoPara } from '../partida/distribucion';

/**
 * Los personajes que el narrador virtual sabe narrar enteros: su bolsa, sus reglas,
 * su despertar y lo que declaran de día. Los de Trouble Brewing y No Greater Joy.
 * Un personaje nuevo que sepa narrar es una línea más.
 */
const PERSONAJES_NARRABLES: ReadonlySet<string> = new Set([
  // Trouble Brewing
  'washerwoman',
  'librarian',
  'investigator',
  'chef',
  'empath',
  'fortuneteller',
  'undertaker',
  'monk',
  'ravenkeeper',
  'virgin',
  'slayer',
  'soldier',
  'mayor',
  'butler',
  'drunk',
  'recluse',
  'saint',
  'poisoner',
  'spy',
  'scarletwoman',
  'baron',
  'imp',
  // No Greater Joy
  'clockmaker',
  'chambermaid',
  'artist',
  'sage',
  'klutz',
]);

/** Los personajes del guion que el narrador virtual no sabe narrar. */
export const desconocidos = (personajes: readonly PersonajeDeGuion[]): PersonajeDeGuion[] => personajes.filter((p) => !PERSONAJES_NARRABLES.has(p.id));

/** Si el guion tiene personajes de cada tipo para la bolsa de tantos jugadores (ver repartoPara). */
const llenaLaBolsa = (personajes: readonly PersonajeDeGuion[], jugadores: number): boolean => {
  const reparto = repartoPara(jugadores);
  if (!reparto) return false;
  const de = (tipo: string) => personajes.filter((p) => p.tipo === tipo).length;
  return (
    de('townsfolk') >= reparto.aldeanos && de('outsider') >= reparto.forasteros && de('minion') >= reparto.esbirros && de('demon') >= reparto.demonios
  );
};

/** Con cuántos jugadores (de los que admite el narrador virtual) se llena la bolsa con ese guion. */
export function jugadoresDelGuion(personajes: readonly PersonajeDeGuion[]): number[] {
  const { min, max } = JUGADORES_NARRADOR_VIRTUAL;
  return Array.from({ length: max - min + 1 }, (_, i) => min + i).filter((n) => llenaLaBolsa(personajes, n));
}

/** Por qué el narrador virtual no puede llevar ese guion con tantos jugadores, o null si puede. */
export function noSabeNarrar(guion: { nombre: string; personajes: readonly PersonajeDeGuion[] }, jugadores: number): string | null {
  const faltan = desconocidos(guion.personajes);
  if (faltan.length > 0) return `No conozco todos los personajes de este guion (${faltan.map((p) => p.nombre).join(', ')}).`;
  if (!llenaLaBolsa(guion.personajes, jugadores)) return `${guion.nombre} no tiene personajes para ${jugadores} jugadores.`;
  return null;
}
