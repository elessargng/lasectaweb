import type { SalaDeJuego } from '../../../models/SalaDeJuego';
import type { MensajeDespertar } from '../../../models/compartido/despertar';
import { NUM_FAROLES } from '../../../models/compartido/jugador';
import type { Accion } from './Accion';

/** Comprueba una casilla de farol: su posición y un personaje del guion (o null, para vaciarla). */
function leerFarol(juego: SalaDeJuego, datos: unknown): { error: string } | { posicion: number; personajeId: string | null } {
  const { partida } = juego;
  const { posicion, personajeId } = (datos as { posicion?: unknown; personajeId?: unknown } | null) ?? {};
  if (typeof posicion !== 'number' || !Number.isInteger(posicion) || posicion < 0 || posicion >= NUM_FAROLES) {
    return { error: 'Esa casilla de farol no existe.' };
  }
  if (personajeId === null) return { posicion, personajeId: null };
  if (typeof personajeId !== 'string' || !partida.guion.personaje(personajeId)) {
    return { error: 'Ese personaje no está en el guion.' };
  }
  return { posicion, personajeId };
}

/** Los faroles del demonio y de cada jugador. */
export const ACCIONES_FAROLES: Record<string, Accion> = {
  /**
   * Pone un personaje del guion en una casilla de los faroles que el narrador
   * prepara para el demonio, o la vacía. datos: { posicion: 0..2, personajeId: string | null }.
   */
  'narrador:farol': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && !!partida.guion.actual(),
    noPuede: (_sala, yo) => (yo.rol !== 'narrador' ? 'Solo un narrador prepara los faroles.' : 'Antes hay que elegir un guion.'),
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const farol = leerFarol(juego, datos);
      if ('error' in farol) return { ok: false, error: farol.error };
      partida.faroles.ponerFarol(farol.posicion, farol.personajeId);
      return { ok: true };
    },
  },

  /**
   * Un jugador se pone (o se quita) un farol en una de sus casillas, tenga grimorio
   * o no. datos: { posicion: 0..2, personajeId: string | null }.
   */
  'jugador:farol': {
    puede: ({ partida }, yo) => yo.rol === 'jugador' && !!partida.jugadorDe(yo.id) && !!partida.guion.actual(),
    noPuede: 'Solo un jugador sentado se pone faroles.',
    hacer: (juego, yo, datos) => {
      const { partida } = juego;
      const jugador = partida.jugadorDe(yo.id);
      if (!jugador) return { ok: false, error: 'Ya no estás sentado.' };
      const farol = leerFarol(juego, datos);
      if ('error' in farol) return { ok: false, error: farol.error };
      partida.faroles.ponerFarolAsiento(jugador.id, farol.posicion, farol.personajeId);
      return { ok: true };
    },
  },

  /**
   * Un jugador dice cuál de sus faroles está usando (el personaje por el que se
   * hace pasar), para que lo sepa el narrador; o ninguno. datos: { personajeId: string | null }.
   */
  'jugador:usarFarol': {
    puede: ({ partida }, yo) => yo.rol === 'jugador' && !!partida.jugadorDe(yo.id) && !!partida.guion.actual(),
    noPuede: 'Solo un jugador sentado usa faroles.',
    hacer: (juego, yo, datos) => {
      const { partida } = juego;
      const jugador = partida.jugadorDe(yo.id);
      if (!jugador) return { ok: false, error: 'Ya no estás sentado.' };
      const personajeId = (datos as { personajeId?: unknown } | null)?.personajeId ?? null;
      if (personajeId !== null && typeof personajeId !== 'string') return { ok: false, error: 'Personaje desconocido.' };
      const error = partida.faroles.usarFarol(jugador.id, personajeId);
      return error ? { ok: false, error } : { ok: true };
    },
  },

  /**
   * El jugador despierto copia en sus faroles los personajes que el narrador le
   * ha enseñado con «Estos personajes no están en juego». datos: { personajes: id[] }
   * (los de esa tarjeta, que tiene que estar en su despertar).
   */
  'jugador:copiarFaroles': {
    puede: ({ partida }, yo) => yo.rol === 'jugador' && !!partida.despertares.asientoDespiertoDe(yo.id),
    noPuede: 'No tienes ningún despertar abierto.',
    hacer: (juego, yo, datos) => {
      const { partida } = juego;
      const jugadorId = partida.despertares.asientoDespiertoDe(yo.id);
      const personajes = (datos as { personajes?: unknown } | null)?.personajes;
      if (!jugadorId || !Array.isArray(personajes)) return { ok: false, error: 'No hay faroles que copiar.' };
      const mismos = (m: MensajeDespertar) =>
        m.autor === 'narrador' &&
        m.tarjeta === 'noEnJuego' &&
        m.personajes.length === personajes.length &&
        m.personajes.every((id, i) => id === personajes[i]);
      const hilo = partida.despertares.despertares().find((d) => d.jugador === jugadorId);
      if (!hilo?.mensajes.some(mismos)) return { ok: false, error: 'El narrador no te ha enseñado esos personajes.' };
      partida.faroles.copiarFaroles(jugadorId, (personajes as string[]).slice(0, NUM_FAROLES));
      return { ok: true };
    },
  },
};
