import {
  limpiarAvatarSala,
  limpiarNombreSala,
  SALA_ASIENTOS,
  SALA_CUENTA_ATRAS,
  SALA_SEGUNDOS_POR_FICHA,
  SalaService,
} from '../services/SalaService';
import { SALA_FORMAS_MANO, SalaFormaMano, SalaParticipante } from '../types/sala';
import { guardarAvatarSala } from '../utils/salaAvatarStorage';

/** `valor`: lo que la acción devuelve a quien la pidió (p. ej. la ruta del avatar subido). */
export type SalaResultado = { ok: true; valor?: string } | { ok: false; error: string };

/** Lo que devuelve una acción: el resultado y, si saca a alguien de la sala, qué conexiones cerrar. */
export type SalaEfecto = SalaResultado & { expulsar?: string[] };

interface Accion {
  /** Si quien la pide puede hacerla ahora. Es la única comprobación de permisos. */
  puede: (sala: SalaService, yo: SalaParticipante) => boolean;
  /** Mensaje cuando no puede. */
  noPuede: string | ((sala: SalaService, yo: SalaParticipante) => string);
  /** La ejecuta; solo valida los datos que recibe, no los permisos. */
  hacer: (sala: SalaService, yo: SalaParticipante, datos: unknown) => SalaEfecto;
}

const cualquiera = () => true;
const esNarrador = (_sala: SalaService, yo: SalaParticipante) => yo.rol === 'narrador';

/**
 * Todo lo que se puede pedir a la sala, con quién puede pedirlo. Las del
 * narrador van con el prefijo `narrador:`.
 *
 * El socket comprueba `puede` antes de `hacer`, y a cada participante se le
 * manda la lista de las que puede usar en ese momento: el cliente pinta sus
 * botones a partir de ella, sin decidir permisos por su cuenta. Para añadir una
 * acción basta con añadirla aquí (y su botón en el cliente).
 */
export const SALA_ACCIONES: Record<string, Accion> = {
  /** datos: { nombre }. Vacío: vuelve al nombre de usuario (solo con cuenta). */
  'sala:cambiarNombre': {
    puede: cualquiera,
    noPuede: '',
    hacer: (sala, yo, datos) => {
      const pedido = limpiarNombreSala((datos as { nombre?: unknown } | null)?.nombre);
      const nombre = pedido || (yo.conCuenta ? sala.nombreBase(yo.id) : '');
      if (!nombre) return { ok: false, error: 'Escribe un nombre.' };
      if (sala.nombreOcupado(nombre, yo.id)) return { ok: false, error: `Ya hay alguien llamado ${nombre} en la sala.` };
      sala.renombrar(yo.id, nombre);
      return { ok: true };
    },
  },

  /**
   * datos: { avatar } uno de `SALA_AVATARES` o una imagen ya subida a la sala, o
   * null para el por defecto (el de su cuenta, o el logo si es invitado).
   */
  'sala:cambiarAvatar': {
    puede: cualquiera,
    noPuede: '',
    hacer: (sala, yo, datos) => {
      const pedido = (datos as { avatar?: unknown } | null)?.avatar ?? null;
      const avatar = limpiarAvatarSala(pedido);
      if (pedido !== null && !avatar) return { ok: false, error: 'Ese avatar no está disponible.' };
      sala.cambiarAvatar(yo.id, avatar);
      return { ok: true };
    },
  },

  /** Un visitante se sienta en un asiento libre y pasa a jugador. datos: { asientoId }. */
  'sala:sentarse': {
    puede: (_sala, yo) => yo.rol === 'visitante',
    noPuede: (_sala, yo) => (yo.rol === 'jugador' ? 'Ya estás sentado.' : 'Los narradores no se sientan en la mesa.'),
    hacer: (sala, yo, datos) => {
      const asientoId = (datos as { asientoId?: unknown } | null)?.asientoId;
      const error = typeof asientoId === 'string' ? sala.sentar(yo.id, asientoId) : 'Asiento desconocido.';
      return error ? { ok: false, error } : { ok: true };
    },
  },

  /** Un jugador levanta o baja la mano. datos: { levantada: boolean }. */
  'sala:levantarMano': {
    puede: (_sala, yo) => yo.rol === 'jugador',
    noPuede: 'Solo los jugadores sentados pueden levantar la mano.',
    hacer: (sala, yo, datos) => {
      const levantada = (datos as { levantada?: unknown } | null)?.levantada;
      if (typeof levantada !== 'boolean') return { ok: false, error: 'Estado desconocido.' };
      sala.levantarMano(yo.id, levantada);
      return { ok: true };
    },
  },

  /** Un jugador elige la forma de su mano (palma, puño o tijera). datos: { forma }. */
  'sala:elegirMano': {
    puede: (_sala, yo) => yo.rol === 'jugador',
    noPuede: 'Solo los jugadores sentados tienen mano que levantar.',
    hacer: (sala, yo, datos) => {
      const forma = (datos as { forma?: unknown } | null)?.forma;
      if (!SALA_FORMAS_MANO.includes(forma as SalaFormaMano)) return { ok: false, error: 'Forma de mano desconocida.' };
      sala.elegirFormaMano(yo.id, forma as SalaFormaMano);
      return { ok: true };
    },
  },

  /** Un jugador deja su asiento y vuelve a visitante. */
  'sala:levantarse': {
    puede: (_sala, yo) => yo.rol === 'jugador',
    noPuede: 'No estás sentado.',
    hacer: (sala, yo) => {
      sala.levantar(yo.id);
      return { ok: true };
    },
  },

  /**
   * Sube una imagen propia como avatar para la sala (su perfil de la web no
   * cambia). datos: { imagen } JPEG en base64. Devuelve su ruta en `valor`.
   */
  'sala:subirAvatar': {
    puede: cualquiera,
    noPuede: '',
    hacer: (sala, yo, datos) => {
      const guardado = guardarAvatarSala((datos as { imagen?: unknown } | null)?.imagen);
      if ('error' in guardado) return { ok: false, error: guardado.error };
      sala.cambiarAvatar(yo.id, guardado.ruta);
      return { ok: true, valor: guardado.ruta };
    },
  },

  'sala:hacerseNarrador': {
    puede: (sala) => !sala.hayNarrador(),
    noPuede: 'La sala ya tiene narrador.',
    hacer: (sala, yo) => {
      sala.cambiarRol(yo.id, 'narrador');
      return { ok: true };
    },
  },

  'narrador:dejar': {
    puede: esNarrador,
    noPuede: 'No eres narrador.',
    hacer: (sala, yo) => {
      sala.cambiarRol(yo.id, 'visitante');
      return { ok: true };
    },
  },

  /**
   * Ajustes de la partida (Preferencias > Partida). datos: cualquiera de
   * { grimorioJugadores: boolean, segundosCuentaAtras: número entero,
   *   segundosPorFicha: número de 0,25 en 0,25 }.
   */
  'narrador:configurarPartida': {
    puede: esNarrador,
    noPuede: 'Solo un narrador puede cambiar los ajustes de la partida.',
    hacer: (sala, _yo, datos) => {
      const { grimorioJugadores, segundosCuentaAtras, segundosPorFicha } = (datos as Record<string, unknown>) ?? {};
      const cambios: Parameters<SalaService['configurar']>[0] = {};
      if (grimorioJugadores !== undefined) {
        if (typeof grimorioJugadores !== 'boolean') return { ok: false, error: 'Ajuste desconocido.' };
        cambios.grimorioJugadores = grimorioJugadores;
      }
      if (segundosCuentaAtras !== undefined) {
        const { min, max } = SALA_CUENTA_ATRAS;
        const segundos = segundosCuentaAtras as number;
        if (!Number.isInteger(segundos) || segundos < min || segundos > max) {
          return { ok: false, error: `La cuenta atrás tiene que ser de ${min} a ${max} segundos.` };
        }
        cambios.segundosCuentaAtras = segundos;
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
      if (Object.keys(cambios).length === 0) return { ok: false, error: 'Ajuste desconocido.' };
      sala.configurar(cambios);
      return { ok: true };
    },
  },

  /** La ficha de un asiento nomina a la de otro (o a sí misma). datos: { desde, hasta } (ids de asiento). */
  'narrador:nominar': {
    puede: (sala, yo) => yo.rol === 'narrador' && sala.asientos().length >= 2,
    noPuede: (_sala, yo) =>
      yo.rol === 'narrador' ? 'Hacen falta al menos dos asientos.' : 'Solo un narrador puede abrir una nominación.',
    hacer: (sala, _yo, datos) => {
      const { desde, hasta } = (datos as { desde?: unknown; hasta?: unknown }) ?? {};
      if (typeof desde !== 'string' || typeof hasta !== 'string' || !sala.hayAsiento(desde) || !sala.hayAsiento(hasta)) {
        return { ok: false, error: 'Ese asiento ya no existe.' };
      }
      sala.nominar(desde, hasta);
      return { ok: true };
    },
  },

  'narrador:cerrarNominacion': {
    puede: (sala, yo) => yo.rol === 'narrador' && !!sala.nominacion(),
    noPuede: 'No hay ninguna nominación abierta.',
    hacer: (sala) => {
      sala.cerrarNominacion();
      return { ok: true };
    },
  },

  /** Arranca (o reinicia) la cuenta atrás de la nominación abierta; al acabar, empieza la votación. */
  'narrador:cuentaAtras': {
    puede: (sala, yo) => yo.rol === 'narrador' && !!sala.nominacion() && !sala.hayVotacion(),
    noPuede: (sala) => (sala.hayVotacion() ? 'Esta nominación ya se ha votado.' : 'No hay ninguna nominación abierta.'),
    hacer: (sala) => {
      sala.iniciarCuentaAtras(Date.now());
      return { ok: true };
    },
  },

  /**
   * Pone o quita la calavera a la ficha de un asiento (solo una puede llevarla).
   * Desde el panel de la nominación, además la cierra; desde el menú de la ficha
   * no (cerrarNominacion: false). datos: { asientoId, marcado: boolean, cerrarNominacion?: boolean }.
   */
  'narrador:marcar': {
    puede: (sala, yo) => yo.rol === 'narrador' && sala.asientos().length > 0,
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'La mesa no tiene asientos.' : 'Solo un narrador puede marcar una ficha.'),
    hacer: (sala, _yo, datos) => {
      const { asientoId, marcado, cerrarNominacion } =
        (datos as { asientoId?: unknown; marcado?: unknown; cerrarNominacion?: unknown }) ?? {};
      if (typeof asientoId !== 'string' || !sala.hayAsiento(asientoId)) return { ok: false, error: 'Ese asiento ya no existe.' };
      if (typeof marcado !== 'boolean') return { ok: false, error: 'Estado desconocido.' };
      sala.marcar(asientoId, marcado);
      if (cerrarNominacion !== false) sala.cerrarNominacion();
      return { ok: true };
    },
  },

  /** Quita el papel de narrador a otro narrador (pasa a visitante). datos: { participanteId }. */
  'narrador:expulsarNarrador': {
    // Solo sale si hay a quién: otro narrador además de uno mismo.
    puede: (sala, yo) => yo.rol === 'narrador' && sala.participantes().some((p) => p.rol === 'narrador' && p.id !== yo.id),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'No hay otro narrador.' : 'Solo un narrador puede quitar a otro.'),
    hacer: (sala, yo, datos) => {
      const id = (datos as { participanteId?: unknown } | null)?.participanteId;
      const elegido = typeof id === 'string' ? sala.buscar(id) : undefined;
      if (!elegido) return { ok: false, error: 'Esa persona ya no está en la sala.' };
      if (elegido.id === yo.id) return { ok: false, error: 'Para dejar de narrar, usa «Dejar de ser narrador».' };
      if (elegido.rol !== 'narrador') return { ok: false, error: `${elegido.nombre} ya no es narrador.` };
      sala.cambiarRol(elegido.id, 'visitante');
      return { ok: true };
    },
  },

  /** Mata o revive la ficha de un asiento (haya alguien sentado o no). datos: { asientoId, muerto: boolean }. */
  'narrador:cambiarVida': {
    puede: (sala, yo) => yo.rol === 'narrador' && sala.asientos().length > 0,
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'La mesa no tiene asientos.' : 'Solo un narrador puede matar o revivir.'),
    hacer: (sala, _yo, datos) => {
      const { asientoId, muerto } = (datos as { asientoId?: unknown; muerto?: unknown }) ?? {};
      if (typeof asientoId !== 'string' || !sala.hayAsiento(asientoId)) return { ok: false, error: 'Ese asiento ya no existe.' };
      if (typeof muerto !== 'boolean') return { ok: false, error: 'Estado desconocido.' };
      sala.cambiarVida(asientoId, muerto);
      return { ok: true };
    },
  },

  /** Levanta a un jugador de su asiento: vuelve a visitante. datos: { participanteId }. */
  'narrador:levantarJugador': {
    // Solo sale si hay a quién: algún jugador sentado.
    puede: (sala, yo) => yo.rol === 'narrador' && sala.participantes().some((p) => p.rol === 'jugador'),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'No hay nadie sentado.' : 'Solo un narrador puede levantar a un jugador.'),
    hacer: (sala, _yo, datos) => {
      const id = (datos as { participanteId?: unknown } | null)?.participanteId;
      const elegido = typeof id === 'string' ? sala.buscar(id) : undefined;
      if (!elegido) return { ok: false, error: 'Esa persona ya no está en la sala.' };
      if (elegido.rol !== 'jugador') return { ok: false, error: `${elegido.nombre} no está en ningún asiento.` };
      sala.levantar(elegido.id);
      return { ok: true };
    },
  },

  /** Saca de la sala a un jugador o visitante (no a otro narrador). datos: { participanteId }. */
  'narrador:expulsarJugador': {
    // Solo sale si hay a quién: alguien que no narra.
    puede: (sala, yo) => yo.rol === 'narrador' && sala.participantes().some((p) => p.rol !== 'narrador'),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'No hay nadie a quien expulsar.' : 'Solo un narrador puede expulsar a alguien.'),
    hacer: (sala, _yo, datos) => {
      const id = (datos as { participanteId?: unknown } | null)?.participanteId;
      const elegido = typeof id === 'string' ? sala.buscar(id) : undefined;
      if (!elegido) return { ok: false, error: 'Esa persona ya no está en la sala.' };
      if (elegido.rol === 'narrador') return { ok: false, error: 'Para quitar a un narrador, usa «Expulsar narrador».' };
      const conexion = sala.expulsar(elegido.id);
      return { ok: true, expulsar: conexion ? [conexion] : [] };
    },
  },

  /**
   * Añade o quita un asiento al final del círculo, mezcla a quienes están
   * sentados o mueve a uno a otro asiento (intercambiándolos si está ocupado).
   * datos: { cambio: 'añadir' | 'quitar' | 'mezclar' } o
   * { cambio: 'mover', desde: asientoId, hasta: asientoId }.
   */
  'narrador:asientos': {
    puede: esNarrador,
    noPuede: 'Solo un narrador puede cambiar los asientos.',
    hacer: (sala, _yo, datos) => {
      const cambio = (datos as { cambio?: unknown } | null)?.cambio;
      const total = sala.asientos().length;
      if (cambio === 'añadir') {
        if (total >= SALA_ASIENTOS.max) return { ok: false, error: `La mesa ya tiene el máximo de ${SALA_ASIENTOS.max} asientos.` };
        sala.anadirAsiento();
        return { ok: true };
      }
      if (cambio === 'quitar') {
        if (total <= SALA_ASIENTOS.min) return { ok: false, error: 'La mesa ya no tiene asientos.' };
        sala.quitarAsiento();
        return { ok: true };
      }
      if (cambio === 'mover') {
        const { desde, hasta } = (datos as { desde?: unknown; hasta?: unknown }) ?? {};
        if (typeof desde !== 'string' || typeof hasta !== 'string') return { ok: false, error: 'Asiento desconocido.' };
        const error = sala.moverOcupante(desde, hasta);
        return error ? { ok: false, error } : { ok: true };
      }
      if (cambio === 'mezclar') {
        if (sala.mezclarAsientos() === 0) return { ok: false, error: 'No hay nadie sentado para mezclar.' };
        return { ok: true };
      }
      return { ok: false, error: 'Cambio de asientos desconocido.' };
    },
  },

  /** datos: { participanteId } de un visitante o jugador. */
  'narrador:nombrarNarrador': {
    puede: esNarrador,
    noPuede: 'Solo un narrador puede nombrar a otro.',
    hacer: (sala, _yo, datos) => {
      const id = (datos as { participanteId?: unknown } | null)?.participanteId;
      const elegido = typeof id === 'string' ? sala.buscar(id) : undefined;
      if (!elegido) return { ok: false, error: 'Esa persona ya no está en la sala.' };
      if (elegido.rol === 'narrador') return { ok: false, error: `${elegido.nombre} ya es narrador.` };
      sala.cambiarRol(elegido.id, 'narrador');
      return { ok: true };
    },
  },
};

/** Las acciones que este participante puede usar ahora mismo. */
export function accionesPermitidas(sala: SalaService, yo: SalaParticipante): string[] {
  return Object.entries(SALA_ACCIONES)
    .filter(([, accion]) => accion.puede(sala, yo))
    .map(([nombre]) => nombre);
}

/** Ejecuta una acción si existe y quien la pide tiene permiso. */
export function ejecutarAccion(sala: SalaService, yo: SalaParticipante | undefined, nombre: string, datos: unknown): SalaEfecto {
  const accion = Object.prototype.hasOwnProperty.call(SALA_ACCIONES, nombre) ? SALA_ACCIONES[nombre] : undefined;
  if (!accion) return { ok: false, error: 'Acción desconocida.' };
  if (!yo) return { ok: false, error: 'No estás en la sala.' };
  if (!accion.puede(sala, yo)) {
    return { ok: false, error: typeof accion.noPuede === 'function' ? accion.noPuede(sala, yo) : accion.noPuede };
  }
  return accion.hacer(sala, yo, datos);
}
