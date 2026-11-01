import { SALA_RELOJ } from '../../../models/partida/RelojSala';
import type { Accion } from './Accion';

/** Tiempo mínimo (ms) entre dos gongs. */
const SALA_PAUSA_GONG_MS = 5000;

/** El gong y el reloj. */
export const ACCIONES_RELOJ: Record<string, Accion> = {
  /** Suena el gong: todos oyen y ven el aviso de volver a la plaza del pueblo. */
  'narrador:sonarGong': {
    puede: (_sala, yo) => yo.rol === 'narrador',
    noPuede: 'Solo un narrador puede sonar el gong.',
    hacer: (juego) => {
      // Uno cada pocos segundos, para que no se pisen
      const { partida } = juego;
      const ultimo = partida.reloj.gong();
      if (ultimo && Date.now() - ultimo < SALA_PAUSA_GONG_MS) return { ok: false, error: 'El gong aún está sonando.' };
      partida.reloj.sonarGong();
      return { ok: true };
    },
  },

  /**
   * Pone el reloj: una cuenta atrás para todos con un mensaje; al acabar suena el
   * gong. Sustituye al que hubiera. datos: { segundos, mensaje }.
   */
  'narrador:reloj': {
    puede: (_sala, yo) => yo.rol === 'narrador',
    noPuede: 'Solo un narrador puede poner el reloj.',
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const { segundos, mensaje } = (datos as { segundos?: unknown; mensaje?: unknown } | null) ?? {};
      if (typeof segundos !== 'number' || !Number.isInteger(segundos)) return { ok: false, error: 'Indica cuánto dura el reloj.' };
      if (segundos < SALA_RELOJ.minSegundos) return { ok: false, error: `El reloj tiene que durar al menos ${SALA_RELOJ.minSegundos} segundos.` };
      if (segundos > SALA_RELOJ.maxSegundos) return { ok: false, error: `El reloj puede durar como mucho ${SALA_RELOJ.maxSegundos / 60} minutos.` };
      if (mensaje !== undefined && typeof mensaje !== 'string') return { ok: false, error: 'Mensaje no válido.' };
      partida.reloj.ponerReloj(segundos, (mensaje ?? '').trim().slice(0, SALA_RELOJ.mensajeMax));
      return { ok: true };
    },
  },

  /** Acaba el reloj antes de tiempo: suena el gong para todos, como si se hubiera agotado. */
  'narrador:terminarReloj': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.reloj.relojEnMarcha(),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'No hay ningún reloj en marcha.' : 'Solo un narrador puede terminar el reloj.'),
    hacer: (juego) => {
      const { partida } = juego;
      partida.reloj.terminarReloj();
      return { ok: true };
    },
  },

  /** Quita el reloj sin que suene (antes de que acabe, o el «¡Tiempo!» que se queda al acabar). */
  'narrador:quitarReloj': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && !!partida.reloj.reloj(),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'No hay ningún reloj en marcha.' : 'Solo un narrador puede quitar el reloj.'),
    hacer: (juego) => {
      const { partida } = juego;
      partida.reloj.quitarReloj();
      return { ok: true };
    },
  },
};
