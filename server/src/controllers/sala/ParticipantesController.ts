import type { CambioAsientos } from '../../models/sala/Sala';
import type { ParticipantesService } from '../../services/sala/ParticipantesService';
import type { Responder } from '../../services/sala/SalaService';
import type { ResultadoAccion } from '../../views/dto/sala';
import { campos, como, type Fallo } from './peticion';
import type { Sesion } from './SalaController';

const ESTADO_DESCONOCIDO: Fallo = { ok: false, error: 'Estado desconocido.' };
const FUERA_DE_LA_SALA: Fallo = { ok: false, error: 'Esa persona ya no está en la sala.' };

/** El cambio de asientos que se pide, o null si no se entiende. */
function cambioAsientos(peticion: unknown): CambioAsientos | null {
  const { cambio, desde, hasta } = campos(peticion);
  if (cambio === 'añadir' || cambio === 'quitar' || cambio === 'mezclar') return { cambio };
  if (cambio === 'mover' && typeof desde === 'string' && typeof hasta === 'string') return { cambio, desde, hasta };
  return null;
}

/**
 * Quién está en la sala y dónde (hoy por WebSocket, ver infra/socketio): el nombre,
 * el avatar, la mano, los asientos, los papeles y quién ve el grimorio. Cada método
 * lee una petición, se la pasa a ParticipantesService y contesta. Lo que cambia le
 * llega a cada uno con la sala, por el difusor.
 */
export class ParticipantesController {
  constructor(private readonly participantesService: ParticipantesService) {}

  /** Su nombre: { nombre } (vacío: el de su cuenta). */
  cambiarNombre = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { nombre } = campos(peticion);
    this.como(sesion, responder, (yoId) => this.participantesService.cambiarNombre(yoId, typeof nombre === 'string' ? nombre : ''));
  };

  /** Su avatar: { avatar } (uno de la sala, una imagen ya subida o null). */
  cambiarAvatar = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { avatar = null } = campos(peticion);
    this.como(sesion, responder, (yoId) => this.participantesService.cambiarAvatar(yoId, avatar));
  };

  /** Sube un avatar: { imagen } (data URL). */
  subirAvatar = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { imagen } = campos(peticion);
    this.como(sesion, responder, (yoId) => this.participantesService.subirAvatar(yoId, imagen));
  };

  /** { sinSonido: boolean }. */
  sonido = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { sinSonido } = campos(peticion);
    this.como(sesion, responder, (yoId) => (typeof sinSonido === 'boolean' ? this.participantesService.sonido(yoId, sinSonido) : ESTADO_DESCONOCIDO));
  };

  /** { estilo }. */
  estiloMano = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { estilo } = campos(peticion);
    this.como(sesion, responder, (yoId) =>
      typeof estilo === 'string' ? this.participantesService.estiloMano(yoId, estilo) : { ok: false, error: 'Estilo de mano desconocido.' },
    );
  };

  /** { forma }. */
  elegirMano = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { forma } = campos(peticion);
    this.como(sesion, responder, (yoId) =>
      typeof forma === 'string' ? this.participantesService.elegirMano(yoId, forma) : { ok: false, error: 'Forma de mano desconocida.' },
    );
  };

  /** { levantada: boolean }. */
  levantarMano = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { levantada } = campos(peticion);
    this.como(sesion, responder, (yoId) => (typeof levantada === 'boolean' ? this.participantesService.levantarMano(yoId, levantada) : ESTADO_DESCONOCIDO));
  };

  levantarDosManos = (sesion: Sesion, _peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    this.como(sesion, responder, (yoId) => this.participantesService.levantarDosManos(yoId));
  };

  /** Se sienta en un asiento libre: { jugadorId }. */
  sentarse = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { jugadorId } = campos(peticion);
    this.como(sesion, responder, (yoId) =>
      typeof jugadorId === 'string' ? this.participantesService.sentarse(yoId, jugadorId) : { ok: false, error: 'Asiento desconocido.' },
    );
  };

  levantarse = (sesion: Sesion, _peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    this.como(sesion, responder, (yoId) => this.participantesService.levantarse(yoId));
  };

  solicitarGrimorio = (sesion: Sesion, _peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    this.como(sesion, responder, (yoId) => this.participantesService.solicitarGrimorio(yoId));
  };

  /** Responde a quien pide ver el grimorio: { participanteId, conceder: boolean }. */
  accesoGrimorio = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { participanteId, conceder } = campos(peticion);
    this.como(sesion, responder, (yoId) => {
      if (typeof participanteId !== 'string') return { ok: false, error: 'Esa persona ya no es visitante de la sala.' };
      if (typeof conceder !== 'boolean') return { ok: false, error: 'Respuesta desconocida.' };
      return this.participantesService.accesoGrimorio(yoId, participanteId, conceder);
    });
  };

  hacerseNarrador = (sesion: Sesion, _peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    this.como(sesion, responder, (yoId) => this.participantesService.hacerseNarrador(yoId));
  };

  dejarDeNarrar = (sesion: Sesion, _peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    this.como(sesion, responder, (yoId) => this.participantesService.dejarDeNarrar(yoId));
  };

  /** Sobre otro participante: { participanteId }. */
  nombrarNarrador = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    this.sobreOtro(sesion, peticion, responder, (yoId, id) => this.participantesService.nombrarNarrador(yoId, id));
  };

  quitarNarrador = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    this.sobreOtro(sesion, peticion, responder, (yoId, id) => this.participantesService.quitarNarrador(yoId, id));
  };

  levantarJugador = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    this.sobreOtro(sesion, peticion, responder, (yoId, id) => this.participantesService.levantarJugador(yoId, id));
  };

  expulsar = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    this.sobreOtro(sesion, peticion, responder, (yoId, id) => this.participantesService.expulsar(yoId, id));
  };

  /** Los asientos: { cambio: 'añadir' | 'quitar' | 'mezclar' } o { cambio: 'mover', desde, hasta }. */
  asientos = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const cambio = cambioAsientos(peticion);
    this.como(sesion, responder, (yoId) =>
      cambio ? this.participantesService.asientos(yoId, cambio) : { ok: false, error: 'Cambio de asientos desconocido.' },
    );
  };

  /** Lo que se hace sobre otro participante: { participanteId }. */
  private sobreOtro(
    sesion: Sesion,
    peticion: unknown,
    responder: Responder<ResultadoAccion>,
    hacer: (yoId: string, participanteId: string) => ResultadoAccion,
  ): void {
    const { participanteId } = campos(peticion);
    this.como(sesion, responder, (yoId) => (typeof participanteId === 'string' ? hacer(yoId, participanteId) : FUERA_DE_LA_SALA));
  }

  private como<R>(sesion: Sesion, responder: Responder<R | Fallo>, hacer: (yoId: string) => R | Fallo): void {
    como((clave) => this.participantesService.quienEs(clave), sesion, responder, hacer);
  }
}
