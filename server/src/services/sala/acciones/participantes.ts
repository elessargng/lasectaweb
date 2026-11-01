import { limpiarNombreSala } from '../../../models/sala/Participantes';
import { SALA_ESTILOS_MANO, SALA_FORMAS_MANO, type FormaMano } from '../../../models/compartido/participante';
import { type Accion, cualquiera, esNarrador } from './Accion';

/** Quién está en la sala y dónde: nombre, avatar, mano, asientos y papeles. */
export const ACCIONES_PARTICIPANTES: Record<string, Accion> = {
  /** datos: { nombre }. Vacío: vuelve al nombre de usuario (solo con cuenta). */
  'sala:cambiarNombre': {
    puede: cualquiera,
    noPuede: '',
    hacer: (juego, yo, datos) => {
      const { sala } = juego;
      const pedido = limpiarNombreSala((datos as { nombre?: unknown } | null)?.nombre);
      const nombre = pedido || (yo.persona.tipo === 'usuario' ? sala.participantes.nombreBase(yo.id) : '');
      if (!nombre) return { ok: false, error: 'Escribe un nombre.' };
      if (sala.participantes.nombreOcupado(nombre, yo.id)) return { ok: false, error: `Ya hay alguien llamado ${nombre} en la sala.` };
      sala.participantes.renombrar(yo.id, nombre);
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
    hacer: (juego, yo, datos, { imagenes }) => {
      const { sala } = juego;
      const pedido = (datos as { avatar?: unknown } | null)?.avatar ?? null;
      const avatar = imagenes.avatarValido(pedido);
      if (pedido !== null && !avatar) return { ok: false, error: 'Ese avatar no está disponible.' };
      sala.participantes.cambiarAvatar(yo.id, avatar);
      return { ok: true };
    },
  },

  /**
   * Sube una imagen propia como avatar para la sala (su perfil de la web no
   * cambia). datos: { imagen } JPEG o GIF (animado) en base64. Devuelve su ruta en `valor`.
   */
  'sala:subirAvatar': {
    puede: cualquiera,
    noPuede: '',
    hacer: (juego, yo, datos, { imagenes }) => {
      const { sala } = juego;
      const guardado = imagenes.guardarAvatar((datos as { imagen?: unknown } | null)?.imagen);
      if ('error' in guardado) return { ok: false, error: guardado.error };
      sala.participantes.cambiarAvatar(yo.id, guardado.ruta);
      return { ok: true, valor: guardado.ruta };
    },
  },

  /** Cualquiera dice si ha quitado el sonido (no oye a los demás). datos: { sinSonido: boolean }. */
  'sala:sonido': {
    puede: cualquiera,
    noPuede: '',
    hacer: (juego, yo, datos) => {
      const { sala } = juego;
      const sinSonido = (datos as { sinSonido?: unknown } | null)?.sinSonido;
      if (typeof sinSonido !== 'boolean') return { ok: false, error: 'Estado desconocido.' };
      sala.participantes.cambiarSonido(yo.id, sinSonido);
      return { ok: true };
    },
  },

  /**
   * Cualquiera dice cómo se ve su mano (su «skin», de las preferencias): todos la ven
   * así. datos: { estilo } (uno de SALA_ESTILOS_MANO).
   */
  'sala:estiloMano': {
    puede: cualquiera,
    noPuede: '',
    hacer: (juego, yo, datos) => {
      const { sala } = juego;
      const estilo = (datos as { estilo?: unknown } | null)?.estilo;
      if (typeof estilo !== 'string' || !SALA_ESTILOS_MANO.includes(estilo)) return { ok: false, error: 'Estilo de mano desconocido.' };
      sala.participantes.elegirEstiloMano(yo.id, estilo);
      return { ok: true };
    },
  },

  /**
   * Un jugador o un narrador elige la forma de su mano: una de SALA_FORMAS_MANO o un
   * personaje del guion (su icono). datos: { forma }.
   */
  'sala:elegirMano': {
    puede: (_sala, yo) => yo.rol === 'jugador' || yo.rol === 'narrador',
    noPuede: 'Solo los jugadores sentados y los narradores tienen mano que levantar.',
    hacer: (juego, yo, datos) => {
      const { sala, partida } = juego;
      const forma = (datos as { forma?: unknown } | null)?.forma;
      if (typeof forma !== 'string' || (!SALA_FORMAS_MANO.includes(forma) && !partida.guion.personaje(forma))) {
        return { ok: false, error: 'Forma de mano desconocida.' };
      }
      sala.participantes.elegirFormaMano(yo.id, forma as FormaMano);
      return { ok: true };
    },
  },

  /**
   * Un jugador o un narrador levanta o baja la mano (un muerto sin voto solo puede
   * bajarla). La del narrador no vota: es para hacerse ver. datos: { levantada: boolean }.
   */
  'sala:levantarMano': {
    puede: (_sala, yo) => yo.rol === 'jugador' || yo.rol === 'narrador',
    noPuede: 'Solo los jugadores sentados y los narradores pueden levantar la mano.',
    hacer: (juego, yo, datos) => {
      const { sala, partida } = juego;
      const levantada = (datos as { levantada?: unknown } | null)?.levantada;
      if (typeof levantada !== 'boolean') return { ok: false, error: 'Estado desconocido.' };
      if (levantada && partida.manosBloqueadas(yo)) return { ok: false, error: 'Mientras se señala no se puede levantar la mano.' };
      if (levantada && yo.rol === 'jugador' && partida.sinVoto(yo.id)) return { ok: false, error: partida.voudonVivo() ? 'Con el Voudon vivo, solo votan él y los muertos.' : 'Ya has gastado tu voto: no puedes levantar la mano.' };
      sala.participantes.levantarMano(yo.id, levantada);
      return { ok: true };
    },
  },

  /**
   * Levanta las dos manos (dos votos): solo la Banshee muerta con «Has Ability».
   * Para bajarlas o dejar una, 'sala:levantarMano'.
   */
  'sala:levantarDosManos': {
    puede: ({ partida }, yo) => yo.rol === 'jugador' && partida.puedeVotarDoble(yo.id),
    noPuede: 'Solo la Banshee con su habilidad puede levantar las dos manos.',
    hacer: (juego, yo) => {
      const { sala, partida } = juego;
      if (partida.manosBloqueadas(yo)) return { ok: false, error: 'Mientras se señala no se puede levantar la mano.' };
      if (partida.sinVoto(yo.id)) return { ok: false, error: partida.voudonVivo() ? 'Con el Voudon vivo, solo votan él y los muertos.' : 'Ya has gastado tu voto: no puedes levantar la mano.' };
      sala.participantes.levantarMano(yo.id, true, true);
      return { ok: true };
    },
  },

  /** Un visitante se sienta en un asiento libre y pasa a jugador. datos: { jugadorId }. */
  // Quien ve el grimorio del narrador no puede jugar: sabría los personajes de todos.
  'sala:sentarse': {
    puede: ({ partida }, yo) => yo.rol === 'visitante' && partida.acceso.de(yo.id) !== 'concedido',
    noPuede: (_sala, yo) =>
      yo.rol === 'jugador'
        ? 'Ya estás sentado.'
        : yo.rol === 'narrador'
          ? 'Los narradores no se sientan en la plaza.'
          : 'Quien ha visto el grimorio del narrador no puede sentarse en la plaza.',
    hacer: (juego, yo, datos) => {
      const { sala } = juego;
      const jugadorId = (datos as { jugadorId?: unknown } | null)?.jugadorId;
      const error = typeof jugadorId === 'string' ? sala.sentar(yo.id, jugadorId) : 'Asiento desconocido.';
      return error ? { ok: false, error } : { ok: true };
    },
  },

  /** Un jugador deja su asiento y vuelve a visitante. */
  'sala:levantarse': {
    puede: (_sala, yo) => yo.rol === 'jugador',
    noPuede: 'No estás sentado.',
    hacer: (juego, yo) => {
      const { sala } = juego;
      sala.levantar(yo.id);
      return { ok: true };
    },
  },

  /** Un visitante pide ver el grimorio del narrador (los narradores lo aceptan o lo rechazan). */
  'sala:solicitarGrimorio': {
    // Con narrador virtual, lo concede él al momento
    puede: ({ sala, partida }, yo) => yo.rol === 'visitante' && partida.acceso.de(yo.id) === 'ninguno' && sala.participantes.hayNarrador(),
    noPuede: ({ partida }, yo) =>
      yo.rol !== 'visitante'
        ? 'Solo los visitantes piden ver el grimorio.'
        : partida.acceso.de(yo.id) !== 'ninguno'
          ? partida.acceso.de(yo.id) === 'concedido'
            ? 'Ya ves el grimorio.'
            : 'Ya lo has pedido.'
          : 'La sala no tiene narrador.',
    hacer: (juego, yo) => {
      const { partida } = juego;
      partida.acceso.cambiar(yo.id, 'solicitado');
      return { ok: true };
    },
  },

  /**
   * El narrador responde a quien ha pedido ver el grimorio: se lo concede (y ya
   * no lo pierde mientras sea visitante: lo ha visto) o no.
   * datos: { participanteId, conceder: boolean }.
   */
  'narrador:accesoGrimorio': {
    puede: esNarrador,
    noPuede: 'Solo un narrador decide quién ve el grimorio.',
    hacer: (juego, _yo, datos) => {
      const { sala, partida } = juego;
      const { participanteId, conceder } = (datos as { participanteId?: unknown; conceder?: unknown }) ?? {};
      const quien = typeof participanteId === 'string' ? sala.participantes.buscar(participanteId) : undefined;
      if (!quien || quien.rol !== 'visitante') return { ok: false, error: 'Esa persona ya no es visitante de la sala.' };
      if (typeof conceder !== 'boolean') return { ok: false, error: 'Respuesta desconocida.' };
      if (partida.acceso.de(quien.id) !== 'solicitado') return { ok: false, error: 'Esa persona ya no lo está pidiendo.' };
      partida.acceso.cambiar(quien.id, conceder ? 'concedido' : 'ninguno');
      return { ok: true };
    },
  },

  'sala:hacerseNarrador': {
    puede: ({ sala }) => !sala.participantes.hayNarrador(),
    noPuede: 'La sala ya tiene narrador.',
    hacer: (juego, yo) => {
      const { sala } = juego;
      sala.participantes.cambiarRol(yo.id, 'narrador');
      return { ok: true };
    },
  },

  'narrador:dejar': {
    puede: esNarrador,
    noPuede: 'No eres narrador.',
    hacer: (juego, yo) => {
      const { sala } = juego;
      sala.participantes.cambiarRol(yo.id, 'visitante');
      return { ok: true };
    },
  },

  /** datos: { participanteId } de un visitante o jugador. */
  'narrador:nombrarNarrador': {
    puede: esNarrador,
    noPuede: 'Solo un narrador puede nombrar a otro.',
    hacer: (juego, _yo, datos) => {
      const { sala } = juego;
      const id = (datos as { participanteId?: unknown } | null)?.participanteId;
      const elegido = typeof id === 'string' ? sala.participantes.buscar(id) : undefined;
      if (!elegido) return { ok: false, error: 'Esa persona ya no está en la sala.' };
      if (elegido.rol === 'narrador') return { ok: false, error: `${elegido.nombre} ya es narrador.` };
      sala.participantes.cambiarRol(elegido.id, 'narrador');
      return { ok: true };
    },
  },

  /** Quita el papel de narrador a otro narrador (pasa a visitante). datos: { participanteId }. */
  'narrador:expulsarNarrador': {
    // Solo sale si hay a quién: otro narrador además de uno mismo.
    puede: ({ sala }, yo) => yo.rol === 'narrador' && sala.participantes.participantes().some((p) => p.rol === 'narrador' && p.id !== yo.id),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'No hay otro narrador.' : 'Solo un narrador puede quitar a otro.'),
    hacer: (juego, yo, datos) => {
      const { sala } = juego;
      const id = (datos as { participanteId?: unknown } | null)?.participanteId;
      const elegido = typeof id === 'string' ? sala.participantes.buscar(id) : undefined;
      if (!elegido) return { ok: false, error: 'Esa persona ya no está en la sala.' };
      if (elegido.id === yo.id) return { ok: false, error: 'Para dejar de narrar, usa «Dejar de ser narrador».' };
      if (elegido.rol !== 'narrador') return { ok: false, error: `${elegido.nombre} ya no es narrador.` };
      sala.participantes.cambiarRol(elegido.id, 'visitante');
      return { ok: true };
    },
  },

  /** Levanta a un jugador de su asiento: vuelve a visitante. datos: { participanteId }. */
  'narrador:levantarJugador': {
    // Solo sale si hay a quién: algún jugador sentado.
    puede: ({ sala }, yo) => yo.rol === 'narrador' && sala.participantes.participantes().some((p) => p.rol === 'jugador'),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'No hay nadie sentado.' : 'Solo un narrador puede levantar a un jugador.'),
    hacer: (juego, _yo, datos) => {
      const { sala } = juego;
      const id = (datos as { participanteId?: unknown } | null)?.participanteId;
      const elegido = typeof id === 'string' ? sala.participantes.buscar(id) : undefined;
      if (!elegido) return { ok: false, error: 'Esa persona ya no está en la sala.' };
      if (elegido.rol !== 'jugador') return { ok: false, error: `${elegido.nombre} no está en ningún asiento.` };
      sala.levantar(elegido.id);
      return { ok: true };
    },
  },

  /** Saca de la sala a un jugador o visitante (no a otro narrador). datos: { participanteId }. */
  'narrador:expulsarJugador': {
    // Solo sale si hay a quién: alguien que no narra.
    puede: ({ sala }, yo) => yo.rol === 'narrador' && sala.participantes.participantes().some((p) => p.rol !== 'narrador'),
    noPuede: (_sala, yo) => (yo.rol === 'narrador' ? 'No hay nadie a quien expulsar.' : 'Solo un narrador puede expulsar a alguien.'),
    hacer: (juego, _yo, datos) => {
      const { sala } = juego;
      const id = (datos as { participanteId?: unknown } | null)?.participanteId;
      const elegido = typeof id === 'string' ? sala.participantes.buscar(id) : undefined;
      if (!elegido) return { ok: false, error: 'Esa persona ya no está en la sala.' };
      if (elegido.rol === 'narrador') return { ok: false, error: 'Para quitar a un narrador, usa «Expulsar narrador».' };
      const conexion = sala.participantes.expulsar(elegido.id);
      return { ok: true, expulsar: conexion ? [conexion] : [] };
    },
  },

  /**
   * Añade o quita un asiento al final del círculo, mezcla a quienes están
   * sentados o mueve a uno a otro asiento (intercambiándolos si está ocupado).
   * datos: { cambio: 'añadir' | 'quitar' | 'mezclar' } o
   * { cambio: 'mover', desde: jugadorId, hasta: jugadorId }.
   */
  'narrador:asientos': {
    puede: esNarrador,
    noPuede: 'Solo un narrador puede cambiar los asientos.',
    hacer: (juego, _yo, datos) => {
      const { sala } = juego;
      const cambio = (datos as { cambio?: unknown } | null)?.cambio;
      if (cambio === 'añadir') {
        const error = sala.anadirAsiento();
        return error ? { ok: false, error } : { ok: true };
      }
      if (cambio === 'quitar') {
        if (!sala.quitarAsiento()) return { ok: false, error: 'La plaza ya no tiene asientos.' };
        return { ok: true };
      }
      if (cambio === 'mover') {
        const { desde, hasta } = (datos as { desde?: unknown; hasta?: unknown }) ?? {};
        if (typeof desde !== 'string' || typeof hasta !== 'string') return { ok: false, error: 'Asiento desconocido.' };
        const error = sala.moverOcupante(desde, hasta);
        return error ? { ok: false, error } : { ok: true };
      }
      if (cambio === 'mezclar') {
        if (sala.mezclar() === 0) return { ok: false, error: 'No hay nadie sentado para mezclar.' };
        return { ok: true };
      }
      return { ok: false, error: 'Cambio de asientos desconocido.' };
    },
  },
};
