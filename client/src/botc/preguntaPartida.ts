/**
 * La pregunta del Artista en palabras, para enseñarla antes de enviarla
 * («¿Es Paco o Marta el demonio?»), y lo que significa cada respuesta.
 */
import type { PreguntaPartida, QuienPregunta, RespuestaPregunta, TipoPreguntable } from '@views/preguntaPartida';

const TIPO_SINGULAR: Record<TipoPreguntable, string> = { townsfolk: 'aldeano', outsider: 'forastero', minion: 'esbirro', demon: 'demonio' };
const TIPO_PLURAL: Record<TipoPreguntable, string> = { townsfolk: 'aldeanos', outsider: 'forasteros', minion: 'esbirros', demon: 'demonios' };

/** Cómo se nombran los jugadores y los personajes al decir la pregunta. */
export interface NombresPregunta {
  jugador(id: string): string;
  personaje(id: string): string;
  /** El jugador que pregunta: de él se dice «te» / «tú». */
  yo?: string | null;
}

/** «el demonio», «algún esbirro», «el Mayor», «algún malvado». */
function sujeto(q: QuienPregunta, n: NombresPregunta): string {
  if (q.por === 'personaje') return `el ${n.personaje(q.personaje)}`;
  if (q.por === 'tipo') return q.tipo === 'demon' ? 'el demonio' : `algún ${TIPO_SINGULAR[q.tipo]}`;
  return `algún ${q.alineamiento}`;
}

/** Lo que se pregunta de unos jugadores: «el demonio», «aldeano», «malvados»… */
function atributo(q: QuienPregunta, n: NombresPregunta, plural: boolean): string {
  if (q.por === 'personaje') return `el ${n.personaje(q.personaje)}`;
  if (q.por === 'tipo') return q.tipo === 'demon' && !plural ? 'el demonio' : (plural ? TIPO_PLURAL : TIPO_SINGULAR)[q.tipo];
  return plural ? `${q.alineamiento}s` : q.alineamiento;
}

/** «Paco», «Paco o Marta», «Paco, Marta y Pepe». */
function lista(nombres: string[], y: 'y' | 'o'): string {
  return nombres.length < 2 ? (nombres[0] ?? '') : `${nombres.slice(0, -1).join(', ')} ${y} ${nombres[nombres.length - 1]}`;
}

/** La pregunta en palabras: «¿Es Paco o Marta el demonio?». */
export function describirPreguntaPartida(p: PreguntaPartida, n: NombresPregunta): string {
  const nombre = (id: string) => (id === n.yo ? 'tú' : n.jugador(id));
  switch (p.tipo) {
    case 'enJuego':
      return p.quien.por === 'personaje' ? `¿Está el ${n.personaje(p.quien.personaje)} en juego?` : `¿Hay ${sujeto(p.quien, n).replace(/^el /, 'algún ')} en juego?`;
    case 'es': {
      const quienes = p.jugadores.map(nombre);
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
export const RESPUESTAS_PREGUNTA: Record<RespuestaPregunta, string> = {
  si: 'Sí.',
  no: 'No.',
  reformular: 'No puedo contestar a eso: reformula la pregunta. No has gastado tu habilidad.',
  broma: '¿Sí o no? Lo que tú quieras ;)',
};
