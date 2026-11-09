import {
  describirPreguntaPartida,
  leerPreguntaPartida,
  MAX_PREGUNTA_LIBRE,
  type PreguntaPartida,
  type RespuestaPregunta,
} from '../compartido/preguntaPartida';
import { droison } from './ReglaPersonaje';
import type { ContextoEtapa } from '../narradorVirtual/etapas/Etapa';
import { contextoNoche, nombreDeAsiento } from '../narradorVirtual/plazaDeJuego';
import { contestarPregunta } from '../narradorVirtual/contestarPregunta';
import { ponerRecordatorio } from '../narradorVirtual/noche/requisitos';
import { identidadDe } from '../partida/Grimorio';
import { diaVirtual } from '../narradorVirtual/dia/reglasDia';
import type { DeclaracionDia } from './DeclaracionDia';
import type { DefinicionPersonaje } from './DefinicionPersonaje';

/**
 * La pregunta del Artista (una vez por partida y persona, lo sea o no, como el
 * disparo del Exterminador). A quien no es el Artista ni cree serlo (el Borracho
 * con su ficha sí lo cree), una respuesta de broma («broma»). Al que lo es o lo
 * cree: libre (con Jarvis), la contesta su estrategia, que puede pedir que la
 * reformule; «Tonto y tú» siempre lo pide, porque no la entiende. Montada con
 * piezas (ver models/compartido/preguntaPartida): al Artista de verdad y sano se le
 * contesta la verdad, mirando el grimorio; al envenenado, borracho o Borracho, sí
 * o no, lo que decida su estrategia. Si se contesta, se gasta: quien lleva la ficha
 * del Artista pierde su habilidad («No Ability»).
 */
export async function preguntarComoArtista(
  ctx: ContextoEtapa,
  jugador: string,
  datos: unknown,
): Promise<{ error: string } | { respuesta: RespuestaPregunta }> {
  const { juego } = ctx;
  const { partida } = juego;
  const asiento = partida.jugadorDe(jugador);
  if (!asiento) return { error: 'No estás sentado.' };
  const { texto, pregunta } = (datos as { texto?: unknown; pregunta?: unknown } | null) ?? {};
  const esArtista = identidadDe(asiento) === 'artist';
  // El Borracho que lleva la ficha del Artista cree serlo: como un Artista borracho
  const creeSerlo = esArtista || asiento.personaje === 'artist';
  const sano = esArtista && !droison(contextoNoche(juego), asiento);
  const quien = `${nombreDeAsiento(juego, asiento.id)} (${sano ? 'el Artista, sano' : esArtista ? 'el Artista, envenenado o borracho' : `cree ser el Artista, pero es ${identidadDe(asiento) ?? 'nadie'}`})`;

  // La pregunta en palabras y, si está montada con piezas, leída
  let enPalabras: string;
  let leida: PreguntaPartida | null = null;
  if (typeof texto === 'string') {
    enPalabras = texto.trim();
    if (!enPalabras) return { error: 'Escribe la pregunta.' };
    if (enPalabras.length > MAX_PREGUNTA_LIBRE) return { error: `La pregunta no puede pasar de ${MAX_PREGUNTA_LIBRE} letras.` };
  } else {
    leida = leerPreguntaPartida(
      pregunta,
      partida.plaza().map((a) => a.id),
      (partida.guion.actual()?.personajes ?? []).map((p) => p.id),
    );
    if (!leida) return { error: 'Esa pregunta no se entiende.' };
    enPalabras = describirPreguntaPartida(leida, { jugador: (id) => nombreDeAsiento(juego, id), personaje: (id) => partida.guion.personaje(id)?.nombre ?? id });
  }

  let respuesta: RespuestaPregunta;
  if (!creeSerlo) {
    respuesta = 'broma';
  } else if (!leida) {
    // «Tonto y tú» no entiende una pregunta libre: solo puede pedir que la reformule
    respuesta = await ctx.decidir<RespuestaPregunta>({
      motivo: 'artista',
      pregunta: `${quien} pregunta: «${enPalabras}»`,
      opciones: [
        { clave: 'si', descripcion: 'Contestar que sí.', valor: 'si', peso: 0 },
        { clave: 'no', descripcion: 'Contestar que no.', valor: 'no', peso: 0 },
        { clave: 'reformular', descripcion: 'Pedir que la reformule (no la puedes contestar con sí o no o con lo que sabes).', valor: 'reformular' },
      ],
    });
  } else {
    const verdad = contestarPregunta(juego, ctx.recuerdos.cronica, leida);
    const si = sano
      ? verdad
      : await ctx.siONo({
          motivo: 'artistaSinHabilidad',
          pregunta: `${quien} pregunta: «${enPalabras}» (la verdad: ${verdad ? 'sí' : 'no'}).`,
          si: 'Contestar que sí.',
          no: 'Contestar que no.',
        });
    respuesta = si ? 'si' : 'no';
  }

  partida.anotar({ tipo: 'artista', asiento: partida.asientoDiario(asiento.id), pregunta: enPalabras, respuesta });
  if (respuesta === 'reformular') return { respuesta };
  if (creeSerlo) await ponerRecordatorio(ctx, asiento.id, 'artist', 'No Ability');
  partida.declaraciones.apuntar(deDia.id, jugador);
  return { respuesta };
}

/**
 * Preguntar como Artista: de día, vivo, una vez por partida y persona (salvo que
 * le pida que la reformule). En privado: no se cuenta a la plaza. datos: { texto }
 * (libre) o { pregunta } (montada, ver models/compartido/preguntaPartida); contesta en
 * `valor`: 'si', 'no' o 'reformular'.
 */
const deDia: DeclaracionDia = {
  id: 'artista',
  personaje: 'artist',
  publica: false,
  puede: (juego, yo) => {
    const { partida } = juego;
    const jugador = partida.jugadorDe(yo.id);
    return !!diaVirtual(juego) && !!jugador && !jugador.muerto && !partida.declaraciones.hecha(deDia.id, yo.id);
  },
  noPuede: ({ partida }, yo) =>
    partida.declaraciones.hecha(deDia.id, yo.id) ? 'Ya has hecho tu pregunta de Artista.' : 'Ahora no se puede preguntar como Artista.',
  async declarar(ctx, yo, datos) {
    const r = await preguntarComoArtista(ctx, yo, datos);
    return 'error' in r ? r : { valor: r.respuesta };
  },
};

export const artista: DefinicionPersonaje = { deDia };
