import type { SalaDeJuego } from '../../../models/SalaDeJuego';
import { ADJUNTOS_DESPERTAR, FICHAS_DESPERTAR, FICHAS_RESPUESTA_GUIADA, TARJETAS_DESPERTAR, type FichaDespertar, type EnvioDespertar, type TarjetaDespertar } from '../../../models/compartido/despertar';
import { errorDeEleccion } from '../../../models/partida/DespertarGuiado';
import type { Accion } from './Accion';

/** Largo máximo del texto «Personalizado» al despertar. */
export const SALA_TEXTO_DESPERTAR_MAX = 200;

/**
 * Comprueba un mensaje para los despiertos: una ficha (o, si lo manda el
 * narrador, una tarjeta) con justo lo que lleva. Devuelve el mensaje limpio o el error.
 */
function leerMensajeDespertar(
  juego: SalaDeJuego,
  datos: unknown,
  conTarjetas: boolean,
): { error: string } | EnvioDespertar {
  const { sala, partida } = juego;
  const { ficha, tarjeta, jugadores, personajes, texto, alineamiento } =
    (datos as {
      ficha?: unknown;
      tarjeta?: unknown;
      jugadores?: unknown;
      personajes?: unknown;
      texto?: unknown;
      alineamiento?: unknown;
    } | null) ?? {};
  const esFicha = typeof ficha === 'string' && (FICHAS_DESPERTAR as readonly string[]).includes(ficha);
  const esTarjeta = conTarjetas && typeof tarjeta === 'string' && (TARJETAS_DESPERTAR as readonly string[]).includes(tarjeta);
  if (esFicha === esTarjeta) return { error: 'Mensaje desconocido.' };
  const clave = (esFicha ? ficha : tarjeta) as FichaDespertar | TarjetaDespertar;
  const adjunto = ADJUNTOS_DESPERTAR[clave] ?? {};

  const ids = (valor: unknown): string[] | null =>
    Array.isArray(valor) && valor.every((v) => typeof v === 'string') ? [...new Set(valor as string[])] : null;
  const asientos = adjunto.jugadores ? ids(jugadores) : [];
  if (adjunto.jugadores && (!asientos?.length || asientos.some((a) => !sala.jugador(a)))) {
    return { error: 'Elige al menos un jugador.' };
  }
  const elegidos = adjunto.personajes ? ids(personajes) : [];
  if (adjunto.personajes && (!elegidos?.length || elegidos.some((id) => !partida.guion.personaje(id)))) {
    return { error: 'Elige al menos un personaje del guion.' };
  }
  const limpio = adjunto.texto && typeof texto === 'string' ? texto.replace(/\s+/g, ' ').trim().slice(0, SALA_TEXTO_DESPERTAR_MAX) : '';
  if (adjunto.texto && !limpio) return { error: 'Escribe el mensaje.' };
  const bando = adjunto.alineamiento && (alineamiento === 'bueno' || alineamiento === 'malvado') ? alineamiento : null;
  return {
    ficha: esFicha ? (ficha as FichaDespertar) : null,
    tarjeta: esTarjeta ? (tarjeta as TarjetaDespertar) : null,
    jugadores: asientos ?? [],
    personajes: elegidos ?? [],
    texto: adjunto.texto ? limpio : null,
    alineamiento: bando,
  };
}

/** A qué asientos manda el narrador: `jugadorIds` (sin repetir) o, si no, `jugadorId`. */
function asientosDelEnvio(datos: unknown): string[] {
  const { jugadorId, jugadorIds } = (datos as { jugadorId?: unknown; jugadorIds?: unknown } | null) ?? {};
  if (Array.isArray(jugadorIds)) return jugadorIds.every((id) => typeof id === 'string') ? [...new Set(jugadorIds as string[])] : [];
  return typeof jugadorId === 'string' ? [jugadorId] : [];
}

/** La noche: los despertares (también los guiados) y la estrella de cada fila. */
export const ACCIONES_NOCHE: Record<string, Accion> = {
  /**
   * Abre de noche el despertar de un asiento (también de uno libre: cuenta como un
   * jugador más), para mandarle información y que conteste. Se pueden tener
   * varios a la vez; si ya lo tiene, no hace nada. El jugador no se entera hasta
   * que el narrador le manda algo (ver Despertares.asientoDespiertoDe). datos: { jugadorId }.
   */
  'narrador:despertar': {
    // De día, solo el narrador virtual con el Violinista (el demonio elige en secreto)
    puede: ({ partida, narrador }, yo) => yo.rol === 'narrador' && (partida.fases.actual().momento === 'noche' || narrador.actual()?.etapa === 'violinista'),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'Solo se despierta a alguien de noche.' : 'Solo un narrador puede despertar a alguien.'),
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const jugadorId = (datos as { jugadorId?: unknown } | null)?.jugadorId;
      if (typeof jugadorId !== 'string') return { ok: false, error: 'Ese asiento ya no existe.' };
      const error = partida.despertares.despertar(jugadorId);
      return error ? { ok: false, error } : { ok: true };
    },
  },

  /**
   * Un mensaje en un despertar: el narrador manda una ficha o una tarjeta al de un
   * asiento (o lo mismo a varios: `jugadorIds`, y de noche se despierta a los que aún
   * no lo estaban); el jugador, solo fichas al narrador (en el suyo). datos: {
   * jugadorId | jugadorIds (solo el narrador), ficha | tarjeta, jugadores?:
   * jugadorId[], personajes?: id[], texto?, alineamiento? } (según lo que lleve).
   */
  'despertar:enviar': {
    puede: ({ partida }, yo) =>
      yo.rol === 'narrador' ? partida.despertares.despertares().length > 0 : yo.rol === 'jugador' && !!partida.despertares.asientoDespiertoDe(yo.id),
    noPuede: 'No tienes ningún despertar abierto.',
    hacer: (juego, yo, datos) => {
      const { sala, partida } = juego;
      const narra = yo.rol === 'narrador';
      const jugadorIds = narra ? asientosDelEnvio(datos) : [partida.despertares.asientoDespiertoDe(yo.id)].filter((id): id is string => !!id);
      if (!jugadorIds.length || jugadorIds.some((id) => !sala.jugador(id))) return { ok: false, error: 'Ese despertar ya no está abierto.' };
      // A uno solo, en su despertar; a varios, también a los que aún no están despiertos (de noche)
      const despiertaMas = jugadorIds.length > 1 && partida.fases.actual().momento === 'noche';
      if (!despiertaMas && jugadorIds.some((id) => !partida.despertares.hayDespertar(id))) return { ok: false, error: 'Ese despertar ya no está abierto.' };
      const mensaje = leerMensajeDespertar(juego, datos, narra);
      if ('error' in mensaje) return { ok: false, error: mensaje.error };
      // Si su habilidad le ha pedido que elija (el despertar guiado), solo contesta con
      // quienes elige. Por un asiento libre (cuenta como un jugador) elige el narrador.
      const destinos = jugadorIds.map((jugadorId) => {
        const libre = !partida.plaza().find((a) => a.id === jugadorId)?.participanteId;
        const pide = !narra || libre ? partida.guiado.eleccionPendiente(jugadorId) : null;
        return { jugadorId, pide, eligiendo: !!pide && (!narra || mensaje.ficha === 'jugador') };
      });
      for (const { jugadorId, pide, eligiendo } of destinos) {
        if (pide && eligiendo) {
          const error = errorDeEleccion(pide, mensaje, jugadorId);
          if (error) return { ok: false, error };
        }
        // A lo demás del despertar guiado, el jugador solo contesta «Entendido» o con un texto
        if (!narra && !pide && partida.despertares.respuestaGuiada(jugadorId) && !(mensaje.ficha && FICHAS_RESPUESTA_GUIADA.includes(mensaje.ficha))) {
          return { ok: false, error: 'Contesta «Entendido» o escribe un mensaje al narrador.' };
        }
      }
      for (const { jugadorId, eligiendo } of destinos) {
        if (!partida.despertares.hayDespertar(jugadorId)) partida.despertares.despertar(jugadorId);
        // «Tú eres»: su ficha pasa a ser la que se le dice (con alineamiento, solo si se le dice)
        // Lo que escribe el narrador virtual en un despertar guiado (que diga «Entendido»)
        // lo sigue siendo: el jugador sigue contestando solo «Entendido» o un texto
        if (narra) partida.mandarDelNarrador(jugadorId, mensaje, { guiado: yo.persona.tipo === 'virtual' && partida.despertares.respuestaGuiada(jugadorId) });
        else partida.despertares.enviar(jugadorId, { ...mensaje, autor: jugadorId });
        if (eligiendo) partida.guiado.alElegir(jugadorId, mensaje.jugadores);
        // Entendido lo anterior (lo dice el jugador, o el narrador a lo que eligió): le llega lo siguiente de su cola
        if (mensaje.ficha === 'entendido') partida.guiado.alEntender(jugadorId);
      }
      return { ok: true };
    },
  },

  /**
   * El despertar guiado (ver HabilidadNoche): despierta al de una fila del orden
   * de noche según su habilidad, si está listo. datos: { personajeId }.
   */
  'narrador:despertarHabilidad': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.fases.actual().momento === 'noche',
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'Solo se despierta a alguien de noche.' : 'Solo un narrador puede despertar a alguien.'),
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const personajeId = (datos as { personajeId?: unknown } | null)?.personajeId;
      if (typeof personajeId !== 'string') return { ok: false, error: 'Ese personaje no se despierta solo.' };
      const error = partida.guiado.despertar(personajeId);
      return error ? { ok: false, error } : { ok: true };
    },
  },

  /**
   * El despertar guiado, revisado: el narrador manda lo que ha decidido (una de las
   * opciones, o cambiada) al de una fila que había que revisar. datos: { personajeId,
   * ficha | tarjeta, jugadores?, personajes?, texto?, alineamiento? }.
   */
  'narrador:resolverHabilidad': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.fases.actual().momento === 'noche',
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'Solo se despierta a alguien de noche.' : 'Solo un narrador puede despertar a alguien.'),
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const personajeId = (datos as { personajeId?: unknown } | null)?.personajeId;
      if (typeof personajeId !== 'string') return { ok: false, error: 'Ese personaje no se despierta solo.' };
      const mensaje = leerMensajeDespertar(juego, datos, true);
      if ('error' in mensaje) return { ok: false, error: mensaje.error };
      const error = partida.guiado.resolver(personajeId, mensaje);
      return error ? { ok: false, error } : { ok: true };
    },
  },

  /** El Imp se ha elegido a sí mismo: el narrador dice quién es el nuevo. datos: { jugadorId }. */
  'narrador:nuevoImp': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && !!partida.guiado.nuevoImp(),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'No hay que elegir un nuevo Imp.' : 'Solo un narrador elige al nuevo Imp.'),
    hacer: (juego, _yo, datos) => {
      const { sala, partida } = juego;
      const jugadorId = (datos as { jugadorId?: unknown } | null)?.jugadorId;
      if (typeof jugadorId !== 'string' || !sala.jugador(jugadorId)) return { ok: false, error: 'Ese asiento ya no existe.' };
      const error = partida.guiado.elegirNuevoImp(jugadorId);
      return error ? { ok: false, error } : { ok: true };
    },
  },

  /**
   * Pone o quita la ficha recordatorio (estrella) de una fila del orden de noche,
   * para todos los narradores. datos: { id: personaje del guion | 'esbirros' | 'demonios', activo }.
   */
  'narrador:recordatorio': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && !!partida.guion.actual(),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'Aún no hay guion.' : 'Solo un narrador puede cambiar los recordatorios.'),
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const { id, activo } = (datos as { id?: unknown; activo?: unknown } | null) ?? {};
      // sala.personaje también encuentra viajeros y NPCs, que no van en guion.personajes
      const valido = typeof id === 'string' && (id === 'esbirros' || id === 'demonios' || !!partida.guion.personaje(id));
      if (!valido) return { ok: false, error: 'Ese personaje no está en el guion.' };
      if (typeof activo !== 'boolean') return { ok: false, error: 'Estado desconocido.' };
      partida.cambiarRecordatorio(id, activo);
      return { ok: true };
    },
  },
};
