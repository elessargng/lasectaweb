import type { Alineamiento } from '../compartido/jugador';
import type { PersonajeDeGuion, TipoPersonaje } from '../guiones';
import type { Recordatorio } from '../compartido/grimorio';
import type { Azar } from '../partida/azar';
import type { Jugador } from '../partida/Jugador';
import type { Objetivo } from './Objetivo';
import type { Percepcion } from './Percepcion';

/** Lo que una regla puede consultar de la partida. Las reglas no cambian la sala: responden. */
export interface ContextoReglas {
  /** Los jugadores de la plaza, en orden. */
  plaza(): readonly Jugador[];
  /** Quién es de verdad el de un asiento: el de su «Is The …» o, sin él, el de su ficha. */
  identidad(jugador: Jugador): string | null;
  /** El alineamiento de un asiento: el puesto por el narrador o el de su tipo. */
  alineamiento(jugador: Jugador): Alineamiento | null;
  /** Un personaje de la partida (del guion o del catálogo). */
  personaje(id: string): PersonajeDeGuion | undefined;
  /** Los personajes del guion (sin viajeros ni NPCs). */
  personajesDelGuion(): readonly PersonajeDeGuion[];
  /** Cómo registra un jugador ante las habilidades de los demás (ver Percepcion). */
  percepcion(jugador: Jugador): Percepcion;
  /** A quién le llega lo que le hacen a un jugador (ver Objetivo). */
  objetivo(jugador: Jugador): Objetivo;
  /** Si está envenenado o borracho (ver ReglaPersonaje.droison); null si está sano. */
  droison(jugador: Jugador): Droison | null;
  /** El azar de la partida (el Revolutionary reparte con él). */
  readonly azar: Azar;
}

/** Cómo ha perdido la habilidad sin saberlo. */
export type Droison = 'envenenado' | 'borracho';

/** Quien no va en la bolsa y cree ser otro (el Borracho): de qué tipo cree ser y el recordatorio que dice quién es. */
export interface CreeSerOtro {
  tipo: TipoPersonaje;
  recordatorio: string;
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
  /** Solo hay uno en la plaza: se quita de donde estuviera. */
  unico: boolean;
}

/**
 * Lo que un personaje cambia de la partida. Cada personaje con reglas propias
 * implementa solo lo que le toca; la sala (ver Reglas) pregunta a todos. Un
 * personaje nuevo con reglas propias es una regla más en la lista de Reglas.ts.
 */
/** Cómo está la partida al ver si ha terminado. */
export interface FinDePartida {
  /** Los vivos que cuentan (sin muerte pendiente y sin viajeros). */
  vivos: readonly Jugador[];
  /** El ejecutado hoy, si lo hay. */
  ejecutado?: Jugador;
  /** El día ha acabado sin ejecución. */
  sinEjecucion: boolean;
  /** Queda un demonio vivo (ver Reglas.esDemonio). */
  hayDemonio: boolean;
}

/** Quien hereda el demonio y el recordatorio que se le pone. */
export interface Herencia {
  jugador: Jugador;
  personaje: string;
  texto: string;
}

/** Quien ya ha heredado el demonio pasa a serlo: su nuevo personaje y qué recordatorios se le quitan. */
export interface PasaASerDemonio {
  personaje: string;
  quitar: (recordatorio: Recordatorio) => boolean;
}

export interface ReglaPersonaje {
  /** El personaje (id del catálogo). */
  personaje: string;

  // La votación
  /**
   * Si quien se sienta en el asiento puede votar: true o false si esta regla lo
   * decide ahora, undefined si no. Decide la primera de la lista que responda.
   */
  puedeVotar?(ctx: ContextoReglas, jugador: Jugador): boolean | undefined;
  /** Un muerto que vota desde este asiento no gasta su voto. */
  votaSinGastar?(ctx: ContextoReglas, jugador: Jugador): boolean;
  /** Quien se sienta en el asiento puede votar con las dos manos. */
  votaDoble?(ctx: ContextoReglas, jugador: Jugador): boolean;
  /** Por cuánto se multiplica su voto (`dosManos`: ha levantado las dos). */
  multiplicaVoto?(ctx: ContextoReglas, jugador: Jugador, dosManos: boolean): number;
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
  alNominar?(ctx: ContextoReglas, nominador: Jugador, nominado: Jugador, registro: RegistroAlNominar): AlNominar | null;

  // Las ejecuciones
  /** El recordatorio que se pone solo en la ficha del ejecutado, o null. */
  alEjecutar?(ctx: ContextoReglas, ejecutado: Jugador): RecordatorioDeRegla | null;
  /** Tras ejecutar no anochece (se puede volver a nominar). */
  impideAnochecer?(ctx: ContextoReglas): boolean;

  // El reparto
  /**
   * Cambia el reparto de la bolsa: recibe los asientos (los que reciben personaje,
   * en orden) y los personajes ya barajados (uno por asiento) y devuelve los
   * personajes en el orden en que se repartirán.
   */
  repartir?(ctx: ContextoReglas, jugadores: Jugador[], personajes: string[]): string[];

  // Cómo registra
  /**
   * Puede registrar como otra cosa (la Reclusa, el Espía): cambia lo que contesta
   * quien lleva este personaje de verdad, sano, a partir de lo de verdad (`base`).
   */
  alterarPercepcion?(ctx: ContextoReglas, base: Percepcion): Percepcion;
  /**
   * Protege, salva o desvía lo que le hacen a un jugador (el Monje, el Soldado, el
   * Alcalde): cambia a quién le llega, a partir de `base`. Se consulta para cualquier
   * jugador: la regla mira si le toca (por quién es o por el recordatorio que lleva).
   */
  alterarObjetivo?(ctx: ContextoReglas, jugador: Jugador, base: Objetivo): Objetivo;
  /**
   * Deja a alguien envenenado o borracho (el Envenenador, por su recordatorio; el
   * Borracho, a sí mismo): cómo, o null. No puede preguntar si alguien está droison.
   */
  droison?(ctx: ContextoReglas, jugador: Jugador): Droison | null;
  /** No va en la bolsa y cree ser otro (el Borracho): de qué tipo y su recordatorio. */
  creeSerOtro?: CreeSerOtro;
  /** La partida acaba por este personaje (el Santo ejecutado, el Alcalde): quién gana; si no, undefined. */
  ganador?(ctx: ContextoReglas, fin: FinDePartida): Alineamiento | undefined;
  /** Cuenta como el demonio sin serlo de verdad (la Mujer Escarlata que lo ha heredado). */
  esDemonio?(ctx: ContextoReglas, jugador: Jugador): boolean;
  /** Muerto el demonio, quién lo hereda (la Mujer Escarlata), de los `vivos`; null si nadie. */
  heredarDemonio?(ctx: ContextoReglas, vivos: readonly Jugador[]): Herencia | null;
  /** Quien ha heredado el demonio, a qué pasa a ser (la Mujer Escarlata, al Imp); null si no le toca. */
  pasaASerDemonio?(ctx: ContextoReglas, jugador: Jugador): PasaASerDemonio | null;
}

/** La ficha del asiento es la de ese personaje, o lo es de verdad (por su «Is The …»). */
export const lleva = (ctx: ContextoReglas, jugador: Jugador, personajeId: string): boolean =>
  jugador.personaje === personajeId || ctx.identidad(jugador) === personajeId;

/** Ese personaje está vivo en la plaza (en la ficha o de verdad); `salvo`: sin contar ese asiento. */
export const vivoEnJuego = (ctx: ContextoReglas, personajeId: string, salvo?: Jugador): boolean =>
  ctx.plaza().some((a) => a.id !== salvo?.id && !a.muerto && lleva(ctx, a, personajeId));

/** El asiento lleva algún recordatorio de ese personaje (y, si se da, con ese texto). */
export const tieneRecordatorio = (jugador: Jugador, personajeId: string, texto?: RegExp): boolean =>
  jugador.recordatorios.some((r) => r.personaje === personajeId && (!texto || texto.test(r.texto)));

/** Si está envenenado o borracho (lo dicen las reglas, ver ReglaPersonaje.droison); null si está sano. */
export const droison = (ctx: ContextoReglas, jugador: Jugador): Droison | null => ctx.droison(jugador);
