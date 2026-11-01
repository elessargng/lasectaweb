import { MENSAJES_PRIVADOS, type MensajesPrivados } from '../../../models/compartido/chat';
import { SALA_SEGUNDOS_POR_FICHA, type Configuracion } from '../../../models/partida/Configuracion';
import { NPC_BOOTLEGGER, NPC_SILENCIO, NPC_STORMCATCHER } from '../../../models/partida/personajesEspeciales';
import { TIPOS_NPC, type TipoPersonaje } from '../../../models/guiones';
import { GuionInvalidoError } from '../../../models/guiones/errores';
import { type Accion, cadena, esNarrador } from './Accion';

/** Los bytes de una imagen en data URL (data:image/…;base64,…), o null si no lo es. */
function datosDeDataUrl(valor: unknown): Buffer | null {
  if (typeof valor !== 'string') return null;
  const partes = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(valor);
  return partes ? Buffer.from(partes[2], 'base64') : null;
}

/** La preparación de la partida: ajustes, guion, fondo, NPCs, bolsa y reparto. */
export const ACCIONES_PREPARACION: Record<string, Accion> = {
  /**
   * Ajustes de la partida (Preferencias > Partida). datos: cualquiera de
   * { grimorioJugadores: boolean, segundosPorFicha: número de 0,25 en 0,25,
   *   mensajes: 'ninguno' | 'vecinos' | 'todos' (mensajes privados entre jugadores),
   *   ocultarCamarasConversacion: boolean }.
   * (La cuenta atrás no se configura: siempre es de 3 a 0.)
   */
  'narrador:configurarPartida': {
    puede: esNarrador,
    noPuede: 'Solo un narrador puede cambiar los ajustes de la partida.',
    hacer: (juego, _yo, datos) => {
      const { partida, narrador } = juego;
      const { grimorioJugadores, segundosPorFicha, mensajes, ocultarCamarasConversacion } = (datos as Record<string, unknown>) ?? {};
      const cambios: Parameters<Configuracion['cambiar']>[0] = {};
      if (grimorioJugadores !== undefined) {
        if (typeof grimorioJugadores !== 'boolean') return { ok: false, error: 'Ajuste desconocido.' };
        // Con narrador virtual, los jugadores siempre tienen su grimorio
        if (!grimorioJugadores && narrador.actual()) return { ok: false, error: 'Con narrador virtual, los jugadores siempre tienen su grimorio.' };
        cambios.grimorioJugadores = grimorioJugadores;
      }
      if (segundosPorFicha !== undefined) {
        const { min, max, paso } = SALA_SEGUNDOS_POR_FICHA;
        const segundos = segundosPorFicha as number;
        if (typeof segundos !== 'number' || segundos < min || segundos > max || !Number.isInteger(segundos / paso)) {
          const es = (n: number) => n.toLocaleString('es');
          return {
            ok: false,
            error: `La velocidad de las agujas tiene que ser de ${es(min)} a ${es(max)} segundos, de ${es(paso)} en ${es(paso)}.`,
          };
        }
        cambios.segundosPorFicha = segundos;
      }
      if (mensajes !== undefined) {
        if (!MENSAJES_PRIVADOS.includes(mensajes as MensajesPrivados)) return { ok: false, error: 'Ajuste desconocido.' };
        cambios.mensajes = mensajes as MensajesPrivados;
      }
      if (ocultarCamarasConversacion !== undefined) {
        if (typeof ocultarCamarasConversacion !== 'boolean') return { ok: false, error: 'Ajuste desconocido.' };
        cambios.ocultarCamarasConversacion = ocultarCamarasConversacion;
      }
      if (Object.keys(cambios).length === 0) return { ok: false, error: 'Ajuste desconocido.' };
      partida.configuracion.cambiar(cambios);
      return { ok: true };
    },
  },

  /** Abre o cierra las conversaciones privadas (al cerrarlas se terminan). datos: { abiertos: boolean }. */
  'narrador:privados': {
    puede: esNarrador,
    noPuede: 'Solo un narrador abre o cierra los privados.',
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const abiertos = (datos as { abiertos?: unknown } | null)?.abiertos;
      if (typeof abiertos !== 'boolean') return { ok: false, error: 'Estado desconocido.' };
      partida.configuracion.permitirPrivados(abiertos);
      return { ok: true };
    },
  },

  /**
   * Carga un guion en la sala: uno por defecto o uno importado de un JSON, que
   * interpreta y resuelve GuionService. datos: { predeterminado: id } o
   * { json: texto del archivo, archivo?: su nombre }.
   */
  'narrador:cambiarGuion': {
    puede: esNarrador,
    noPuede: 'Solo un narrador puede cambiar el guion.',
    hacer: async (juego, _yo, datos, { guiones }) => {
      const { partida } = juego;
      const { predeterminado, json, archivo } = (datos as Record<string, unknown>) ?? {};
      try {
        const guion =
          typeof predeterminado === 'string'
            ? await guiones.guionPredeterminado(predeterminado)
            : await guiones.importar(json, typeof archivo === 'string' ? archivo : undefined);
        partida.cambiarGuion(guion);
        // Si el guion trae su imagen de fondo, es la de la sala (luego se puede cambiar)
        if (guion.fondo) partida.configuracion.cambiar({ fondo: guion.fondo });
        return { ok: true };
      } catch (e) {
        // Un guion inválido trae un mensaje para quien lo carga; cualquier otro fallo, no.
        if (e instanceof GuionInvalidoError) return { ok: false, error: e.message };
        console.error('[Sala] Error al cargar un guion:', e);
        return { ok: false, error: 'No se pudo cargar el guion. Inténtalo de nuevo.' };
      }
    },
  },

  /**
   * Cambia el fondo de la sala (para todos). datos: { predeterminado: true }
   * (el de por defecto), { imagen: data URL } (subida desde el ordenador) o
   * { biblioteca: id de la versión de una imagen pública de la Biblioteca } (se
   * copia). De la Biblioteca solo vale lo público, aunque el narrador tenga cuenta:
   * lo que pide registro no se puede poner a la vista de toda la partida.
   */
  'narrador:cambiarFondo': {
    puede: esNarrador,
    noPuede: 'Solo un narrador puede cambiar el fondo de la sala.',
    hacer: async (juego, _yo, datos, deps) => {
      const { partida } = juego;
      const { predeterminado, imagen, biblioteca } = (datos as Record<string, unknown>) ?? {};
      if (predeterminado === true) {
        partida.configuracion.cambiar({ fondo: null });
        return { ok: true };
      }
      let bytes: Buffer | null = null;
      if (imagen !== undefined) {
        bytes = datosDeDataUrl(imagen);
        if (!bytes) return { ok: false, error: 'La imagen no es válida (JPEG, PNG o WebP).' };
      } else if (typeof biblioteca === 'string') {
        try {
          bytes = await deps.imagenesBiblioteca.leerPublica(biblioteca);
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : 'No se ha podido leer la imagen.' };
        }
      } else {
        return { ok: false, error: 'Fondo desconocido.' };
      }
      const guardado = deps.imagenes.guardarFondo(bytes);
      if ('error' in guardado) return { ok: false, error: guardado.error };
      partida.configuracion.cambiar({ fondo: guardado.ruta });
      return { ok: true, valor: guardado.ruta };
    },
  },

  /**
   * Pone en juego un NPC (un legendario o un lórico, del guion o del catálogo), o
   * lo quita si ya estaba. Lo ven todos. datos: { personajeId }.
   */
  'narrador:npc': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && !!partida.guion.actual(),
    noPuede: (_sala, yo) => (yo.rol !== 'narrador' ? 'Solo un narrador pone NPCs en juego.' : 'Antes hay que elegir un guion.'),
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const personajeId = (datos as { personajeId?: unknown } | null)?.personajeId;
      const personaje = typeof personajeId === 'string' ? partida.guion.personaje(personajeId) : undefined;
      if (!personaje) return { ok: false, error: 'Ese personaje no existe.' };
      if (!TIPOS_NPC.includes(personaje.tipo as TipoPersonaje)) {
        return { ok: false, error: 'Como NPC solo van legendarios y lóricos.' };
      }
      partida.alternarNpc(personaje.id);
      return { ok: true };
    },
  },

  /**
   * Las reglas del Bootlegger (con él en juego): una por elemento; null o vacío
   * vuelve a las del guion. datos: { reglas: string[] | null }.
   */
  'narrador:bootlegger': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.npcs.activo(NPC_BOOTLEGGER),
    noPuede: 'Solo un narrador, con el Bootlegger en juego, escribe sus reglas.',
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const reglas = (datos as { reglas?: unknown } | null)?.reglas;
      if (reglas !== null && !Array.isArray(reglas)) return { ok: false, error: 'Reglas desconocidas.' };
      const limpias = (reglas ?? [])
        .filter((r): r is string => typeof r === 'string')
        .map((r) => r.replace(/\s+/g, ' ').trim().slice(0, 600))
        .filter(Boolean)
        .slice(0, 20);
      partida.npcs.escribirBootlegger(reglas === null ? null : limpias);
      return { ok: true };
    },
  },

  /**
   * El personaje bueno que nombra el Storm Catcher (con él en juego), o null.
   * datos: { personajeId: string | null }.
   */
  'narrador:stormcatcher': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.npcs.activo(NPC_STORMCATCHER),
    noPuede: 'Solo un narrador, con el Storm Catcher en juego, nombra su personaje.',
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const personajeId = (datos as { personajeId?: unknown } | null)?.personajeId;
      if (personajeId === null) {
        partida.npcs.nombrarStormcatcher(null);
        return { ok: true };
      }
      const personaje = typeof personajeId === 'string' ? partida.guion.personaje(personajeId) : undefined;
      if (!personaje || (personaje.tipo !== 'townsfolk' && personaje.tipo !== 'outsider')) {
        return { ok: false, error: 'El Storm Catcher nombra un personaje bueno (aldeano o forastero).' };
      }
      partida.npcs.nombrarStormcatcher(personaje.id);
      return { ok: true };
    },
  },

  /**
   * Pide silencio a todos (o lo levanta): los jugadores no pueden emitir su
   * micrófono. Solo con el Bibliotecario del Infierno en juego. datos: { activo }.
   */
  'narrador:silencio': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.npcs.npcs().includes(NPC_SILENCIO),
    noPuede: (_sala, yo) =>
      yo.rol !== 'narrador' ? 'Solo un narrador pide silencio.' : 'Solo se pide silencio con el Bibliotecario del Infierno en juego.',
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const activo = (datos as { activo?: unknown } | null)?.activo;
      if (typeof activo !== 'boolean') return { ok: false, error: 'Petición desconocida.' };
      partida.npcs.pedirSilencio(activo);
      return { ok: true };
    },
  },

  /**
   * Mete en la bolsa un personaje del guion (aldeano, forastero, esbirro o
   * demonio), o lo saca si ya estaba. No se limita cuántos: lo decide el narrador.
   * datos: { personajeId }.
   */
  'narrador:bolsa': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && !!partida.guion.actual(),
    noPuede: (sala, yo) => (yo.rol !== 'narrador' ? 'Solo un narrador puede preparar la bolsa.' : 'Antes hay que elegir un guion.'),
    hacer: ({ partida }, _yo, datos) => {
      const error = partida.reparto.meterOSacar(cadena((datos as { personajeId?: unknown } | null)?.personajeId));
      return error ? { ok: false, error } : { ok: true };
    },
  },

  /**
   * Cuántas fichas de un personaje hay en la bolsa (0 la saca). Más de una, solo
   * si puede repetirse (ver Reparto.ponerEnBolsa).
   * datos: { personajeId, cantidad }.
   */
  'narrador:bolsaCantidad': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && !!partida.guion.actual(),
    noPuede: (_sala, yo) => (yo.rol !== 'narrador' ? 'Solo un narrador puede preparar la bolsa.' : 'Antes hay que elegir un guion.'),
    hacer: ({ partida }, _yo, datos) => {
      const { personajeId, cantidad } = (datos as { personajeId?: unknown; cantidad?: unknown } | null) ?? {};
      const error = partida.reparto.ponerEnBolsa(cadena(personajeId), typeof cantidad === 'number' ? cantidad : NaN);
      return error ? { ok: false, error } : { ok: true };
    },
  },

  /** Vacía la bolsa: saca todos los personajes (también los viajeros). */
  'narrador:vaciarBolsa': {
    puede: esNarrador,
    noPuede: 'Solo un narrador puede preparar la bolsa.',
    hacer: (juego) => {
      const { partida } = juego;
      partida.reparto.bolsa.vaciar();
      return { ok: true };
    },
  },

  /**
   * Llena la bolsa de una vez (el narrador la ha llenado al azar): sustituye sus
   * aldeanos, forasteros, esbirros y demonios por estos; los viajeros se quedan.
   * Repetidos, solo los que pueden (ver Reparto.llenarBolsa). datos: { personajes: string[] }.
   */
  'narrador:llenarBolsa': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && !!partida.guion.actual(),
    noPuede: (_sala, yo) => (yo.rol !== 'narrador' ? 'Solo un narrador puede preparar la bolsa.' : 'Antes hay que elegir un guion.'),
    hacer: ({ partida }, _yo, datos) => {
      const ids = (datos as { personajes?: unknown } | null)?.personajes;
      if (!Array.isArray(ids) || ids.length > 100 || ids.some((id) => typeof id !== 'string')) {
        return { ok: false, error: 'Personajes desconocidos.' };
      }
      const error = partida.reparto.llenarBolsa(ids as string[]);
      return error ? { ok: false, error } : { ok: true };
    },
  },

  /**
   * Da por bueno el reparto aunque no cuadre con las reglas (el narrador se sale del
   * guion a propósito), o deja de darlo (null). datos: { firma: string | null }.
   */
  'narrador:aceptarSetup': {
    puede: esNarrador,
    noPuede: 'Solo un narrador da por bueno el reparto.',
    hacer: (juego, _yo, datos) => {
      const { partida } = juego;
      const firma = (datos as { firma?: unknown } | null)?.firma;
      if (firma !== null && (typeof firma !== 'string' || firma.length > 100)) return { ok: false, error: 'Reparto desconocido.' };
      partida.reparto.aceptarSetup(firma);
      return { ok: true };
    },
  },

  /**
   * Reparte al azar los personajes de la bolsa entre los asientos que no llevan
   * viajero. Solo en la preparación y si hay en la bolsa tantos como esos asientos.
   */
  'narrador:asignarPersonajes': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && !!partida.guion.actual() && partida.fases.actual().momento === 'preparacion',
    noPuede: ({ partida }, yo) =>
      yo.rol !== 'narrador'
        ? 'Solo un narrador puede repartir los personajes.'
        : !partida.guion.actual()
          ? 'Antes hay que elegir un guion.'
          : 'Los personajes solo se asignan en la preparación.',
    hacer: ({ partida }) => {
      const error = partida.repartirPersonajes();
      return error ? { ok: false, error } : { ok: true };
    },
  },

  /** Con el Gardener: entrega a los jugadores los personajes ya repartidos. */
  'narrador:entregarFichas': {
    puede: ({ partida }, yo) => yo.rol === 'narrador' && partida.entregas.fichasRetenidas(),
    noPuede: 'No hay personajes por entregar.',
    hacer: (juego) => {
      // Lo que hay ahora en las fichas (el narrador puede haberlas cambiado tras repartir)
      const { partida } = juego;
      partida.entregas.entregarFichas();
      return { ok: true };
    },
  },
};
