import type { Accion } from './Accion';

/** El paso de las fases: anochecer, amanecer, volver atrás y empezar otra vez. */
export const ACCIONES_FASES: Record<string, Accion> = {
  /**
   * Anochece: desde la preparación, la noche 1; desde un día, la noche siguiente.
   * Cierra la nominación y quita la calavera y el récord de votos del día.
   */
  'narrador:irANoche': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.fases.actual().momento !== 'noche',
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'Ya es de noche.' : 'Solo un narrador puede hacer que anochezca.'),
    hacer: (juego) => {
      const { partida } = juego;
      partida.irANoche();
      return { ok: true };
    },
  },

  /** Amanece: de la noche N al día N. */
  'narrador:amanecer': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.fases.actual().momento === 'noche',
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'Solo amanece de noche.' : 'Solo un narrador puede hacer que amanezca.'),
    hacer: (juego) => {
      const { partida } = juego;
      partida.amanecer();
      return { ok: true };
    },
  },

  /**
   * La máquina del tiempo: vuelve a la fase anterior (del día N a la noche N, de la
   * noche N al día anterior o, de la noche 1, a la preparación), por si el narrador
   * se ha precipitado. Ver Partida.volverAtras.
   */
  'narrador:volverAtras': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && !!partida.fases.anterior(),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'En la preparación no hay a dónde volver.' : 'Solo un narrador puede volver atrás.'),
    hacer: ({ partida }) => (partida.volverAtras() ? { ok: true } : { ok: false, error: 'No hay a dónde volver.' }),
  },

  /**
   * Limpia el grimorio: borra el registro de votaciones, deja las fichas como al
   * principio y vuelve a la preparación de la partida.
   */
  'narrador:limpiarGrimorio': {
    puede: (_sala, yo) => yo.rol === 'narrador',
    noPuede: 'Solo un narrador puede limpiar el grimorio.',
    hacer: (juego) => {
      const { partida } = juego;
      partida.limpiarGrimorio();
      return { ok: true };
    },
  },
};
