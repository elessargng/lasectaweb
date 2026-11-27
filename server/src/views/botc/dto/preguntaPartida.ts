/**
 * La pregunta de sí o no sobre la partida (la del Artista) tal como la monta el
 * cliente y la recibe el servidor, y lo que este contesta.
 * Lo que se envía al cliente (alias @views): solo tipos, sin Node ni servicios.
 */

/** Lo que contesta el narrador: sí, no, o que la reformule (no la puede contestar; no se gasta). */
/** «broma»: a quien no es el Artista ni cree serlo, el narrador no le contesta en serio. */
export type RespuestaPregunta = 'si' | 'no' | 'reformular' | 'broma';

/** Lo que cabe en una pregunta libre. */
export const MAX_PREGUNTA_LIBRE = 300;

/** Los tipos de personaje por los que se puede preguntar. */
export const TIPOS_PREGUNTABLES = ['townsfolk', 'outsider', 'minion', 'demon'] as const;

export type TipoPreguntable = (typeof TIPOS_PREGUNTABLES)[number];

/** De quién se pregunta: un personaje, un tipo de personaje o un bando. */
export type QuienPregunta =
  | { por: 'personaje'; personaje: string }
  | { por: 'tipo'; tipo: TipoPreguntable }
  | { por: 'alineamiento'; alineamiento: 'bueno' | 'malvado' };

/**
 * Las preguntas que se pueden montar. Cuentan todos los jugadores, vivos o muertos
 * (y los libres, que también son jugadores); las sillas se cuentan desde la 1, la
 * de las 12, en el sentido de las agujas del reloj.
 */
export type PreguntaPartida =
  /** ¿Está el Alcalde en juego? ¿Hay algún forastero en juego? */
  | { tipo: 'enJuego'; quien: QuienPregunta }
  /** ¿Es Paco o Marta el demonio? (`todos`: ¿Son Paco y Marta malvados?) */
  | { tipo: 'es'; jugadores: string[]; todos: boolean; quien: QuienPregunta }
  /** ¿Empieza por «P» el nombre del demonio? */
  | { tipo: 'inicial'; quien: QuienPregunta; letra: string }
  /** ¿Se sienta el demonio en una silla par? */
  | { tipo: 'silla'; quien: QuienPregunta; par: boolean }
  /** ¿Se sienta el demonio entre Paco y Pepe (los dos incluidos)? */
  | { tipo: 'entre'; quien: QuienPregunta; desde: string; hasta: string }
  /** ¿Ha elegido algún bueno a Pepe anoche (o alguna noche)? */
  | { tipo: 'eligio'; quien: QuienPregunta; a: string; cuando: 'anoche' | 'algunaNoche' };

export type TipoPreguntaPartida = PreguntaPartida['tipo'];

/** Cada clase de pregunta, en el orden en que se ofrecen, con cómo se llama. */
export const PREGUNTAS_PARTIDA: { tipo: TipoPreguntaPartida; nombre: string }[] = [
  { tipo: 'es', nombre: 'Si unos jugadores son algo' },
  { tipo: 'enJuego', nombre: 'Si algo está en juego' },
  { tipo: 'eligio', nombre: 'Si alguien eligió a un jugador de noche' },
  { tipo: 'entre', nombre: 'Si algo se sienta entre dos jugadores' },
  { tipo: 'silla', nombre: 'Si algo se sienta en silla par o impar' },
  { tipo: 'inicial', nombre: 'Si el nombre de algo empieza por una letra' },
];
