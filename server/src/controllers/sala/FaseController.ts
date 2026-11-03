import type { FaseService } from '../../services/sala/FaseService';
import type { Responder } from '../../services/sala/SalaService';
import type { ResultadoAccion } from '../../views/dto/sala';
import { como, type Fallo } from './peticion';
import type { Sesion } from './SalaController';

/**
 * El paso de las fases de la partida (hoy por WebSocket, ver infra/socketio): cada
 * método se lo pide a FaseService y contesta (no llevan datos). Lo que cambia le
 * llega a cada uno con la sala, por el difusor.
 */
export class FaseController {
  constructor(private readonly faseService: FaseService) {}

  irANoche = (sesion: Sesion, _peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    this.como(sesion, responder, (yoId) => this.faseService.irANoche(yoId));
  };

  amanecer = (sesion: Sesion, _peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    this.como(sesion, responder, (yoId) => this.faseService.amanecer(yoId));
  };

  volverAtras = (sesion: Sesion, _peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    this.como(sesion, responder, (yoId) => this.faseService.volverAtras(yoId));
  };

  limpiarGrimorio = (sesion: Sesion, _peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    this.como(sesion, responder, (yoId) => this.faseService.limpiarGrimorio(yoId));
  };

  private como<R>(sesion: Sesion, responder: Responder<R | Fallo>, hacer: (yoId: string) => R | Fallo): void {
    como((clave) => this.faseService.quienEs(clave), sesion, responder, hacer);
  }
}
