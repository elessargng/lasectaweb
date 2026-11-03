import type { CambioAsientos } from '../../models/sala/Sala';
import type { Participante } from '../../models/sala/Participantes';
import type { SalaDeJuego } from '../../models/SalaDeJuego';
import type { ImagenesSala } from './ImagenesSala';
import { UsosSala, type Permiso, type ResultadoUso } from './UsosSala';

/** Lo que se puede hacer con quién está en la sala (son también los nombres que recibe el cliente para pintar sus botones). */
export const USOS_PARTICIPANTES = [
  'sala:cambiarNombre',
  'sala:cambiarAvatar',
  'sala:subirAvatar',
  'sala:sonido',
  'sala:estiloMano',
  'sala:elegirMano',
  'sala:levantarMano',
  'sala:levantarDosManos',
  'sala:sentarse',
  'sala:levantarse',
  'sala:solicitarGrimorio',
  'sala:accesoGrimorio',
  'sala:hacerseNarrador',
  'sala:dejarDeNarrar',
  'sala:nombrarNarrador',
  'sala:quitarNarrador',
  'sala:levantarJugador',
  'sala:expulsar',
  'sala:asientos',
] as const;
type UsoParticipantes = (typeof USOS_PARTICIPANTES)[number];

const cualquiera: Permiso = () => null;

const soloNarrador =
  (noPuede: string): Permiso =>
  (_juego, yo) =>
    yo.rol === 'narrador' ? null : noPuede;

/** Los jugadores sentados y los narradores: los que tienen mano (si no, `noPuede`). */
const conMano =
  (noPuede: string): Permiso =>
  (_juego, yo) =>
    yo.rol === 'jugador' || yo.rol === 'narrador' ? null : noPuede;

/** Quién puede hacer cada cosa y, si no, por qué. */
const PERMISOS: Record<UsoParticipantes, Permiso> = {
  'sala:cambiarNombre': cualquiera,
  'sala:cambiarAvatar': cualquiera,
  'sala:subirAvatar': cualquiera,
  'sala:sonido': cualquiera,
  'sala:estiloMano': cualquiera,
  'sala:elegirMano': conMano('Solo los jugadores sentados y los narradores tienen mano que levantar.'),
  'sala:levantarMano': conMano('Solo los jugadores sentados y los narradores pueden levantar la mano.'),
  // Solo la Banshee muerta con «Has Ability»
  'sala:levantarDosManos': ({ partida }, yo) =>
    yo.rol === 'jugador' && partida.puedeVotarDoble(yo.id) ? null : 'Solo la Banshee con su habilidad puede levantar las dos manos.',
  // Quien ve el grimorio del narrador no puede jugar: sabría los personajes de todos
  'sala:sentarse': ({ partida }, yo) => {
    if (yo.rol === 'jugador') return 'Ya estás sentado.';
    if (yo.rol === 'narrador') return 'Los narradores no se sientan en la plaza.';
    return partida.acceso.de(yo.id) !== 'concedido' ? null : 'Quien ha visto el grimorio del narrador no puede sentarse en la plaza.';
  },
  'sala:levantarse': (_juego, yo) => (yo.rol === 'jugador' ? null : 'No estás sentado.'),
  // Con narrador virtual, lo concede él al momento
  'sala:solicitarGrimorio': ({ sala, partida }, yo) => {
    if (yo.rol !== 'visitante') return 'Solo los visitantes piden ver el grimorio.';
    const acceso = partida.acceso.de(yo.id);
    if (acceso === 'concedido') return 'Ya ves el grimorio.';
    if (acceso === 'solicitado') return 'Ya lo has pedido.';
    return sala.participantes.hayNarrador() ? null : 'La sala no tiene narrador.';
  },
  'sala:accesoGrimorio': soloNarrador('Solo un narrador decide quién ve el grimorio.'),
  'sala:hacerseNarrador': ({ sala }) => (sala.participantes.hayNarrador() ? 'La sala ya tiene narrador.' : null),
  'sala:dejarDeNarrar': soloNarrador('No eres narrador.'),
  'sala:nombrarNarrador': soloNarrador('Solo un narrador puede nombrar a otro.'),
  // Solo si hay a quién: otro narrador además de uno mismo
  'sala:quitarNarrador': ({ sala }, yo) => {
    if (yo.rol !== 'narrador') return 'Solo un narrador puede quitar a otro.';
    return sala.participantes.participantes().some((p) => p.rol === 'narrador' && p.id !== yo.id) ? null : 'No hay otro narrador.';
  },
  // Solo si hay alguien sentado
  'sala:levantarJugador': ({ sala }, yo) => {
    if (yo.rol !== 'narrador') return 'Solo un narrador puede levantar a un jugador.';
    return sala.participantes.participantes().some((p) => p.rol === 'jugador') ? null : 'No hay nadie sentado.';
  },
  // Solo si hay alguien que no narra
  'sala:expulsar': ({ sala }, yo) => {
    if (yo.rol !== 'narrador') return 'Solo un narrador puede expulsar a alguien.';
    return sala.participantes.participantes().some((p) => p.rol !== 'narrador') ? null : 'No hay nadie a quien expulsar.';
  },
  'sala:asientos': soloNarrador('Solo un narrador puede cambiar los asientos.'),
};

/**
 * Los casos de uso de quién está en la sala y dónde: el nombre, el avatar, la mano,
 * los asientos, los papeles (narrador, jugador, visitante) y quién ve el grimorio.
 * Las reglas están en models/sala (Participantes, Sala) y en la partida (la mano, el
 * acceso al grimorio). Si cambia, avisa para que la sala se mande a todos.
 */
export class ParticipantesService {
  private readonly usos: UsosSala<UsoParticipantes>;

  constructor(
    private readonly juego: SalaDeJuego,
    /** La sala ha cambiado: se manda a todos. */
    alCambiar: () => void,
    /** Las imágenes de la sala (los avatares). */
    private readonly imagenes: ImagenesSala,
    /** Cierra la conexión de quien ha sido expulsado. */
    private readonly cerrarConexion: (conexion: string) => void,
  ) {
    this.usos = new UsosSala(juego, PERMISOS, alCambiar);
  }

  /** El participante de una sesión (su id), o null si ya no está en la sala. */
  quienEs(clave: string): string | null {
    return this.usos.quienEs(clave);
  }

  /** Lo que puede hacer ahora (para que el cliente pinte sus botones). */
  permitidas(yo: Participante): string[] {
    return this.usos.permitidos(yo, USOS_PARTICIPANTES);
  }

  /** Su nombre en la sala; vacío, vuelve al de su cuenta (solo con cuenta). */
  cambiarNombre(yoId: string, nombre: string): ResultadoUso {
    return this.usos.hacer(yoId, 'sala:cambiarNombre', () => this.participantes().elegirNombre(yoId, nombre));
  }

  /** Uno de los avatares de la sala o una imagen ya subida a ella, o null: el de por defecto (el de su cuenta, o el logo). */
  cambiarAvatar(yoId: string, avatar: unknown): ResultadoUso {
    return this.usos.hacer(yoId, 'sala:cambiarAvatar', () => {
      const valido = this.imagenes.avatarValido(avatar);
      if (avatar !== null && !valido) return 'Ese avatar no está disponible.';
      this.participantes().cambiarAvatar(yoId, valido);
      return null;
    });
  }

  /** Sube una imagen propia como avatar para la sala (su perfil de la web no cambia); contesta su ruta. */
  subirAvatar(yoId: string, imagen: unknown): ResultadoUso {
    return this.usos.hacer(yoId, 'sala:subirAvatar', () => {
      const guardado = this.imagenes.guardarAvatar(imagen);
      if ('error' in guardado) return guardado.error;
      this.participantes().cambiarAvatar(yoId, guardado.ruta);
      return { valor: guardado.ruta };
    });
  }

  /** Dice si ha quitado el sonido (no oye a los demás). */
  sonido(yoId: string, sinSonido: boolean): ResultadoUso {
    return this.usos.hacer(yoId, 'sala:sonido', () => {
      this.participantes().cambiarSonido(yoId, sinSonido);
      return null;
    });
  }

  /** Cómo ven todos su mano (su «skin»). */
  estiloMano(yoId: string, estilo: string): ResultadoUso {
    return this.usos.hacer(yoId, 'sala:estiloMano', () => this.participantes().elegirEstiloMano(yoId, estilo));
  }

  /** La forma de su mano (una de las de la sala o el icono de un personaje del guion). */
  elegirMano(yoId: string, forma: string): ResultadoUso {
    return this.usos.hacer(yoId, 'sala:elegirMano', () => this.juego.partida.elegirMano(yoId, forma));
  }

  /** Levanta o baja la mano (ver Partida.levantarMano). */
  levantarMano(yoId: string, levantada: boolean): ResultadoUso {
    return this.usos.hacer(yoId, 'sala:levantarMano', () => this.juego.partida.levantarMano(yoId, levantada));
  }

  /** Levanta las dos manos (dos votos): la Banshee. Para bajarlas o dejar una, levantarMano. */
  levantarDosManos(yoId: string): ResultadoUso {
    return this.usos.hacer(yoId, 'sala:levantarDosManos', () => this.juego.partida.levantarMano(yoId, true, true));
  }

  /** Un visitante se sienta en un asiento libre y pasa a jugador. */
  sentarse(yoId: string, jugadorId: string): ResultadoUso {
    return this.usos.hacer(yoId, 'sala:sentarse', () => this.juego.sala.sentar(yoId, jugadorId));
  }

  /** Un jugador deja su asiento y vuelve a visitante. */
  levantarse(yoId: string): ResultadoUso {
    return this.usos.hacer(yoId, 'sala:levantarse', () => {
      this.juego.sala.levantar(yoId);
      return null;
    });
  }

  /** Un visitante pide ver el grimorio del narrador (los narradores lo aceptan o lo rechazan). */
  solicitarGrimorio(yoId: string): ResultadoUso {
    return this.usos.hacer(yoId, 'sala:solicitarGrimorio', () => {
      this.juego.partida.acceso.cambiar(yoId, 'solicitado');
      return null;
    });
  }

  /** El narrador responde a quien ha pedido ver el grimorio. */
  accesoGrimorio(yoId: string, participanteId: string, conceder: boolean): ResultadoUso {
    return this.usos.hacer(yoId, 'sala:accesoGrimorio', () => this.juego.partida.responderAcceso(participanteId, conceder));
  }

  hacerseNarrador(yoId: string): ResultadoUso {
    return this.usos.hacer(yoId, 'sala:hacerseNarrador', () => {
      this.participantes().cambiarRol(yoId, 'narrador');
      return null;
    });
  }

  dejarDeNarrar(yoId: string): ResultadoUso {
    return this.usos.hacer(yoId, 'sala:dejarDeNarrar', () => {
      this.participantes().cambiarRol(yoId, 'visitante');
      return null;
    });
  }

  /** Un narrador hace narrador a otro (visitante o jugador). */
  nombrarNarrador(yoId: string, participanteId: string): ResultadoUso {
    return this.usos.hacer(yoId, 'sala:nombrarNarrador', () => this.participantes().nombrarNarrador(participanteId));
  }

  /** Un narrador quita el papel a otro narrador (pasa a visitante). */
  quitarNarrador(yoId: string, participanteId: string): ResultadoUso {
    return this.usos.hacer(yoId, 'sala:quitarNarrador', () => this.participantes().quitarNarrador(yoId, participanteId));
  }

  /** Un narrador levanta a un jugador de su asiento: vuelve a visitante. */
  levantarJugador(yoId: string, participanteId: string): ResultadoUso {
    return this.usos.hacer(yoId, 'sala:levantarJugador', () => this.juego.sala.levantarJugador(participanteId));
  }

  /** Un narrador saca de la sala a un jugador o visitante (y se cierra su conexión). */
  expulsar(yoId: string, participanteId: string): ResultadoUso {
    return this.usos.hacer(yoId, 'sala:expulsar', () => {
      const r = this.participantes().expulsarDeLaSala(participanteId);
      if ('error' in r) return r.error;
      if (r.conexion) this.cerrarConexion(r.conexion);
      return null;
    });
  }

  /** Cambia los asientos (ver Sala.cambiarAsientos). */
  asientos(yoId: string, cambio: CambioAsientos): ResultadoUso {
    return this.usos.hacer(yoId, 'sala:asientos', () => this.juego.sala.cambiarAsientos(cambio));
  }

  private participantes() {
    return this.juego.sala.participantes;
  }
}
