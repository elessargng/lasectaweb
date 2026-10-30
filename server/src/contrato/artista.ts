/**
 * La pregunta del Artista (una vez por partida, de día, una pregunta de sí o no al
 * narrador). Con Jarvis se escribe libre; con «Tonto y tú», que no entiende una
 * pregunta libre, se monta con piezas que el servidor sabe contestar mirando el
 * grimorio. Lo comparten el servidor (para leerla y contestarla) y el cliente (para
 * montarla y decirla en palabras).
 */

/** Lo que contesta el narrador: sí, no, o que la reformule (no la puede contestar; no se gasta). */
export type RespuestaArtista = 'si' | 'no' | 'reformular';

/** Lo que cabe en una pregunta libre. */
export const MAX_PREGUNTA_ARTISTA = 300;

/** Los tipos de personaje por los que se puede preguntar. */
export const TIPOS_ARTISTA = ['townsfolk', 'outsider', 'minion', 'demon'] as const;
export type TipoArtista = (typeof TIPOS_ARTISTA)[number];

/** De quién se pregunta: un personaje, un tipo de personaje o un bando. */
export type QuienArtista =
  | { por: 'personaje'; personaje: string }
  | { por: 'tipo'; tipo: TipoArtista }
  | { por: 'alineamiento'; alineamiento: 'bueno' | 'malvado' };

/**
 * Las preguntas que se pueden montar. Cuentan todos los asientos, vivos o muertos
 * (y los libres, que también son jugadores); las sillas se cuentan desde la 1, la
 * de las 12, en el sentido de las agujas del reloj.
 */
export type PreguntaArtista =
  /** ¿Está el Alcalde en juego? ¿Hay algún forastero en juego? */
  | { tipo: 'enJuego'; quien: QuienArtista }
  /** ¿Es Paco o Marta el demonio? (`todos`: ¿Son Paco y Marta malvados?) */
  | { tipo: 'es'; asientos: string[]; todos: boolean; quien: QuienArtista }
  /** ¿Empieza por «P» el nombre del demonio? */
  | { tipo: 'inicial'; quien: QuienArtista; letra: string }
  /** ¿Se sienta el demonio en una silla par? */
  | { tipo: 'silla'; quien: QuienArtista; par: boolean }
  /** ¿Se sienta el demonio entre Paco y Pepe (los dos incluidos)? */
  | { tipo: 'entre'; quien: QuienArtista; desde: string; hasta: string }
  /** ¿Ha elegido algún bueno a Pepe anoche (o alguna noche)? */
  | { tipo: 'eligio'; quien: QuienArtista; a: string; cuando: 'anoche' | 'algunaNoche' };

export type TipoPreguntaArtista = PreguntaArtista['tipo'];

/** Cada clase de pregunta, en el orden en que se ofrecen, con cómo se llama. */
export const PREGUNTAS_ARTISTA: { tipo: TipoPreguntaArtista; nombre: string }[] = [
  { tipo: 'es', nombre: 'Si unos jugadores son algo' },
  { tipo: 'enJuego', nombre: 'Si algo está en juego' },
  { tipo: 'eligio', nombre: 'Si alguien eligió a un jugador de noche' },
  { tipo: 'entre', nombre: 'Si algo se sienta entre dos jugadores' },
  { tipo: 'silla', nombre: 'Si algo se sienta en silla par o impar' },
  { tipo: 'inicial', nombre: 'Si el nombre de algo empieza por una letra' },
];

const esTexto = (x: unknown): x is string => typeof x === 'string' && x.length > 0;

function leerQuien(x: unknown, personajes: readonly string[]): QuienArtista | null {
  const q = x as Record<string, unknown> | null;
  if (!q || typeof q !== 'object') return null;
  if (q.por === 'personaje' && esTexto(q.personaje) && personajes.includes(q.personaje)) return { por: 'personaje', personaje: q.personaje };
  if (q.por === 'tipo' && TIPOS_ARTISTA.includes(q.tipo as TipoArtista)) return { por: 'tipo', tipo: q.tipo as TipoArtista };
  if (q.por === 'alineamiento' && (q.alineamiento === 'bueno' || q.alineamiento === 'malvado')) return { por: 'alineamiento', alineamiento: q.alineamiento };
  return null;
}

/**
 * Lee una pregunta montada (de lo que manda el cliente), con los asientos de la
 * mesa y los personajes del guion; null si no vale.
 */
export function leerPreguntaArtista(x: unknown, asientos: readonly string[], personajes: readonly string[]): PreguntaArtista | null {
  const p = x as Record<string, unknown> | null;
  if (!p || typeof p !== 'object') return null;
  const quien = leerQuien(p.quien, personajes);
  if (!quien) return null;
  const asiento = (id: unknown): id is string => esTexto(id) && asientos.includes(id);
  switch (p.tipo) {
    case 'enJuego':
      return { tipo: 'enJuego', quien };
    case 'es': {
      const lista = Array.isArray(p.asientos) ? [...new Set(p.asientos)] : [];
      if (!lista.length || lista.length > asientos.length || !lista.every(asiento)) return null;
      return { tipo: 'es', asientos: lista, todos: p.todos === true, quien };
    }
    case 'inicial':
      return esTexto(p.letra) && /^\p{L}$/u.test(p.letra) ? { tipo: 'inicial', quien, letra: p.letra.toUpperCase() } : null;
    case 'silla':
      return typeof p.par === 'boolean' ? { tipo: 'silla', quien, par: p.par } : null;
    case 'entre':
      return asiento(p.desde) && asiento(p.hasta) ? { tipo: 'entre', quien, desde: p.desde, hasta: p.hasta } : null;
    case 'eligio':
      return asiento(p.a) && (p.cuando === 'anoche' || p.cuando === 'algunaNoche') ? { tipo: 'eligio', quien, a: p.a, cuando: p.cuando } : null;
    default:
      return null;
  }
}

const TIPO_SINGULAR: Record<TipoArtista, string> = { townsfolk: 'aldeano', outsider: 'forastero', minion: 'esbirro', demon: 'demonio' };
const TIPO_PLURAL: Record<TipoArtista, string> = { townsfolk: 'aldeanos', outsider: 'forasteros', minion: 'esbirros', demon: 'demonios' };

/** Cómo se nombran los asientos y los personajes al decir la pregunta. */
export interface NombresArtista {
  asiento(id: string): string;
  personaje(id: string): string;
  /** El asiento de quien pregunta: de él se dice «te» / «tú». */
  yo?: string | null;
}

/** «el demonio», «algún esbirro», «el Mayor», «algún malvado». */
function sujeto(q: QuienArtista, n: NombresArtista): string {
  if (q.por === 'personaje') return `el ${n.personaje(q.personaje)}`;
  if (q.por === 'tipo') return q.tipo === 'demon' ? 'el demonio' : `algún ${TIPO_SINGULAR[q.tipo]}`;
  return `algún ${q.alineamiento}`;
}

/** Lo que se pregunta de unos jugadores: «el demonio», «aldeano», «malvados»… */
function atributo(q: QuienArtista, n: NombresArtista, plural: boolean): string {
  if (q.por === 'personaje') return `el ${n.personaje(q.personaje)}`;
  if (q.por === 'tipo') return q.tipo === 'demon' && !plural ? 'el demonio' : (plural ? TIPO_PLURAL : TIPO_SINGULAR)[q.tipo];
  return plural ? `${q.alineamiento}s` : q.alineamiento;
}

/** «Paco», «Paco o Marta», «Paco, Marta y Pepe». */
function lista(nombres: string[], y: 'y' | 'o'): string {
  return nombres.length < 2 ? (nombres[0] ?? '') : `${nombres.slice(0, -1).join(', ')} ${y} ${nombres[nombres.length - 1]}`;
}

/** La pregunta en palabras: «¿Es Paco o Marta el demonio?». */
export function describirPreguntaArtista(p: PreguntaArtista, n: NombresArtista): string {
  const nombre = (id: string) => (id === n.yo ? 'tú' : n.asiento(id));
  switch (p.tipo) {
    case 'enJuego':
      return p.quien.por === 'personaje' ? `¿Está el ${n.personaje(p.quien.personaje)} en juego?` : `¿Hay ${sujeto(p.quien, n).replace(/^el /, 'algún ')} en juego?`;
    case 'es': {
      const quienes = p.asientos.map(nombre);
      if (quienes.length === 1) return quienes[0] === 'tú' ? `¿Eres ${atributo(p.quien, n, false)}?` : `¿Es ${quienes[0]} ${atributo(p.quien, n, false)}?`;
      return p.todos
        ? `¿Son ${lista(quienes, 'y')} ${atributo(p.quien, n, true)}?`
        : `¿Es alguno de ${lista(quienes, 'o')} ${atributo(p.quien, n, false)}?`;
    }
    case 'inicial':
      return `¿Empieza por «${p.letra}» el nombre ${sujeto(p.quien, n).replace(/^el /, 'del ').replace(/^algún /, 'de algún ')}?`;
    case 'silla':
      return `¿Se sienta ${sujeto(p.quien, n)} en una silla ${p.par ? 'par' : 'impar'}?`;
    case 'entre':
      return `¿Se sienta ${sujeto(p.quien, n)} entre ${nombre(p.desde)} y ${nombre(p.hasta)}, ambos incluidos, en el sentido de las agujas del reloj?`;
    case 'eligio': {
      const cuando = p.cuando === 'anoche' ? 'anoche' : 'alguna noche';
      const quien = sujeto(p.quien, n);
      return p.a === n.yo ? `¿Te eligió ${quien} ${cuando}?` : `¿Eligió ${quien} a ${nombre(p.a)} ${cuando}?`;
    }
  }
}

/** La respuesta en palabras. */
export const RESPUESTAS_ARTISTA: Record<RespuestaArtista, string> = {
  si: 'Sí.',
  no: 'No.',
  reformular: 'No puedo contestar a eso: reformula la pregunta. No has gastado tu habilidad.',
};
