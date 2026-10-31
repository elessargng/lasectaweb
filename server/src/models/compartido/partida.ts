/**
 * La partida: su fase, el reparto, el registro de votaciones, los señalamientos y las causas del final.
 * Dominio que comparten el servidor y el cliente (alias @models): solo tipos y valores puros.
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
 * Las causas cuyo logro no es de quien lleva ese personaje sino de un esbirro que
 * elige el narrador: la Doncel descubierta es logro del esbirro que la cazó.
 */
export const CAUSAS_DE_ESBIRRO = ['damsel'];

/** Los límites de un señalamiento: segundos de la cuenta atrás (10 por defecto) y largo del mensaje. */
export const SALA_SENALAMIENTO = { minSegundos: 3, maxSegundos: 120, defectoSegundos: 10, mensajeMax: 120 };

/**
 * Cuántos personajes de cada tipo tiene la partida: se cuentan los asientos,
 * se quitan los que llevan un viajero y se mira la tabla (ver repartoPara).
 */
export interface Distribucion {
  /** Asientos que no llevan viajero. */
  jugadores: number;
  /** De ellos, los que no están muertos (con sudario). */
  jugadoresVivos: number;
  viajeros: number;
  viajerosVivos: number;
  /** null si hay menos de 5 jugadores (no hay reparto). */
  aldeanos: number | null;
  forasteros: number | null;
  esbirros: number | null;
  demonios: number | null;
}

/** Una nominación del día y, si se votó, su votación, para el registro del narrador. */
export interface RegistroVotacion {
  /** Cuándo se nominó (ms). */
  hora: number;
  /** El día de la partida en que se nominó. */
  dia: number;
  /** «Ana» o, si el asiento está libre, «asiento 1». */
  nomina: string;
  nominado: string;
  /** Los asientos que nominan y que son nominados (no los hay en las partidas guardadas antes). */
  nominaAsiento?: string;
  nominadoAsiento?: string;
  /** Era la expulsión de un viajero (ver NominacionDto.expulsion), no una nominación. */
  expulsion?: boolean;
  /** Nombres de quienes votaron, en el orden en que votaron; null si no se llegó a votar. */
  votantes: string[] | null;
  votos: number | null;
}

/**
 * En qué momento está la partida: la preparación y, después, noche 1, día 1,
 * noche 2, día 2… (lo cambia el narrador).
 */
export interface Fase {
  momento: 'preparacion' | 'noche' | 'dia';
  /** Número de la noche o del día (0 en la preparación). */
  numero: number;
  /** Veces que se ha limpiado el grimorio (para avisarlo una vez, sin avisar de cada ficha). */
  reinicios: number;
}

export type TurnoNominacion = 'acusacion' | 'defensa' | 'votacion';
