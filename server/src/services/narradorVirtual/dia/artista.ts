import {
  describirPreguntaArtista,
  leerPreguntaArtista,
  MAX_PREGUNTA_ARTISTA,
  type PreguntaArtista,
  type QuienArtista,
  type RespuestaArtista,
} from '../../../contrato/artista';
import type { SalaAsiento } from '../../../contrato/sala';
import { droison } from '../../partida/reglas/ReglaPersonaje';
import type { SalaService } from '../../SalaService';
import type { ContextoEtapa } from '../etapas/Etapa';
import { esDemonio } from '../final/comprobarFinal';
import type { Cronica } from '../final/cronica';
import { contextoNoche, nombreDeAsiento, tipoReal } from '../mesaDeJuego';
import { ponerRecordatorio } from '../noche/requisitos';

/**
 * La pregunta del Artista (una vez por partida y persona, lo sea o no, como el
 * disparo del Exterminador). Libre (con Jarvis): la contesta su estrategia, que
 * puede pedir que la reformule; «Tonto y tú» siempre lo pide, porque no la
 * entiende. Montada con piezas (ver contrato/artista): al Artista de verdad y sano
 * se le contesta la verdad, mirando el grimorio; a los demás, lo que decida su
 * estrategia. Si se contesta, se gasta: el Artista de verdad pierde su habilidad («No Ability»).
 */
export async function preguntarComoArtista(
  ctx: ContextoEtapa,
  jugador: string,
  datos: unknown,
): Promise<{ error: string } | { respuesta: RespuestaArtista }> {
  const { sala } = ctx;
  const asiento = sala.asientoDe(jugador);
  if (!asiento) return { error: 'No estás sentado.' };
  const { texto, pregunta } = (datos as { texto?: unknown; pregunta?: unknown } | null) ?? {};
  const artista = sala.identidad(asiento) === 'artist';
  const sano = artista && !droison(contextoNoche(sala), asiento);
  const quien = `${nombreDeAsiento(sala, asiento.id)} (${artista ? (sano ? 'el Artista, sano' : 'el Artista, envenenado o borracho') : `no es el Artista: es ${sala.identidad(asiento) ?? 'nadie'}`})`;

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
      sala.asientos().map((a) => a.id),
      (sala.guion()?.personajes ?? []).map((p) => p.id),
    );
    if (!leida) return { error: 'Esa pregunta no se entiende.' };
    const verdad = contestar(sala, ctx.recuerdos.cronica, leida);
    enPalabras = describirPreguntaArtista(leida, { asiento: (id) => nombreDeAsiento(sala, id), personaje: (id) => sala.personaje(id)?.nombre ?? id });
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

  sala.anotar({ tipo: 'artista', asiento: sala.asientoDiario(asiento.id), pregunta: enPalabras, respuesta });
  if (respuesta === 'reformular') return { respuesta };
  if (artista) await ponerRecordatorio(ctx, asiento.id, 'artist', 'No Ability');
  const narrador = sala.narradorVirtual();
  if (narrador) sala.actualizarNarradorVirtual({ artistas: [...narrador.artistas, jugador] });
  return { respuesta };
}

/** Si un asiento es lo que se pregunta: el demonio lo es también la Mujer Escarlata que lo ha heredado. */
function es(sala: SalaService, asiento: SalaAsiento, quien: QuienArtista): boolean {
  if (quien.por === 'personaje') return sala.identidad(asiento) === quien.personaje;
  if (quien.por === 'tipo') return quien.tipo === 'demon' ? esDemonio(sala, asiento) : tipoReal(sala, asiento) === quien.tipo;
  return (sala.alineamientoEfectivo(asiento) ?? 'bueno') === quien.alineamiento;
}

/** Sin tildes ni mayúsculas: para comparar la inicial. */
const llana = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** La respuesta de verdad a una pregunta montada, con el grimorio y lo apuntado en la crónica (quién eligió a quién). */
export function contestar(sala: SalaService, cronica: Cronica, p: PreguntaArtista): boolean {
  const mesa = sala.asientos();
  const conQuien = mesa.filter((a) => es(sala, a, p.quien));
  switch (p.tipo) {
    case 'enJuego':
      return conQuien.length > 0;
    case 'es': {
      const de = p.asientos.flatMap((id) => mesa.find((a) => a.id === id) ?? []);
      return p.todos ? de.every((a) => es(sala, a, p.quien)) : de.some((a) => es(sala, a, p.quien));
    }
    case 'inicial':
      // Solo los que se sientan tienen nombre
      return conQuien.some((a) => {
        const nombre = a.ocupante ? sala.buscar(a.ocupante)?.nombre : undefined;
        return !!nombre && llana(nombre).startsWith(llana(p.letra));
      });
    case 'silla':
      return conQuien.some((a) => (mesa.indexOf(a) + 1) % 2 === (p.par ? 0 : 1));
    case 'entre': {
      const desde = mesa.findIndex((a) => a.id === p.desde);
      const hasta = mesa.findIndex((a) => a.id === p.hasta);
      if (desde < 0 || hasta < 0) return false;
      const tramo: SalaAsiento[] = [];
      for (let i = desde; ; i = (i + 1) % mesa.length) {
        tramo.push(mesa[i]);
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
