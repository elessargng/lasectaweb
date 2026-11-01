import { randomUUID } from 'crypto';
import { SALA_ASIENTOS } from '../../../models/sala/Sala';
import { NPC_FERRYMAN, NPC_GARDENER } from '../../../models/partida/personajesEspeciales';
import { RECORDATORIO_TEXTO, SALA_NOTA_LARGO_MAX, SALA_RECORDATORIO_TEXTO_MAX } from '../../../models/compartido/grimorio';
import { MAX_RECORDATORIOS } from '../../../models/partida/Grimorio';
import type { FichaEnviada } from '../../../models/partida/Entregas';
import { NUM_FAROLES } from '../../../models/compartido/jugador';
import { type Accion, esNarrador, cadena } from './Accion';

/** El grimorio: fichas, vida, votos, recordatorios, notas y enviarlo a un jugador. */
export const ACCIONES_GRIMORIO: Record<string, Accion> = {
  /**
   * Pone un personaje del guion en la ficha de un asiento (aldeanos, forasteros,
   * esbirros, demonios o viajeros), o se lo quita. datos: { jugadorId, personajeId: string | null }.
   */
  'narrador:cambiarPersonaje': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.plaza().length > 0,
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'La plaza no tiene asientos.' : 'Solo un narrador puede cambiar las fichas.'),
    hacer: ({ partida }, _yo, datos) => {
      const { jugadorId, personajeId } = (datos as { jugadorId?: unknown; personajeId?: unknown }) ?? {};
      const error = partida.grimorio.elegirPersonaje(cadena(jugadorId), personajeId === null ? null : cadena(personajeId));
      return error ? { ok: false, error } : { ok: true };
    },
  },

  /**
   * Con el Gardener: intercambia el personaje y el alineamiento de dos fichas
   * (arrastrando una sobre otra), mientras los personajes repartidos no se hayan
   * entregado: al entregarlos, se acaba. datos: { desde, hasta } (ids de asiento).
   */
  'narrador:intercambiarFichas': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.npcs.activo(NPC_GARDENER) && partida.entregas.fichasRetenidas() && partida.plaza().length > 1,
    noPuede: ({ partida }, yo) =>
      yo.rol !== 'narrador'
        ? 'Solo un narrador puede intercambiar las fichas.'
        : !partida.npcs.activo(NPC_GARDENER)
          ? 'Las fichas solo se intercambian con el Gardener en juego.'
          : !partida.entregas.fichasRetenidas()
            ? 'Los personajes ya se han entregado: ya no se intercambian.'
            : 'Hacen falta dos asientos.',
    hacer: (juego, _yo, datos) => {
      const { sala, partida } = juego;
      const { desde, hasta } = (datos as { desde?: unknown; hasta?: unknown }) ?? {};
      if (typeof desde !== 'string' || typeof hasta !== 'string' || !sala.jugador(desde) || !sala.jugador(hasta)) {
        return { ok: false, error: 'Ese asiento ya no existe.' };
      }
      if (desde === hasta) return { ok: false, error: 'Elige otra ficha.' };
      partida.grimorio.intercambiarFichas(desde, hasta);
      return { ok: true };
    },
  },

  /** Cambia el alineamiento de la ficha de un asiento. datos: { jugadorId, alineamiento: 'bueno' | 'malvado' }. */
  'narrador:cambiarAlineamiento': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.plaza().length > 0,
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'La plaza no tiene asientos.' : 'Solo un narrador puede cambiar las fichas.'),
    hacer: (juego, _yo, datos) => {
      const { sala, partida } = juego;
      const { jugadorId, alineamiento } = (datos as { jugadorId?: unknown; alineamiento?: unknown }) ?? {};
      if (typeof jugadorId !== 'string' || !sala.jugador(jugadorId)) return { ok: false, error: 'Ese asiento ya no existe.' };
      if (alineamiento !== 'bueno' && alineamiento !== 'malvado') return { ok: false, error: 'Alineamiento desconocido.' };
      if (!partida.plaza().find((a) => a.id === jugadorId)?.personaje) {
        return { ok: false, error: 'Esa ficha no tiene personaje.' };
      }
      partida.grimorio.cambiarAlineamiento(jugadorId, alineamiento);
      return { ok: true };
    },
  },

  /**
   * Mata o revive la ficha de un asiento (haya alguien sentado o no). De noche, matar
   * deja la muerte pendiente (ver Grimorio.cambiarVida). datos: { jugadorId, muerto: boolean }.
   */
  'narrador:cambiarVida': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.plaza().length > 0,
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'La plaza no tiene asientos.' : 'Solo un narrador puede matar o revivir.'),
    hacer: (juego, _yo, datos) => {
      const { sala, partida } = juego;
      const { jugadorId, muerto } = (datos as { jugadorId?: unknown; muerto?: unknown }) ?? {};
      if (typeof jugadorId !== 'string' || !sala.jugador(jugadorId)) return { ok: false, error: 'Ese asiento ya no existe.' };
      if (typeof muerto !== 'boolean') return { ok: false, error: 'Estado desconocido.' };
      partida.grimorio.cambiarVida(jugadorId, muerto);
      return { ok: true };
    },
  },

  /**
   * Hace efectiva la muerte pendiente de un asiento (la de la noche): el narrador la
   * anuncia y ya la ven todos. datos: { jugadorId }.
   */
  'narrador:confirmarMuerte': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.plaza().some((a) => a.muertePendiente),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'No hay ninguna muerte por anunciar.' : 'Solo un narrador puede anunciar una muerte.'),
    hacer: (juego, _yo, datos) => {
      const { sala, partida } = juego;
      const jugadorId = (datos as { jugadorId?: unknown } | null)?.jugadorId;
      if (typeof jugadorId !== 'string' || !sala.jugador(jugadorId)) return { ok: false, error: 'Ese asiento ya no existe.' };
      if (!partida.grimorio.confirmarMuerte(jugadorId)) return { ok: false, error: 'Esa ficha no tiene una muerte por anunciar.' };
      return { ok: true };
    },
  },

  /**
   * Quita o devuelve a mano el voto de un muerto (el que le queda): se apaga o se
   * enciende su vela. datos: { jugadorId, gastado: boolean }.
   */
  'narrador:cambiarVoto': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.plaza().some((a) => a.muerto),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'No hay ningún muerto.' : 'Solo un narrador quita o devuelve votos.'),
    hacer: (juego, _yo, datos) => {
      const { sala, partida } = juego;
      const { jugadorId, gastado } = (datos as { jugadorId?: unknown; gastado?: unknown }) ?? {};
      if (typeof jugadorId !== 'string' || !sala.jugador(jugadorId)) return { ok: false, error: 'Ese asiento ya no existe.' };
      if (typeof gastado !== 'boolean') return { ok: false, error: 'Estado desconocido.' };
      if (!partida.grimorio.cambiarVoto(jugadorId, gastado)) return { ok: false, error: 'Solo los muertos tienen un voto que quitar o devolver.' };
      return { ok: true };
    },
  },

  /** El Barquero (con él en juego): todos los muertos recuperan su voto. */
  'narrador:barquero': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.npcs.activo(NPC_FERRYMAN),
    noPuede: 'Solo un narrador, con el Barquero en juego, devuelve los votos a los muertos.',
    hacer: (juego) => {
      const { partida } = juego;
      if (partida.grimorio.devolverVotos() === 0) return { ok: false, error: 'Ningún muerto ha gastado su voto.' };
      return { ok: true };
    },
  },

  /**
   * Pone una ficha recordatorio junto a la de un asiento: uno de los recordatorios
   * de un personaje del guion (esté en juego o no). Cada una es única: si ya
   * estaba puesta (todas, si el personaje tiene varias iguales), se quita la de
   * antes (ver recordatorioQueSobra). datos: { jugadorId, personajeId, indice }.
   */
  'narrador:ponerRecordatorio': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.plaza().length > 0,
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'La plaza no tiene asientos.' : 'Solo un narrador pone recordatorios.'),
    hacer: ({ partida }, _yo, datos) => {
      const { jugadorId, personajeId, indice } = (datos as { jugadorId?: unknown; personajeId?: unknown; indice?: unknown }) ?? {};
      const error = partida.grimorio.elegirRecordatorio(cadena(jugadorId), cadena(personajeId), typeof indice === 'number' ? indice : NaN);
      return error ? { ok: false, error } : { ok: true };
    },
  },

  /**
   * Pone un recordatorio con texto propio (sin personaje): lo que escriba el
   * narrador, corto, porque va en redondo en una ficha pequeña. datos: { jugadorId, texto, icono? }.
   */
  'narrador:ponerRecordatorioTexto': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.plaza().length > 0,
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'La plaza no tiene asientos.' : 'Solo un narrador pone recordatorios.'),
    hacer: ({ partida }, _yo, datos) => {
      const { jugadorId, texto, icono } = (datos as { jugadorId?: unknown; texto?: unknown; icono?: unknown }) ?? {};
      const error = partida.grimorio.escribirRecordatorio(cadena(jugadorId), cadena(texto), icono);
      return error ? { ok: false, error } : { ok: true };
    },
  },

  /** Quita una ficha recordatorio. datos: { jugadorId, recordatorioId }. */
  'narrador:quitarRecordatorio': {
    puede: esNarrador,
    noPuede: 'Solo un narrador quita recordatorios.',
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const { jugadorId, recordatorioId } = (datos as { jugadorId?: unknown; recordatorioId?: unknown }) ?? {};
      if (typeof jugadorId !== 'string' || typeof recordatorioId !== 'string') return { ok: false, error: 'Petición desconocida.' };
      partida.grimorio.quitarRecordatorio(jugadorId, recordatorioId);
      return { ok: true };
    },
  },

  /**
   * Escribe la nota de un asiento (texto libre; sustituye la que hubiera).
   * datos: { jugadorId, texto }.
   */
  'narrador:escribirNota': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.plaza().length > 0,
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'La plaza no tiene asientos.' : 'Solo un narrador escribe notas.'),
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const { jugadorId, texto } = (datos as { jugadorId?: unknown; texto?: unknown }) ?? {};
      if (typeof jugadorId !== 'string') return { ok: false, error: 'Ese asiento ya no existe.' };
      // Se respetan los saltos de línea; solo se quitan los espacios de los extremos
      const limpio = typeof texto === 'string' ? texto.replace(/\r\n?/g, '\n').trim() : '';
      if (!limpio) return { ok: false, error: 'La nota está vacía.' };
      if (limpio.length > SALA_NOTA_LARGO_MAX) return { ok: false, error: `Una nota puede tener como mucho ${SALA_NOTA_LARGO_MAX} caracteres.` };
      return partida.grimorio.escribirNota(jugadorId, limpio) ? { ok: true } : { ok: false, error: 'Ese asiento ya no existe.' };
    },
  },

  /** Borra la nota de un asiento. datos: { jugadorId }. */
  'narrador:borrarNota': {
    puede: esNarrador,
    noPuede: 'Solo un narrador borra notas.',
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const { jugadorId } = (datos as { jugadorId?: unknown }) ?? {};
      if (typeof jugadorId !== 'string') return { ok: false, error: 'Petición desconocida.' };
      partida.grimorio.escribirNota(jugadorId, null);
      return { ok: true };
    },
  },

  /**
   * Envía un grimorio (el Espía, la Viuda) a quien se sienta en un asiento: una
   * copia del de la partida que el narrador puede haber cambiado. Se comprueba que
   * cada ficha sea de un asiento de la plaza y lleve personajes del guion.
   * datos: { jugadorId, fichas: FichaEnviadaDto[], faroles?: string[] }.
   */
  'narrador:enviarGrimorio': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.plaza().some((a) => a.participanteId),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'No hay nadie sentado.' : 'Solo un narrador envía el grimorio.'),
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const { jugadorId, fichas } = (datos as { jugadorId?: unknown; fichas?: unknown }) ?? {};
      const destino = partida.plaza().find((a) => a.id === jugadorId);
      if (!destino || typeof jugadorId !== 'string') return { ok: false, error: 'Ese asiento ya no existe.' };
      if (!destino.participanteId) return { ok: false, error: 'En ese asiento no hay nadie a quien enviárselo.' };
      if (!Array.isArray(fichas) || fichas.length > SALA_ASIENTOS.max) return { ok: false, error: 'El grimorio no es válido.' };
      const plaza = new Set(partida.plaza().map((a) => a.id));
      const limpias: FichaEnviada[] = [];
      for (const f of fichas as Record<string, unknown>[]) {
        if (!f || typeof f.jugadorId !== 'string' || !plaza.has(f.jugadorId)) return { ok: false, error: 'El grimorio no es válido.' };
        const personaje = f.personaje === null ? null : typeof f.personaje === 'string' && partida.guion.personaje(f.personaje) ? f.personaje : undefined;
        if (personaje === undefined) return { ok: false, error: 'Hay un personaje que no está en el guion.' };
        const alineamiento = f.alineamiento === 'bueno' || f.alineamiento === 'malvado' ? f.alineamiento : null;
        const recordatorios = Array.isArray(f.recordatorios) ? (f.recordatorios as Record<string, unknown>[]) : [];
        if (recordatorios.length > MAX_RECORDATORIOS) return { ok: false, error: 'Hay una ficha con demasiados recordatorios.' };
        const limpios = [];
        for (const r of recordatorios) {
          const texto = typeof r?.texto === 'string' ? r.texto.replace(/\s+/g, ' ').trim() : '';
          if (r?.personaje === RECORDATORIO_TEXTO) {
            if (!texto || [...texto].length > SALA_RECORDATORIO_TEXTO_MAX) return { ok: false, error: 'Hay un recordatorio con un texto no válido.' };
            const icono = partida.grimorio.iconoDeRecordatorio(r.icono);
            if (icono === undefined) return { ok: false, error: 'Hay un recordatorio con un icono que no está en el guion.' };
            limpios.push({ id: randomUUID(), personaje: RECORDATORIO_TEXTO, indice: -1, texto, ...(icono ? { icono } : {}) });
            continue;
          }
          const del = typeof r?.personaje === 'string' ? partida.guion.personaje(r.personaje) : undefined;
          const indice = typeof r?.indice === 'number' && Number.isInteger(r.indice) ? r.indice : -1;
          const original = del?.recordatorios[indice];
          if (!del || original === undefined) return { ok: false, error: 'Hay un recordatorio que no está en el guion.' };
          limpios.push({ id: randomUUID(), personaje: del.id, indice, texto: original });
        }
        limpias.push({ jugadorId: f.jugadorId, personaje, alineamiento, muerto: f.muerto === true, recordatorios: limpios });
      }
      // Los faroles del demonio (los que el narrador haya dejado en la copia)
      const faroles = (datos as { faroles?: unknown }).faroles ?? [];
      if (!Array.isArray(faroles) || faroles.length > NUM_FAROLES) return { ok: false, error: 'Los faroles no son válidos.' };
      if (faroles.some((id) => typeof id !== 'string' || !partida.guion.personaje(id))) return { ok: false, error: 'Hay un farol que no está en el guion.' };
      partida.entregas.enviarGrimorio(jugadorId, limpias, faroles as string[]);
      return { ok: true };
    },
  },
};
