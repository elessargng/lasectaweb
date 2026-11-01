import { identidadDe } from '../../../models/partida/Grimorio';
import { CAUSAS_DE_ESBIRRO, CAUSAS_FIN_PARTIDA } from '../../../models/compartido/partida';
import type { Accion } from './Accion';

/** La revelación del grimorio al acabar la partida. */
export const ACCIONES_REVELACION: Record<string, Accion> = {
  /**
   * Revelar el grimorio (final de la partida): el narrador dice qué bando ha
   * ganado y todas las fichas se dan la vuelta. datos: { ganador: 'bueno' | 'malvado', causas?: string[] }
   * (ver CAUSAS_FIN_PARTIDA: lo que ha pasado con los personajes de la lista en juego).
   */
  'narrador:revelarGrimorio': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && !partida.revelacion.revelacion() && partida.plaza().length > 0,
    noPuede: ({ partida }, yo) =>
      yo.rol !== 'narrador'
        ? 'Solo un narrador puede revelar el grimorio.'
        : partida.revelacion.revelacion()
          ? 'Ya se está revelando el grimorio.'
          : 'La plaza no tiene asientos.',
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const { ganador, causas = [], esbirros = {} } =
        (datos as { ganador?: unknown; causas?: unknown; esbirros?: unknown } | null) ?? {};
      if (ganador !== 'bueno' && ganador !== 'malvado') return { ok: false, error: 'Bando desconocido.' };
      // Lo que ha pasado: solo de los personajes de la lista que están en juego (quien es de verdad cada uno)
      const enJuego = new Set(partida.plaza().map((a) => identidadDe(a)));
      if (!Array.isArray(causas) || causas.some((c) => typeof c !== 'string' || !CAUSAS_FIN_PARTIDA.includes(c) || !enJuego.has(c))) {
        return { ok: false, error: 'Hay un personaje que no está en juego.' };
      }
      // Las causas de esbirro (la Doncel cazada) dicen qué esbirro fue: un asiento que es esbirro de verdad
      if (typeof esbirros !== 'object' || esbirros === null) return { ok: false, error: 'Esbirros no válidos.' };
      const elegidos = esbirros as Record<string, unknown>;
      const esEsbirro = (id: unknown) => {
        const a = partida.plaza().find((x) => x.id === id);
        const quien = a ? identidadDe(a) : null;
        return !!quien && partida.guion.personaje(quien)?.tipo === 'minion';
      };
      for (const c of causas as string[]) {
        if (CAUSAS_DE_ESBIRRO.includes(c) && !esEsbirro(elegidos[c])) {
          return { ok: false, error: 'Elige qué esbirro descubrió a la Doncel.' };
        }
      }
      const esbirroDe = Object.fromEntries(
        (causas as string[]).filter((c) => CAUSAS_DE_ESBIRRO.includes(c)).map((c) => [c, elegidos[c] as string]),
      );
      partida.empezarRevelacion(ganador, [...new Set(causas as string[])], esbirroDe);
      return { ok: true };
    },
  },

  /** Revela la ficha de un asiento, para todos. datos: { jugadorId }. */
  'narrador:revelarFicha': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && !!partida.revelacion.revelacion() && !partida.revelacion.revelacion()!.terminada,
    noPuede: 'No se está revelando el grimorio.',
    hacer: (juego, _yo, datos) => {
      const { sala, partida } = juego;
      const jugadorId = (datos as { jugadorId?: unknown } | null)?.jugadorId;
      if (typeof jugadorId !== 'string' || !sala.jugador(jugadorId)) return { ok: false, error: 'Ese asiento ya no existe.' };
      partida.revelacion.revelarFicha(jugadorId);
      return { ok: true };
    },
  },

  /** Termina la revelación: revela de una vez las fichas que quedan. */
  'narrador:terminarRevelacion': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && !!partida.revelacion.revelacion() && !partida.revelacion.revelacion()!.terminada,
    noPuede: 'No se está revelando el grimorio.',
    hacer: (juego) => {
      const { partida } = juego;
      partida.revelacion.revelarTodas();
      return { ok: true };
    },
  },
};
