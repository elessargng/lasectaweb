import type { SalaAlineamiento, SalaAsiento } from '../../../contrato/sala';
import type { PersonajeDeGuion } from '../../../types/guiones';

/** Lo que una regla puede consultar de la partida. Las reglas no cambian la sala: responden. */
export interface ContextoReglas {
  /** La mesa, en orden. */
  mesa(): SalaAsiento[];
  /** Quién es de verdad el de un asiento: el de su «Is The …» o, sin él, el de su ficha. */
  identidad(asiento: SalaAsiento): string | null;
  /** El alineamiento de un asiento: el puesto por el narrador o el de su tipo. */
  alineamiento(asiento: SalaAsiento): SalaAlineamiento | null;
  /** Un personaje de la partida (del guion o del catálogo). */
  personaje(id: string): PersonajeDeGuion | undefined;
}

/** Cómo registra quien nomina, si puede registrar como otra cosa: lo dice el narrador. */
export interface RegistroAlNominar {
  /** Registra como aldeano (el Espía); undefined si el narrador no lo ha dicho. */
  comoAldeano?: boolean;
}

/** Lo que pasa al nominar según una regla, o lo que hay que preguntar antes al narrador. */
export type AlNominar = { recordatorio: RecordatorioDeRegla | null; ejecutaAlNominador: boolean } | { pregunta: 'comoAldeano' };

/** Un recordatorio que pone una regla sola: de su personaje, por su texto en el original. */
export interface RecordatorioDeRegla {
  texto: string;
  /** Solo hay uno en la mesa: se quita de donde estuviera. */
  unico: boolean;
}

/**
 * Lo que un personaje cambia de la partida. Cada personaje con reglas propias
 * implementa solo lo que le toca; la sala (ver Reglas) pregunta a todos. Un
 * personaje nuevo con reglas propias es una regla más en la lista de index.ts.
 */
export interface ReglaPersonaje {
  /** El personaje (id del catálogo). */
  personaje: string;

  // La votación
  /**
   * Si quien se sienta en el asiento puede votar: true o false si esta regla lo
   * decide ahora, undefined si no. Decide la primera de la lista que responda.
   */
  puedeVotar?(ctx: ContextoReglas, asiento: SalaAsiento): boolean | undefined;
  /** Un muerto que vota desde este asiento no gasta su voto. */
  votaSinGastar?(ctx: ContextoReglas, asiento: SalaAsiento): boolean;
  /** Quien se sienta en el asiento puede votar con las dos manos. */
  votaDoble?(ctx: ContextoReglas, asiento: SalaAsiento): boolean;
  /** Por cuánto se multiplica su voto (`dosManos`: ha levantado las dos). */
  multiplicaVoto?(ctx: ContextoReglas, asiento: SalaAsiento, dosManos: boolean): number;
  /** Los votos que hacen falta para la calavera, si esta regla los cambia ahora; undefined si no. */
  mayoria?(ctx: ContextoReglas): number | undefined;
  /** Las votaciones son secretas. */
  votacionSecreta?(ctx: ContextoReglas): boolean;

  // Las conversaciones
  /** Los jugadores solo conversan en privado con sus vecinos. */
  soloVecinos?(ctx: ContextoReglas): boolean;

  // Las nominaciones
  /**
   * Al nominar `nominador` a `nominado` (no al pedir una expulsión): el recordatorio
   * que se pone solo en la ficha del nominado y si el nominador se ejecuta al
   * momento (la Virgen); null si no pasa nada. Si depende de cómo registra el
   * nominador (el Espía) y el narrador no lo ha dicho en `registro`, la pregunta.
   */
  alNominar?(ctx: ContextoReglas, nominador: SalaAsiento, nominado: SalaAsiento, registro: RegistroAlNominar): AlNominar | null;

  // Las ejecuciones
  /** El recordatorio que se pone solo en la ficha del ejecutado, o null. */
  alEjecutar?(ctx: ContextoReglas, ejecutado: SalaAsiento): RecordatorioDeRegla | null;
  /** Tras ejecutar no anochece (se puede volver a nominar). */
  impideAnochecer?(ctx: ContextoReglas): boolean;

  // El reparto
  /**
   * Cambia el reparto de la bolsa: recibe los asientos (los que reciben personaje,
   * en orden) y los personajes ya barajados (uno por asiento) y devuelve los
   * personajes en el orden en que se repartirán.
   */
  repartir?(ctx: ContextoReglas, asientos: SalaAsiento[], personajes: string[]): string[];
}

/** La ficha del asiento es la de ese personaje, o lo es de verdad (por su «Is The …»). */
export const lleva = (ctx: ContextoReglas, asiento: SalaAsiento, personajeId: string): boolean =>
  asiento.personaje === personajeId || ctx.identidad(asiento) === personajeId;

/** Ese personaje está vivo en la mesa (en la ficha o de verdad); `salvo`: sin contar ese asiento. */
export const vivoEnJuego = (ctx: ContextoReglas, personajeId: string, salvo?: SalaAsiento): boolean =>
  ctx.mesa().some((a) => a !== salvo && !a.muerto && lleva(ctx, a, personajeId));

/** El asiento lleva algún recordatorio de ese personaje (y, si se da, con ese texto). */
export const tieneRecordatorio = (asiento: SalaAsiento, personajeId: string, texto?: RegExp): boolean =>
  asiento.recordatorios.some((r) => r.personaje === personajeId && (!texto || texto.test(r.texto)));

/** Si está envenenado (el recordatorio del Envenenador) o borracho (es el Borracho de verdad); null si está sano. */
export function droison(ctx: ContextoReglas, asiento: SalaAsiento): 'envenenado' | 'borracho' | null {
  if (ctx.identidad(asiento) === 'drunk') return 'borracho';
  if (tieneRecordatorio(asiento, 'poisoner', /^poisoned$/i)) return 'envenenado';
  return null;
}
