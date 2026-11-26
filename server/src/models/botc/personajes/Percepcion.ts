import type { Jugador } from '../partida/Jugador';
import type { ContextoReglas } from './ReglaPersonaje';

/**
 * Lo que puede contestarse a una pregunta sobre un jugador: con una sola
 * respuesta, es segura; con varias, elige el narrador. La primera es la de
 * verdad. Nunca está vacío.
 */
export type Posibles<T> = readonly T[];

/**
 * Cómo registra un jugador ante las habilidades de los demás: lo que se le
 * pregunta («¿es el demonio?», «¿qué personaje es?») sin mirar quién es. La base
 * (percepcionReal) dice la verdad; un personaje que puede registrar como otra cosa
 * (la Reclusa, el Espía) la cambia con su regla (ReglaPersonaje.alterarPercepcion),
 * solo si está sano. Se pide con ContextoReglas.percepcion.
 */
export interface Percepcion {
  esBueno(): Posibles<boolean>;
  esDemonio(): Posibles<boolean>;
  esEsbirro(): Posibles<boolean>;
  esForastero(): Posibles<boolean>;
  esAldeano(): Posibles<boolean>;
  /** Qué personaje es (null: el asiento no tiene). */
  personaje(): Posibles<string | null>;
}

/** Lo que es de verdad: una sola respuesta a todo. */
export function percepcionReal(ctx: ContextoReglas, jugador: Jugador): Percepcion {
  const id = ctx.identidad(jugador);
  const tipo = id ? ctx.personaje(id)?.tipo : undefined;
  return {
    esBueno: () => [ctx.alineamiento(jugador) !== 'malvado'],
    esDemonio: () => [tipo === 'demon'],
    esEsbirro: () => [tipo === 'minion'],
    esForastero: () => [tipo === 'outsider'],
    esAldeano: () => [tipo === 'townsfolk'],
    personaje: () => [id],
  };
}

/** Lo de verdad y, además, `otras` (sin repetir): de eso elige el narrador. */
export const oTambien = <T>(verdad: Posibles<T>, otras: readonly T[]): Posibles<T> => [
  ...verdad,
  ...otras.filter((o, i) => !verdad.includes(o) && otras.indexOf(o) === i),
];

/** Sí o no, a elección del narrador (lo de verdad, primero). */
export const siONo = (verdad: Posibles<boolean>): Posibles<boolean> => oTambien(verdad, [true, false]);

/** Si es de ese tipo de personaje (townsfolk, outsider, minion o demon); de otro tipo, nunca. */
export function esDeTipo(percepcion: Percepcion, tipo: string): Posibles<boolean> {
  if (tipo === 'townsfolk') return percepcion.esAldeano();
  if (tipo === 'outsider') return percepcion.esForastero();
  if (tipo === 'minion') return percepcion.esEsbirro();
  if (tipo === 'demon') return percepcion.esDemonio();
  return [false];
}
