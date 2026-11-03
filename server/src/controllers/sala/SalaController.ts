import type { SalaLlegada } from '../../models/sala/Participantes';
import type { Responder, SalaService } from '../../services/sala/SalaService';
import type { PaseVideo } from '../../services/videollamada/VideollamadaService';
import type { ResultadoAccion } from '../../views/dto/sala';
import { usuarioDelToken } from '../middlewares/auth';

/** Quién pide algo (como req.user en la API): su clave en la sala y su conexión. */
export interface Sesion {
  clave: string;
  conexion: string;
}

/** Con qué se llega a la sala, ya comprobado: con esto se entra al conectar. */
export interface Credenciales {
  llegada: SalaLlegada;
  clienteId: string | null;
}

/** Los campos de una petición; si no es un objeto, ninguno. */
const campos = (peticion: unknown): Record<string, unknown> =>
  typeof peticion === 'object' && peticion !== null ? (peticion as Record<string, unknown>) : {};

const DESCONOCIDA: ResultadoAccion = { ok: false, error: 'Petición desconocida.' };
const FUERA: ResultadoAccion = { ok: false, error: 'Ya no estás en la sala.' };

/**
 * La sala de juego en tiempo real (hoy por WebSocket, ver infra/socketio): cada
 * método lee una petición, se la pasa a SalaService y contesta. Lo que cambia le
 * llega a cada uno por el difusor, no por aquí.
 */
export class SalaController {
  constructor(private readonly salaService: SalaService) {}

  /**
   * Quien llega trae su token de la web o, sin cuenta, el nombre con el que entra;
   * el nombre y el avatar que prefiere mostrar, si los cambió; y su id de cliente
   * para recuperar el sitio si se reconecta. Aún no entra (ver entrar).
   */
  identificar = async (datos: unknown): Promise<Credenciales | { error: string }> => {
    const { token, nombre, alias, avatar, clienteId } = campos(datos);
    let usuario = null;
    if (typeof token === 'string' && token) {
      usuario = usuarioDelToken(token);
      // El cliente reconoce este error y da la sesión por cerrada.
      if (!usuario) return { error: 'SESION_CADUCADA' };
    }
    const cliente = typeof clienteId === 'string' && clienteId ? clienteId.slice(0, 64) : null;
    const llegada = await this.salaService.llegada({ usuario, nombre, alias, avatar, clienteId: cliente });
    if ('error' in llegada) return llegada;
    return { llegada, clienteId: cliente };
  };

  entrar = (conexion: string, { llegada, clienteId }: Credenciales): Sesion => ({
    clave: this.salaService.conectar(conexion, clienteId, llegada),
    conexion,
  });

  /** Si se va a propósito («Salir»), sale ya. Si no, se le guarda el sitio. */
  salir = ({ clave, conexion }: Sesion, aProposito: boolean): void => {
    this.salaService.desconectar(clave, conexion, aProposito);
  };

  /** Un mensaje de texto: { para: 'general' | 'visitantes' | id de participante, texto }. */
  enviarMensaje = ({ clave }: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { para, texto } = campos(peticion);
    const yo = this.salaService.participanteDe(clave);
    if (!yo || typeof para !== 'string' || typeof texto !== 'string') return responder({ ok: false, error: 'Mensaje desconocido.' });
    this.salaService.enviarMensaje(yo.id, para, texto, responder);
  };

  /** Al cambiar de papel cambia lo que se puede leer: el cliente pide su historial. */
  historial = ({ clave, conexion }: Sesion): void => {
    this.salaService.mandarHistorial(clave, conexion);
  };

  /** El pase a la videollamada: { sala: 'principal' (la plaza) | su conversación privada }. */
  pase = async ({ clave }: Sesion, peticion: unknown, responder: Responder<ResultadoAccion & Partial<PaseVideo>>): Promise<void> => {
    const { sala } = campos(peticion);
    const yo = this.salaService.participanteDe(clave);
    if (!yo || typeof sala !== 'string') return responder(DESCONOCIDA);
    responder(await this.salaService.pase(yo.id, sala));
  };

  // Conversaciones privadas

  invitar = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void =>
    this.conversacion(sesion, peticion, 'con', responder, (yoId, con) => this.salaService.invitar(yoId, con, responder));

  pedirUnirse = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void =>
    this.conversacion(sesion, peticion, 'con', responder, (yoId, con) => this.salaService.pedirUnirse(yoId, con, responder));

  responderInvitacion = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void =>
    this.conversacion(sesion, peticion, 'invitacion', responder, (yoId, invitacion) =>
      this.salaService.responderInvitacion(yoId, invitacion, campos(peticion).aceptar === true, responder),
    );

  cancelarInvitacion = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void =>
    this.conversacion(sesion, peticion, 'invitacion', responder, (yoId, invitacion) =>
      this.salaService.cancelarInvitacion(yoId, invitacion, responder),
    );

  entrarEnConversacion = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void =>
    this.conversacion(sesion, peticion, 'conversacion', responder, (yoId, conversacion) =>
      this.salaService.entrarEnConversacion(yoId, conversacion, responder),
    );

  escucharConversacion = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void =>
    this.conversacion(sesion, peticion, 'conversacion', responder, (yoId, conversacion) =>
      this.salaService.escucharConversacion(yoId, conversacion, responder),
    );

  salirDeConversacion = ({ clave }: Sesion, _peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const yo = this.salaService.participanteDe(clave);
    if (!yo) return responder(FUERA);
    this.salaService.salirDeConversacion(yo.id, responder);
  };

  /** Una petición de conversación: hace falta seguir en la sala y traer ese campo (un texto). */
  private conversacion(
    { clave }: Sesion,
    peticion: unknown,
    campo: string,
    responder: Responder<ResultadoAccion>,
    hacer: (yoId: string, valor: string) => void,
  ): void {
    const yo = this.salaService.participanteDe(clave);
    if (!yo) return responder(FUERA);
    const valor = campos(peticion)[campo];
    if (typeof valor !== 'string') return responder(DESCONOCIDA);
    hacer(yo.id, valor);
  }
}
