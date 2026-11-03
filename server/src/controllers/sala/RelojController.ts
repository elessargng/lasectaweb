import type { RelojService } from '../../services/sala/RelojService';
import type { Responder } from '../../services/sala/SalaService';
import type { ResultadoAccion } from '../../views/dto/sala';
import { campos, como, type Fallo } from './peticion';
import type { Sesion } from './SalaController';

/**
 * El gong y el reloj del narrador (hoy por WebSocket, ver infra/socketio): cada
 * método lee una petición, se la pasa a RelojService y contesta. Lo que cambia le
 * llega a cada uno con la sala, por el difusor.
 */
export class RelojController {
  constructor(private readonly relojService: RelojService) {}

  sonarGong = (sesion: Sesion, _peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    this.como(sesion, responder, (yoId) => this.relojService.sonarGong(yoId));
  };

  /** Pone el reloj: { segundos, mensaje? }. */
  poner = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { segundos, mensaje } = campos(peticion);
    this.como(sesion, responder, (yoId) => {
      if (typeof segundos !== 'number') return { ok: false, error: 'Indica cuánto dura el reloj.' };
      if (mensaje !== undefined && typeof mensaje !== 'string') return { ok: false, error: 'Mensaje no válido.' };
      return this.relojService.poner(yoId, segundos, mensaje ?? '');
    });
  };

  terminar = (sesion: Sesion, _peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    this.como(sesion, responder, (yoId) => this.relojService.terminar(yoId));
  };

  quitar = (sesion: Sesion, _peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    this.como(sesion, responder, (yoId) => this.relojService.quitar(yoId));
  };

  private como<R>(sesion: Sesion, responder: Responder<R | Fallo>, hacer: (yoId: string) => R | Fallo): void {
    como((clave) => this.relojService.quienEs(clave), sesion, responder, hacer);
  }
}
