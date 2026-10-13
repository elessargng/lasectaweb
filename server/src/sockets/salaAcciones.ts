import { limpiarAvatarSala, limpiarNombreSala, SALA_ASIENTOS, SalaService } from '../services/SalaService';
import { SalaParticipante } from '../types/sala';

export type SalaResultado = { ok: true } | { ok: false; error: string };

interface Accion {
  /** Si quien la pide puede hacerla ahora. Es la única comprobación de permisos. */
  puede: (sala: SalaService, yo: SalaParticipante) => boolean;
  /** Mensaje cuando no puede. */
  noPuede: string | ((sala: SalaService, yo: SalaParticipante) => string);
  /** La ejecuta; solo valida los datos que recibe, no los permisos. */
  hacer: (sala: SalaService, yo: SalaParticipante, datos: unknown) => SalaResultado;
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

  /** datos: { avatar } uno de `SALA_AVATARES`, o null para el por defecto (el de su cuenta, o el logo si es invitado). */
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

  /** Un jugador deja su asiento y vuelve a visitante. */
  'sala:levantarse': {
    puede: (_sala, yo) => yo.rol === 'jugador',
    noPuede: 'No estás sentado.',
    hacer: (sala, yo) => {
      sala.levantar(yo.id);
      return { ok: true };
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

  /** Añade o quita un asiento al final del círculo. datos: { cambio: 'añadir' | 'quitar' }. */
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
export function ejecutarAccion(sala: SalaService, yo: SalaParticipante | undefined, nombre: string, datos: unknown): SalaResultado {
  const accion = Object.prototype.hasOwnProperty.call(SALA_ACCIONES, nombre) ? SALA_ACCIONES[nombre] : undefined;
  if (!accion) return { ok: false, error: 'Acción desconocida.' };
  if (!yo) return { ok: false, error: 'No estás en la sala.' };
  if (!accion.puede(sala, yo)) {
    return { ok: false, error: typeof accion.noPuede === 'function' ? accion.noPuede(sala, yo) : accion.noPuede };
  }
  return accion.hacer(sala, yo, datos);
}
