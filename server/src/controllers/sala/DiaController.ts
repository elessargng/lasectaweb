import type { DiaService } from '../../services/sala/DiaService';
import type { Responder } from '../../services/sala/SalaService';
import type { ResultadoAccion } from '../../views/dto/sala';
import { campos, como, type Fallo } from './peticion';
import type { Sesion } from './SalaController';

const ASIENTO_DESCONOCIDO: Fallo = { ok: false, error: 'Ese asiento ya no existe.' };

/**
 * El día (hoy por WebSocket, ver infra/socketio): cada método lee una petición, se
 * la pasa a DiaService y contesta. Lo que cambia le llega a cada uno con la sala,
 * por el difusor.
 */
export class DiaController {
  constructor(private readonly diaService: DiaService) {}

  /** Da la palabra: { participanteId | null }. */
  darPalabra = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { participanteId } = campos(peticion);
    this.como(sesion, responder, (yoId) =>
      participanteId === null || typeof participanteId === 'string'
        ? this.diaService.darPalabra(yoId, participanteId)
        : { ok: false, error: 'Esa persona ya no está en la sala.' },
    );
  };

  /** Nomina: { desde, hasta (ids de asiento), comoAldeano? }. */
  nominar = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { desde, hasta, comoAldeano } = campos(peticion);
    this.como(sesion, responder, (yoId) =>
      typeof desde === 'string' && typeof hasta === 'string'
        ? this.diaService.nominar(yoId, desde, hasta, typeof comoAldeano === 'boolean' ? comoAldeano : undefined)
        : ASIENTO_DESCONOCIDO,
    );
  };

  cerrarNominacion = (sesion: Sesion, _peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    this.como(sesion, responder, (yoId) => this.diaService.cerrarNominacion(yoId));
  };

  /** Los votos que hacen falta: { votos: number | null }. */
  votosNecesarios = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { votos } = campos(peticion);
    this.como(sesion, responder, (yoId) =>
      votos === null || typeof votos === 'number'
        ? this.diaService.votosNecesarios(yoId, votos)
        : { ok: false, error: 'Indica cuántos votos hacen falta.' },
    );
  };

  cuentaAtras = (sesion: Sesion, _peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    this.como(sesion, responder, (yoId) => this.diaService.cuentaAtras(yoId));
  };

  reiniciarVotacion = (sesion: Sesion, _peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    this.como(sesion, responder, (yoId) => this.diaService.reiniciarVotacion(yoId));
  };

  /** La calavera: { jugadorId, marcado: boolean, cerrarNominacion?: boolean (por defecto, sí) }. */
  marcar = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { jugadorId, marcado, cerrarNominacion } = campos(peticion);
    this.como(sesion, responder, (yoId) => {
      if (typeof jugadorId !== 'string') return ASIENTO_DESCONOCIDO;
      if (typeof marcado !== 'boolean') return { ok: false, error: 'Estado desconocido.' };
      return this.diaService.marcar(yoId, jugadorId, marcado, cerrarNominacion !== false);
    });
  };

  desmarcar = (sesion: Sesion, _peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    this.como(sesion, responder, (yoId) => this.diaService.desmarcar(yoId));
  };

  /** Ejecuta a quien lleva la calavera: { jugadorId }. */
  ejecutar = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { jugadorId } = campos(peticion);
    this.como(sesion, responder, (yoId) => (typeof jugadorId === 'string' ? this.diaService.ejecutar(yoId, jugadorId) : ASIENTO_DESCONOCIDO));
  };

  private como<R>(sesion: Sesion, responder: Responder<R | Fallo>, hacer: (yoId: string) => R | Fallo): void {
    como((clave) => this.diaService.quienEs(clave), sesion, responder, hacer);
  }
}
