import type { SalaAsiento } from '../../contrato/sala';
import type { ContextoNoche } from '../partida/habilidades/HabilidadNocturna';
import type { SalaService } from '../SalaService';

/**
 * Consultas a la mesa que usan las etapas del narrador virtual (solo leen; lo que
 * cambia va por las acciones).
 */

/** El tipo de quien es de verdad el de un asiento. */
export const tipoReal = (sala: SalaService, asiento: SalaAsiento): string | undefined => {
  const id = sala.identidad(asiento);
  return id ? sala.personaje(id)?.tipo : undefined;
};

/** Vivo: ni muerto ni muere esta noche. */
export const vivo = (asiento: SalaAsiento): boolean => !asiento.muerto && !asiento.muertePendiente;

/** Cómo se le nombra en voz alta: quien se sienta o, libre, su asiento. */
export function nombreDeAsiento(sala: SalaService, asientoId: string): string {
  const asientos = sala.asientos();
  const i = asientos.findIndex((a) => a.id === asientoId);
  const ocupante = asientos[i]?.ocupante;
  return (ocupante && sala.buscar(ocupante)?.nombre) || `el asiento ${i + 1}`;
}

/** Lo que consultan las habilidades de noche, desde la sala (para preguntarles como lo haría la sala). */
export const contextoNoche = (sala: SalaService): ContextoNoche => ({
  mesa: () => sala.asientos(),
  identidad: (asiento) => sala.identidad(asiento),
  alineamiento: (asiento) => sala.alineamientoEfectivo(asiento),
  personaje: (id) => sala.personaje(id),
  faroles: () => sala.faroles(),
});

/**
 * Los asientos despertados esta noche a los que aún les falta decir «Entendido»
 * (los asientos libres no contestan). Lo dice quien recibe lo último: si el
 * narrador le ha dado información, el jugador; si el jugador ha elegido y el
 * narrador le ha contestado «Entendido» (lo ha visto), ya está, el jugador no
 * tiene que contestarle a eso.
 */
export function sinEntender(sala: SalaService): string[] {
  const asientos = sala.asientos();
  return sala
    .despertares()
    .filter((d) => {
      if (!asientos.find((a) => a.id === d.asiento)?.ocupante) return false;
      const ultimo = d.mensajes[d.mensajes.length - 1];
      return !!ultimo && ultimo.ficha !== 'entendido';
    })
    .map((d) => d.asiento);
}

/** Si todos los despertados de esta noche han contestado «Entendido». */
export const todosHanEntendido = (sala: SalaService): boolean => sinEntender(sala).length === 0;

/** El índice de un recordatorio de un personaje por su texto (en el original), o -1. */
export const indiceRecordatorio = (sala: SalaService, personaje: string, texto: string): number =>
  sala.personaje(personaje)?.recordatorios.findIndex((t) => t.toLowerCase() === texto.toLowerCase()) ?? -1;
