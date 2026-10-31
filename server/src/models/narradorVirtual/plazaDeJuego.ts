import type { ContextoNoche } from '../partida/habilidades/HabilidadNocturna';
import type { SalaDeJuego } from '../../services/SalaDeJuego';
import { identidadDe } from '../partida/Grimorio';
import type { Jugador } from '../partida/Jugador';

/**
 * Consultas a la plaza que usan las etapas del narrador virtual (solo leen; lo que
 * cambia va por las acciones).
 */

/** El tipo de quien es de verdad el de un asiento. */
export const tipoReal = (juego: SalaDeJuego, jugador: Jugador): string | undefined => {
  const { partida } = juego;
  const id = identidadDe(jugador);
  return id ? partida.guion.personaje(id)?.tipo : undefined;
};

/** Vivo: ni muerto ni muere esta noche. */
export const vivo = (jugador: Jugador): boolean => !jugador.muerto && !jugador.muertePendiente;

/** Cómo se le nombra en voz alta: quien se sienta o, libre, su asiento. */
export function nombreDeAsiento(juego: SalaDeJuego, jugadorId: string): string {
  const { sala, partida } = juego;
  const jugadores = partida.plaza();
  const i = jugadores.findIndex((a) => a.id === jugadorId);
  const ocupante = jugadores[i]?.participanteId;
  return (ocupante && sala.participantes.buscar(ocupante)?.nombre) || `el asiento ${i + 1}`;
}

/** Lo que consultan las habilidades de noche, desde la sala (para preguntarles como lo haría la sala). */
export const contextoNoche = ({ partida }: SalaDeJuego): ContextoNoche => ({
  plaza: () => partida.plaza(),
  identidad: (jugador) => identidadDe(jugador),
  alineamiento: (jugador) => partida.grimorio.alineamiento(jugador),
  personaje: (id) => partida.guion.personaje(id),
  faroles: () => partida.faroles.faroles(),
});

/**
 * Los asientos despertados esta noche a los que aún les falta decir «Entendido»
 * (los asientos libres no contestan). Lo dice quien recibe lo último: si el
 * narrador le ha dado información, el jugador; si el jugador ha elegido y el
 * narrador le ha contestado «Entendido» (lo ha visto), ya está, el jugador no
 * tiene que contestarle a eso.
 */
export function sinEntender(juego: SalaDeJuego): string[] {
  const { partida } = juego;
  const jugadores = partida.plaza();
  return partida.despertares.despertares()
    .filter((d) => {
      if (!jugadores.find((a) => a.id === d.jugador)?.participanteId) return false;
      const ultimo = d.mensajes[d.mensajes.length - 1];
      return !!ultimo && ultimo.ficha !== 'entendido';
    })
    .map((d) => d.jugador);
}

/** Si todos los despertados de esta noche han contestado «Entendido». */
export const todosHanEntendido = (juego: SalaDeJuego): boolean => sinEntender(juego).length === 0;

/** El índice de un recordatorio de un personaje por su texto (en el original), o -1. */
export const indiceRecordatorio = ({ partida }: SalaDeJuego, personaje: string, texto: string): number =>
  partida.guion.personaje(personaje)?.recordatorios.findIndex((t) => t.toLowerCase() === texto.toLowerCase()) ?? -1;
