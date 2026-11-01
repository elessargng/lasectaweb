import { type Accion, cadena, esNarrador } from './Accion';

/** El día: las nominaciones, la votación, la calavera y la ejecución. */
export const ACCIONES_DIA: Record<string, Accion> = {
  /** En la nominación, da la palabra a un participante (los demás jugadores callan) o, con null, a todos. datos: { participanteId | null }. */
  'narrador:darPalabra': {
    puede: esNarrador,
    noPuede: 'Solo un narrador da la palabra.',
    hacer: (juego, _yo, datos) => {
      const { sala, partida } = juego;
      const id = (datos as { participanteId?: unknown } | null)?.participanteId;
      if (id !== null && (typeof id !== 'string' || !sala.participantes.buscar(id))) return { ok: false, error: 'Esa persona ya no está en la sala.' };
      const error = partida.nominaciones.darPalabra(id);
      return error ? { ok: false, error } : { ok: true };
    },
  },

  /**
   * La ficha de un asiento nomina a la de otro (o a sí misma). datos: { desde, hasta
   * (ids de asiento), comoAldeano? (si quien nomina registra como aldeano: el Espía
   * que nomina a la Virgen) }. Si hace falta saberlo y no viene, no se nomina: valor
   * «comoAldeano», para volver a pedirlo con la respuesta.
   */
  'narrador:nominar': {
    // Solo de día
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.fases.actual().momento === 'dia' && partida.plaza().length >= 2,
    noPuede: ({ partida }, yo) =>
      yo.rol !== 'narrador'
        ? 'Solo un narrador puede abrir una nominación.'
        : partida.fases.actual().momento !== 'dia'
          ? 'Solo se nomina de día.'
          : 'Hacen falta al menos dos asientos.',
    hacer: (juego, _yo, datos) => {
      const { sala, partida } = juego;
      const { desde, hasta, comoAldeano } = (datos as { desde?: unknown; hasta?: unknown; comoAldeano?: unknown }) ?? {};
      if (typeof desde !== 'string' || typeof hasta !== 'string' || !sala.jugador(desde) || !sala.jugador(hasta)) {
        return { ok: false, error: 'Ese asiento ya no existe.' };
      }
      // La Virgen: si se ejecuta al momento a quien nomina, «ejecutado» o, si quedan dos vivos, «final» (ver narrador:ejecutar)
      const resultado = partida.nominar(desde, hasta, typeof comoAldeano === 'boolean' ? { comoAldeano } : {});
      if (!resultado) return { ok: true };
      if ('pregunta' in resultado) return { ok: true, valor: resultado.pregunta };
      return { ok: true, valor: resultado.final ? 'final' : 'ejecutado' };
    },
  },

  'narrador:cerrarNominacion': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && !!partida.nominaciones.nominacion(),
    noPuede: 'No hay ninguna nominación abierta.',
    hacer: (juego) => {
      const { partida } = juego;
      partida.nominaciones.cerrarNominacion();
      return { ok: true };
    },
  },

  /**
   * Cambia los votos que hacen falta en la nominación abierta. datos: { votos:
   * número entero de 1 al número de asientos, o null para volver a los de por defecto }.
   */
  'narrador:votosNecesarios': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && !!partida.nominaciones.nominacion(),
    noPuede: 'No hay ninguna nominación abierta.',
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const votos = (datos as { votos?: unknown } | null)?.votos;
      const maximo = Math.max(1, partida.plaza().length);
      if (votos !== null && (typeof votos !== 'number' || !Number.isInteger(votos) || votos < 1 || votos > maximo)) {
        return { ok: false, error: `Los votos tienen que ser de 1 a ${maximo}.` };
      }
      partida.nominaciones.elegirVotosNecesarios(votos);
      return { ok: true };
    },
  },

  /**
   * Arranca la cuenta atrás de la nominación abierta; al acabar, empieza la votación.
   * Una vez arrancada no se puede volver a pulsar (para eso está reiniciarVotacion).
   */
  'narrador:cuentaAtras': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.nominaciones.nominacion()?.cuentaAtrasFin === null && !partida.nominaciones.hayVotacion(),
    noPuede: ({ partida }) =>
      partida.nominaciones.hayVotacion()
        ? 'Esta nominación ya se ha votado.'
        : partida.nominaciones.votacionEnMarcha()
          ? 'La cuenta atrás ya está en marcha.'
          : 'No hay ninguna nominación abierta.',
    hacer: (juego) => {
      const { partida } = juego;
      partida.nominaciones.iniciarCuentaAtras(Date.now());
      return { ok: true };
    },
  },

  /** Para la cuenta atrás o la votación en marcha y deja la nominación como recién abierta. */
  'narrador:reiniciarVotacion': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.nominaciones.votacionEnMarcha(),
    noPuede: 'No hay ninguna votación en marcha.',
    hacer: (juego) => {
      const { partida } = juego;
      partida.nominaciones.reiniciarVotacion();
      return { ok: true };
    },
  },

  /**
   * Pone o quita la calavera a la ficha de un asiento (solo una puede llevarla).
   * Desde el panel de la nominación, además la cierra; desde el menú de la ficha
   * no (cerrarNominacion: false). datos: { jugadorId, marcado: boolean, cerrarNominacion?: boolean }.
   */
  'narrador:marcar': {
    // De noche no se marca a nadie: la calavera es de las ejecuciones del día
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.fases.actual().momento !== 'noche' && partida.plaza().length > 0,
    noPuede: ({ partida }, yo) =>
      yo.rol !== 'narrador'
        ? 'Solo un narrador puede marcar una ficha.'
        : partida.fases.actual().momento === 'noche'
          ? 'De noche no se marca a nadie.'
          : 'La plaza no tiene asientos.',
    hacer: (juego, _yo, datos) => {
      const { sala, partida } = juego;
      const { jugadorId, marcado, cerrarNominacion } =
        (datos as { jugadorId?: unknown; marcado?: unknown; cerrarNominacion?: unknown }) ?? {};
      if (typeof jugadorId !== 'string' || !sala.jugador(jugadorId)) return { ok: false, error: 'Ese asiento ya no existe.' };
      if (typeof marcado !== 'boolean') return { ok: false, error: 'Estado desconocido.' };
      // Si se marca al nominado de una nominación ya votada, se guardan sus votos
      // (el narrador los ve, para saber si otra votación empata).
      const n = partida.nominaciones.nominacion();
      const votos = n?.votacion?.terminada && n.hasta === jugadorId ? n.votacion.votos : null;
      partida.grimorio.marcar(jugadorId, marcado, votos);
      if (cerrarNominacion !== false) partida.nominaciones.cerrarNominacion();
      return { ok: true };
    },
  },

  /** Quita la calavera a quien la lleve (desde el panel de la nominación) y, como marcar, cierra la nominación. */
  'narrador:desmarcar': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.grimorio.hayMarca(),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'Nadie lleva la calavera.' : 'Solo un narrador puede desmarcar.'),
    hacer: (juego) => {
      const { partida } = juego;
      partida.grimorio.desmarcar();
      partida.nominaciones.cerrarNominacion();
      return { ok: true };
    },
  },

  /**
   * Ejecuta al que lleva la calavera: muere, se le ponen los recordatorios de los
   * personajes que funcionan con las ejecuciones y anochece (salvo con el Carnicero
   * vivo). Ver Partida.ejecutar. datos: { jugadorId }.
   */
  'narrador:ejecutar': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.grimorio.hayMarca(),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'Nadie lleva la calavera.' : 'Solo un narrador puede ejecutar.'),
    hacer: ({ partida }, _yo, datos) => {
      const r = partida.ejecutarConCalavera(cadena((datos as { jugadorId?: unknown } | null)?.jugadorId));
      if ('error' in r) return { ok: false, error: r.error };
      // Si quedan dos vivos, no anochece: el narrador elige (valor «final») entre la noche y revelar el grimorio
      return r.final ? { ok: true, valor: 'final' } : { ok: true };
    },
  },
};
