/**
 * Las causas del final de la partida: lo que marca el narrador al revelar y qué logros dan.
 */

/**
 * El final de la partida: el narrador dice qué bando ha ganado, todas las fichas
 * se dan la vuelta y él las va revelando una a una (todos ven el personaje de
 * las reveladas). Con todas reveladas, se anuncia el ganador.
 */
/**
 * Los personajes cuya habilidad puede acabar la partida (o que conviene dejar
 * dicho al final, como el Encantador de serpientes que pica al demonio): al
 * revelar, el narrador marca lo que ha pasado con los que están en juego. Los
 * textos los pone el cliente (causasFinal.ts); para añadir uno, en los dos sitios.
 */
export const CAUSAS_FIN_PARTIDA = [
  'slayer', 'mayor', 'alsaahir', 'goblin', 'saint', 'mastermind', 'snakecharmer', 'klutz', 'eviltwin', 'fanggu', 'vortox',
  'huntsman', 'damsel', 'fearmonger', 'leviathan', 'cultleader', 'puzzlemaster', 'banshee', 'amnesiac', 'scarletwoman',
  'politician',
];

/**
 * Las causas cuyo logro solo cuenta si quien lo consigue gana la partida: picar al
 * Demonio y perder, o salvar un día más al Demonio y que gane el bien, no valen.
 */
export const CAUSAS_CON_VICTORIA = ['mastermind', 'snakecharmer', 'fanggu', 'scarletwoman', 'leviathan', 'cultleader', 'politician'];

/**
 * Si el logro de una causa cuenta para quien la tiene, según haya ganado o no: los
 * de CAUSAS_CON_VICTORIA, solo si ha ganado. El único sitio donde se decide (el
 * servidor al guardar y al contar; al cliente se le manda ya decidido).
 */
export const causaCuenta = (causa: string, gano: boolean | null | undefined): boolean => !CAUSAS_CON_VICTORIA.includes(causa) || !!gano;

/**
 * Las causas cuyo logro no es de quien lleva ese personaje sino de un esbirro que
 * elige el narrador: la Doncel descubierta es logro del esbirro que la cazó.
 */
export const CAUSAS_DE_ESBIRRO = ['damsel'];
