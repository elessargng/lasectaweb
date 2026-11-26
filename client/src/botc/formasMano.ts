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
  // El mismo dibujo que la mano que señala (Senalamiento)
  { forma: 'senalar', nombre: 'Dedo levantado' },
];

/**
 * Emoticonos que también se pueden levantar en lugar de la mano: se pintan con el
 * emoji del sistema. Las formas, también en el servidor (SALA_FORMAS_MANO).
 */
export const EMOTICONOS_MANO: { forma: FormaMano; nombre: string; emoji: string }[] = [
  { forma: 'emoji-sonrisa', nombre: 'Sonrisa', emoji: '😀' },
  { forma: 'emoji-risa', nombre: 'Risa', emoji: '😂' },
  { forma: 'emoji-guino', nombre: 'Guiño', emoji: '😉' },
  { forma: 'emoji-enamorado', nombre: 'Enamorado', emoji: '😍' },
  { forma: 'emoji-beso', nombre: 'Beso', emoji: '😘' },
  { forma: 'emoji-gafas', nombre: 'Gafas de sol', emoji: '😎' },
  { forma: 'emoji-pensando', nombre: 'Pensando', emoji: '🤔' },
  { forma: 'emoji-sospecha', nombre: 'Sospecha', emoji: '🤨' },
  { forma: 'emoji-silencio', nombre: 'Silencio', emoji: '🤫' },
  { forma: 'emoji-susto', nombre: 'Susto', emoji: '😱' },
  { forma: 'emoji-llanto', nombre: 'Llanto', emoji: '😢' },
  { forma: 'emoji-enfado', nombre: 'Enfado', emoji: '😡' },
  { forma: 'emoji-diablo', nombre: 'Diablillo', emoji: '😈' },
  { forma: 'emoji-angel', nombre: 'Angelito', emoji: '😇' },
  { forma: 'emoji-sueno', nombre: 'Sueño', emoji: '😴' },
  { forma: 'emoji-fiesta', nombre: 'Fiesta', emoji: '🥳' },
  { forma: 'emoji-labios', nombre: 'Besito', emoji: '💋' },
  { forma: 'emoji-corazon', nombre: 'Corazón', emoji: '❤️' },
  { forma: 'emoji-rosa', nombre: 'Rosa', emoji: '🌹' },
  { forma: 'emoji-girasol', nombre: 'Girasol', emoji: '🌻' },
  { forma: 'emoji-ramo', nombre: 'Ramo de flores', emoji: '💐' },
  { forma: 'emoji-pulgar-arriba', nombre: 'Pulgar arriba', emoji: '👍' },
  { forma: 'emoji-pulgar-abajo', nombre: 'Pulgar abajo', emoji: '👎' },
  { forma: 'emoji-aplausos', nombre: 'Aplausos', emoji: '👏' },
  { forma: 'emoji-por-favor', nombre: 'Por favor', emoji: '🙏' },
  { forma: 'emoji-palomitas', nombre: 'Palomitas', emoji: '🍿' },
  { forma: 'emoji-calavera', nombre: 'Calavera', emoji: '💀' },
  { forma: 'emoji-fantasma', nombre: 'Fantasma', emoji: '👻' },
  { forma: 'emoji-fuego', nombre: 'Fuego', emoji: '🔥' },
  { forma: 'emoji-ojos', nombre: 'Ojos', emoji: '👀' },
];

/** El emoji de una forma, si es un emoticono. */
export const emojiDeMano = (forma: FormaMano) => EMOTICONOS_MANO.find((e) => e.forma === forma)?.emoji;

/** El nombre de una forma; si es un personaje, el suyo (y si no se conoce, Palma, como se ve). */
export const nombreMano = (forma: FormaMano, personajes?: Map<string, PersonajeMostrado>) =>
  FORMAS_MANO.find((f) => f.forma === forma)?.nombre ??
  EMOTICONOS_MANO.find((e) => e.forma === forma)?.nombre ??
  personajes?.get(forma)?.nombre.texto ??
  'Palma';
