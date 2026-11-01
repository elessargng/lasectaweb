import type { PreguntaPartida, QuienPregunta } from '../compartido/preguntaPartida';
import type { SalaDeJuego } from '../SalaDeJuego';
import { identidadDe } from '../partida/Grimorio';
import type { Jugador } from '../partida/Jugador';
import { esDemonio } from './final/comprobarFinal';
import type { Cronica } from './final/cronica';
import { tipoReal } from './plazaDeJuego';

/** Si un asiento es lo que se pregunta: el demonio lo es también la Mujer Escarlata que lo ha heredado. */
function es(juego: SalaDeJuego, jugador: Jugador, quien: QuienPregunta): boolean {
  const { partida } = juego;
  if (quien.por === 'personaje') return identidadDe(jugador) === quien.personaje;
  if (quien.por === 'tipo') return quien.tipo === 'demon' ? esDemonio(juego, jugador) : tipoReal(juego, jugador) === quien.tipo;
  return (partida.grimorio.alineamiento(jugador) ?? 'bueno') === quien.alineamiento;
}

/** Sin tildes ni mayúsculas: para comparar la inicial. */
const llana = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * La respuesta de verdad a una pregunta sobre la partida (ver
 * compartido/preguntaPartida), con el grimorio y lo apuntado en la crónica (quién
 * eligió a quién).
 */
export function contestarPregunta(juego: SalaDeJuego, cronica: Cronica, p: PreguntaPartida): boolean {
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
