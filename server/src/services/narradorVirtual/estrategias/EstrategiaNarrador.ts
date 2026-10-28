/**
 * Lo que decide un narrador virtual (patrón Estrategia): cada narrador decide a
 * su manera; las etapas de la partida le preguntan a ella y no saben cuál es.
 */
export interface EstrategiaNarrador {
  /** Un número entre 0 y 1 para lo que se sortea con el reparto de la sala (la bolsa al azar). */
  azar(): number;
  /** Uno de entre las opciones (no vacías). */
  elegirUno<T>(opciones: readonly T[]): T;
  /** Las opciones en otro orden. */
  barajar<T>(opciones: readonly T[]): T[];
  /**
   * Los faroles del demonio entre los buenos que no están en juego: cuántos haga
   * falta, de los aldeanos y los forasteros libres.
   */
  elegirFaroles(aldeanos: readonly string[], forasteros: readonly string[], cuantos: number): string[];
  /** Lo que espera (ms) en cada paso de la hoja de noche, esté o no en juego: que la duración no delate qué roles hay. */
  esperaPaso(): number;
  /** A un rol de información envenenado o borracho, si esta vez se le da la información de verdad (si no, una falsa). */
  droisonDaLaVerdad(): boolean;
}
