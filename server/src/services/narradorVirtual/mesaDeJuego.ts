import type { SalaAsiento } from '../../contrato/sala';
import type { ContextoNoche } from '../partida/habilidades/HabilidadNocturna';
import type { SalaDeJuego } from '../SalaDeJuego';
import { identidadDe } from '../partida/Grimorio';

/**
 * Consultas a la mesa que usan las etapas del narrador virtual (solo leen; lo que
 * cambia va por las acciones).
 */

/** El tipo de quien es de verdad el de un asiento. */
export const tipoReal = (juego: SalaDeJuego, asiento: SalaAsiento): string | undefined => {
  const { partida } = juego;
  const id = identidadDe(asiento);
  return id ? partida.guion.personaje(id)?.tipo : undefined;
};

/** Vivo: ni muerto ni muere esta noche. */
export const vivo = (asiento: SalaAsiento): boolean => !asiento.muerto && !asiento.muertePendiente;

/** Cómo se le nombra en voz alta: quien se sienta o, libre, su asiento. */
export function nombreDeAsiento(juego: SalaDeJuego, asientoId: string): string {
  const { sala, partida } = juego;
  const asientos = partida.mesa();
  const i = asientos.findIndex((a) => a.id === asientoId);
  const ocupante = asientos[i]?.ocupante;
  return (ocupante && sala.participantes.buscar(ocupante)?.nombre) || `el asiento ${i + 1}`;
}

/** Lo que consultan las habilidades de noche, desde la sala (para preguntarles como lo haría la sala). */
export const contextoNoche = ({ partida }: SalaDeJuego): ContextoNoche => ({
  mesa: () => partida.mesa(),
  identidad: (asiento) => identidadDe(asiento),
  alineamiento: (asiento) => partida.grimorio.alineamiento(asiento),
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
  const asientos = partida.mesa();
  return partida.despertares.despertares()
    .filter((d) => {
      if (!asientos.find((a) => a.id === d.asiento)?.ocupante) return false;
      const ultimo = d.mensajes[d.mensajes.length - 1];
      return !!ultimo && ultimo.ficha !== 'entendido';
    })
    .map((d) => d.asiento);
}

/** Si todos los despertados de esta noche han contestado «Entendido». */
export const todosHanEntendido = (juego: SalaDeJuego): boolean => sinEntender(juego).length === 0;

/** El índice de un recordatorio de un personaje por su texto (en el original), o -1. */
export const indiceRecordatorio = ({ partida }: SalaDeJuego, personaje: string, texto: string): number =>
  partida.guion.personaje(personaje)?.recordatorios.findIndex((t) => t.toLowerCase() === texto.toLowerCase()) ?? -1;
