import {
  describirPreguntaArtista,
  leerPreguntaArtista,
  MAX_PREGUNTA_ARTISTA,
  type PreguntaArtista,
  type QuienArtista,
  type RespuestaArtista,
} from '../compartido/artista';
import { droison } from './ReglaPersonaje';
import type { SalaDeJuego } from '../SalaDeJuego';
import type { ContextoEtapa } from '../narradorVirtual/etapas/Etapa';
import { esDemonio } from '../narradorVirtual/final/comprobarFinal';
import type { Cronica } from '../narradorVirtual/final/cronica';
import { contextoNoche, nombreDeAsiento, tipoReal } from '../narradorVirtual/plazaDeJuego';
import { ponerRecordatorio } from '../narradorVirtual/noche/requisitos';
import { identidadDe } from '../partida/Grimorio';
import type { Jugador } from '../partida/Jugador';
import { diaVirtual } from '../narradorVirtual/dia/reglasDia';
import type { DeclaracionDia } from './DeclaracionDia';

/**
 * La pregunta del Artista (una vez por partida y persona, lo sea o no, como el
 * disparo del Exterminador). Libre (con Jarvis): la contesta su estrategia, que
 * puede pedir que la reformule; «Tonto y tú» siempre lo pide, porque no la
 * entiende. Montada con piezas (ver models/compartido/artista): al Artista de verdad y sano
 * se le contesta la verdad, mirando el grimorio; a los demás, lo que decida su
 * estrategia. Si se contesta, se gasta: el Artista de verdad pierde su habilidad («No Ability»).
 */
export async function preguntarComoArtista(
  ctx: ContextoEtapa,
  jugador: string,
  datos: unknown,
): Promise<{ error: string } | { respuesta: RespuestaArtista }> {
  const { juego } = ctx;
  const { partida } = juego;
  const asiento = partida.jugadorDe(jugador);
  if (!asiento) return { error: 'No estás sentado.' };
  const { texto, pregunta } = (datos as { texto?: unknown; pregunta?: unknown } | null) ?? {};
  const esArtista = identidadDe(asiento) === 'artist';
  const sano = esArtista && !droison(contextoNoche(juego), asiento);
  const quien = `${nombreDeAsiento(juego, asiento.id)} (${esArtista ? (sano ? 'el Artista, sano' : 'el Artista, envenenado o borracho') : `no es el Artista: es ${identidadDe(asiento) ?? 'nadie'}`})`;

  let respuesta: RespuestaArtista;
  let enPalabras: string;
  if (typeof texto === 'string') {
    const libre = texto.trim();
    if (!libre) return { error: 'Escribe la pregunta.' };
    if (libre.length > MAX_PREGUNTA_ARTISTA) return { error: `La pregunta no puede pasar de ${MAX_PREGUNTA_ARTISTA} letras.` };
    enPalabras = libre;
    // «Tonto y tú» no entiende una pregunta libre: solo puede pedir que la reformule
    respuesta = await ctx.decidir<RespuestaArtista>({
      motivo: 'artista',
      pregunta: `${quien} pregunta: «${libre}»`,
      opciones: [
        { clave: 'si', descripcion: 'Contestar que sí.', valor: 'si', peso: 0 },
        { clave: 'no', descripcion: 'Contestar que no.', valor: 'no', peso: 0 },
        { clave: 'reformular', descripcion: 'Pedir que la reformule (no la puedes contestar con sí o no o con lo que sabes).', valor: 'reformular' },
      ],
    });
  } else {
    const leida = leerPreguntaArtista(
      pregunta,
      partida.plaza().map((a) => a.id),
      (partida.guion.actual()?.personajes ?? []).map((p) => p.id),
    );
    if (!leida) return { error: 'Esa pregunta no se entiende.' };
    const verdad = contestar(juego, ctx.recuerdos.cronica, leida);
    enPalabras = describirPreguntaArtista(leida, { jugador: (id) => nombreDeAsiento(juego, id), personaje: (id) => partida.guion.personaje(id)?.nombre ?? id });
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
  if (esArtista) await ponerRecordatorio(ctx, asiento.id, 'artist', 'No Ability');
  partida.declaraciones.apuntar(artista.id, jugador);
  return { respuesta };
}

/** Si un asiento es lo que se pregunta: el demonio lo es también la Mujer Escarlata que lo ha heredado. */
function es(juego: SalaDeJuego, jugador: Jugador, quien: QuienArtista): boolean {
  const { partida } = juego;
  if (quien.por === 'personaje') return identidadDe(jugador) === quien.personaje;
  if (quien.por === 'tipo') return quien.tipo === 'demon' ? esDemonio(juego, jugador) : tipoReal(juego, jugador) === quien.tipo;
  return (partida.grimorio.alineamiento(jugador) ?? 'bueno') === quien.alineamiento;
}

/** Sin tildes ni mayúsculas: para comparar la inicial. */
const llana = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** La respuesta de verdad a una pregunta montada, con el grimorio y lo apuntado en la crónica (quién eligió a quién). */
export function contestar(juego: SalaDeJuego, cronica: Cronica, p: PreguntaArtista): boolean {
  const { sala, partida } = juego;
  const plaza = partida.plaza();
  const conQuien = plaza.filter((a) => es(juego, a, p.quien));
  switch (p.tipo) {
    case 'enJuego':
      return conQuien.length > 0;
    case 'es': {
      const de = p.jugadores.flatMap((id) => plaza.find((a) => a.id === id) ?? []);
      return p.todos ? de.every((a) => es(juego, a, p.quien)) : de.some((a) => es(juego, a, p.quien));
    }
    case 'inicial':
      // Solo los que se sientan tienen nombre
      return conQuien.some((a) => {
        const nombre = a.participanteId ? sala.participantes.buscar(a.participanteId)?.nombre : undefined;
        return !!nombre && llana(nombre).startsWith(llana(p.letra));
      });
    case 'silla':
      return conQuien.some((a) => (plaza.indexOf(a) + 1) % 2 === (p.par ? 0 : 1));
    case 'entre': {
      const desde = plaza.findIndex((a) => a.id === p.desde);
      const hasta = plaza.findIndex((a) => a.id === p.hasta);
      if (desde < 0 || hasta < 0) return false;
      const tramo: Jugador[] = [];
      for (let i = desde; ; i = (i + 1) % plaza.length) {
        tramo.push(plaza[i]);
        if (i === hasta) break;
      }
      return tramo.some((a) => conQuien.includes(a));
    }
    case 'eligio':
      return conQuien.some((a) =>
        (cronica.noches.get(a.id) ?? []).some(
          (n) => (p.cuando === 'algunaNoche' || n.noche === cronica.ultimaNoche) && n.eligio.some((elegidos) => elegidos.includes(p.a)),
        ),
      );
  }
}

/**
 * Preguntar como Artista: de día, vivo, una vez por partida y persona (salvo que
 * le pida que la reformule). En privado: no se cuenta a la plaza. datos: { texto }
 * (libre) o { pregunta } (montada, ver models/compartido/artista); contesta en
 * `valor`: 'si', 'no' o 'reformular'.
 */
export const artista: DeclaracionDia = {
  id: 'artista',
  publica: false,
  puede: (juego, yo) => {
    const { partida } = juego;
    const jugador = partida.jugadorDe(yo.id);
    return !!diaVirtual(juego) && !!jugador && !jugador.muerto && !partida.declaraciones.hecha(artista.id, yo.id);
  },
  noPuede: ({ partida }, yo) =>
    partida.declaraciones.hecha(artista.id, yo.id) ? 'Ya has hecho tu pregunta de Artista.' : 'Ahora no se puede preguntar como Artista.',
  async declarar(ctx, yo, datos) {
    const r = await preguntarComoArtista(ctx, yo, datos);
    return 'error' in r ? r : { valor: r.respuesta };
  },
};
