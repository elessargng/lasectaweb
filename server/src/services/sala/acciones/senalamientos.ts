import { SALA_SENALAMIENTO } from '../../../models/compartido/partida';
import type { Accion } from './Accion';

/** Los señalamientos (también el de Lil' Monsta). */
export const ACCIONES_SENALAMIENTOS: Record<string, Accion> = {
  /**
   * Empieza un señalamiento (sustituye al que hubiera): quiénes señalan, a
   * quiénes (listas vacías: todos), el mensaje y la cuenta atrás (null: sin ella).
   * datos: { mensaje?, segundos: number | null, senaladores?: jugadorId[], objetivos?: jugadorId[] }.
   */
  'narrador:senalamiento': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.plaza().length > 0,
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'La plaza no tiene asientos.' : 'Solo un narrador puede pedir que se señale.'),
    hacer: (juego, _yo, datos) => {
      const { sala, partida } = juego;
      const d = (datos as { mensaje?: unknown; segundos?: unknown; senaladores?: unknown; objetivos?: unknown } | null) ?? {};
      const { minSegundos, maxSegundos, mensajeMax } = SALA_SENALAMIENTO;
      if (d.segundos !== null && (typeof d.segundos !== 'number' || !Number.isInteger(d.segundos))) {
        return { ok: false, error: 'Indica cuántos segundos dura la cuenta atrás.' };
      }
      if (d.segundos !== null && (d.segundos < minSegundos || d.segundos > maxSegundos)) {
        return { ok: false, error: `La cuenta atrás tiene que durar entre ${minSegundos} y ${maxSegundos} segundos.` };
      }
      if (d.mensaje !== undefined && typeof d.mensaje !== 'string') return { ok: false, error: 'Mensaje no válido.' };
      const asientos = (lista: unknown) =>
        Array.isArray(lista) && lista.every((id) => typeof id === 'string' && sala.jugador(id)) ? (lista as string[]) : null;
      const senaladores = d.senaladores === undefined ? [] : asientos(d.senaladores);
      const objetivos = d.objetivos === undefined ? [] : asientos(d.objetivos);
      if (!senaladores || !objetivos) return { ok: false, error: 'Alguno de esos asientos ya no existe.' };
      partida.empezarSenalamiento({
        mensaje: (d.mensaje ?? '').replace(/\s+/g, ' ').trim().slice(0, mensajeMax),
        segundos: d.segundos,
        senaladores,
        objetivos,
      });
      return { ok: true };
    },
  },

  /**
   * Lil' Monsta (de noche, con él en el guion, sin demonio y con un esbirro de más):
   * despierta a los esbirros vivos y señalan, sin cuenta atrás, hasta que todos
   * eligen al mismo (ese lo cuida: ver Partida.senalar).
   */
  'narrador:lilmonsta': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && !!partida.esbirrosLilmonsta(),
    noPuede: (_sala, yo) =>
      yo.rol === 'narrador'
        ? "Lil' Monsta se empieza de noche, sin demonio en la plaza y con un esbirro de más."
        : "Solo un narrador puede empezar Lil' Monsta.",
    hacer: (juego) => {
      const { partida } = juego;
      const esbirros = partida.esbirrosLilmonsta()!;
      partida.empezarSenalamiento({
        tipo: 'lilmonsta',
        mensaje: "Esbirros, elegid quién cuida de Lil' Monsta",
        segundos: null,
        senaladores: esbirros,
        objetivos: esbirros,
      });
      return { ok: true };
    },
  },

  /** Quita el señalamiento (en marcha o ya congelado). */
  'narrador:terminarSenalamiento': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && !!partida.senalamientos.senalamiento(),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'No hay ningún señalamiento.' : 'Solo un narrador puede terminar el señalamiento.'),
    hacer: (juego) => {
      const { partida } = juego;
      partida.senalamientos.terminar();
      return { ok: true };
    },
  },

  /**
   * El jugador de un asiento que señala elige a quién (o deja de señalar), mientras
   * no se congele. datos: { jugadorId: string | null }.
   */
  'jugador:senalar': {
    puede: (juego, yo) => {
      const { partida } = juego;
      const s = partida.senalamientos.senalamiento();
      const jugador = partida.jugadorDe(yo.id);
      return yo.rol === 'jugador' && !!s && !s.congelado && !!jugador && s.senaladores.includes(jugador.id);
    },
    noPuede: 'No te toca señalar.',
    hacer: (juego, yo, datos) => {
      const { partida } = juego;
      const jugadorId = (datos as { jugadorId?: unknown } | null)?.jugadorId;
      if (jugadorId !== null && typeof jugadorId !== 'string') return { ok: false, error: 'Ese asiento ya no existe.' };
      const error = partida.senalar(yo.id, jugadorId);
      return error ? { ok: false, error } : { ok: true };
    },
  },
};
