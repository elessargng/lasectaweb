import type { PersonajeMostrado } from './guiones';
import type { FormaMano } from './useSala';

/**
 * Las formas de mano, en el orden en que se ofrecen, con su nombre (las tres
 * primeras, las de piedra, papel o tijera). Además, la mano puede ser el icono de
 * un personaje del guion: su forma es el id del personaje (lo mismo en el
 * servidor, SALA_FORMAS_MANO).
 */
export const FORMAS_MANO: { forma: FormaMano; nombre: string }[] = [
  { forma: 'palma', nombre: 'Palma' },
  { forma: 'tijera', nombre: 'Tijera' },
  { forma: 'puno', nombre: 'Puño' },
  { forma: 'peineta', nombre: 'Peineta' },
  { forma: 'paz', nombre: 'Signo de la paz' },
  { forma: 'cuernos', nombre: 'Cuernos heavy metal' },
  { forma: 'lagarto', nombre: 'Lagarto' },
  { forma: 'spock', nombre: 'Spock' },
  { forma: 'perrito', nombre: 'Perrito' },
];

/** El nombre de una forma; si es un personaje, el suyo (y si no se conoce, Palma, como se ve). */
export const nombreMano = (forma: FormaMano, personajes?: Map<string, PersonajeMostrado>) =>
  FORMAS_MANO.find((f) => f.forma === forma)?.nombre ?? personajes?.get(forma)?.nombre.texto ?? 'Palma';
