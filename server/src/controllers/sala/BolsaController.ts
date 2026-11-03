import type { BolsaService } from '../../services/sala/BolsaService';
import type { Responder } from '../../services/sala/SalaService';
import type { ResultadoAccion, ResultadoBolsaAlAzar } from '../../views/dto/sala';
import type { Sesion } from './SalaController';

/** Los campos de una petición; si no es un objeto, ninguno. */
const campos = (peticion: unknown): Record<string, unknown> =>
  typeof peticion === 'object' && peticion !== null ? (peticion as Record<string, unknown>) : {};

type Fallo = { ok: false; error: string };
const FUERA: Fallo = { ok: false, error: 'Ya no estás en la sala.' };
const PERSONAJE_DESCONOCIDO: Fallo = { ok: false, error: 'Ese personaje no va en la bolsa.' };

/**
 * La bolsa de la sala (hoy por WebSocket, ver infra/socketio): cada método lee una
 * petición, se la pasa a BolsaService y contesta. Lo que cambia le llega a cada uno
 * con la sala, por el difusor.
 */
export class BolsaController {
  constructor(private readonly bolsaService: BolsaService) {}

  /** Mete un personaje en la bolsa o lo saca: { personajeId }. */
  meter = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { personajeId } = campos(peticion);
    this.como(sesion, responder, (yoId) =>
      typeof personajeId === 'string' ? this.bolsaService.meter(yoId, personajeId) : PERSONAJE_DESCONOCIDO,
    );
  };

  /** Cuántas fichas de un personaje: { personajeId, cantidad }. */
  cantidad = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { personajeId, cantidad } = campos(peticion);
    this.como(sesion, responder, (yoId) => {
      if (typeof personajeId !== 'string') return PERSONAJE_DESCONOCIDO;
      if (typeof cantidad !== 'number') return { ok: false, error: 'Cantidad desconocida.' };
      return this.bolsaService.cantidad(yoId, personajeId, cantidad);
    });
  };

  vaciar = (sesion: Sesion, _peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    this.como(sesion, responder, (yoId) => this.bolsaService.vaciar(yoId));
  };

  llenarAlAzar = (sesion: Sesion, _peticion: unknown, responder: Responder<ResultadoBolsaAlAzar>): void => {
    this.como(sesion, responder, (yoId) => this.bolsaService.llenarAlAzar(yoId));
  };

  /** Da por bueno el reparto (su firma, «7:5/0/1/1») o deja de darlo: { firma: string | null }. */
  aceptarReparto = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { firma } = campos(peticion);
    this.como(sesion, responder, (yoId) =>
      firma === null || (typeof firma === 'string' && firma.length <= 100)
        ? this.bolsaService.aceptarReparto(yoId, firma)
        : { ok: false, error: 'Reparto desconocido.' },
    );
  };

  /** Hace falta seguir en la sala: lo pide como ese participante y contesta. */
  private como<R>(sesion: Sesion, responder: Responder<R | Fallo>, hacer: (yoId: string) => R | Fallo): void {
    const yoId = this.bolsaService.quienEs(sesion.clave);
    responder(yoId ? hacer(yoId) : FUERA);
  }
}
