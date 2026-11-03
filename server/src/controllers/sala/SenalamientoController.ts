import type { Responder } from '../../services/sala/SalaService';
import type { SenalamientoService } from '../../services/sala/SenalamientoService';
import type { ResultadoAccion } from '../../views/dto/sala';
import { campos, como, type Fallo } from './peticion';
import type { Sesion } from './SalaController';

const ASIENTO_DESCONOCIDO: Fallo = { ok: false, error: 'Alguno de esos asientos ya no existe.' };

/** Una lista de ids de asiento (sin ella, ninguno: todos), o null si no lo es. */
const asientos = (valor: unknown): string[] | null =>
  valor === undefined ? [] : Array.isArray(valor) && valor.every((id) => typeof id === 'string') ? valor : null;

/**
 * Los señalamientos de la sala (hoy por WebSocket, ver infra/socketio): cada método
 * lee una petición, se la pasa a SenalamientoService y contesta. Lo que cambia le
 * llega a cada uno con la sala, por el difusor.
 */
export class SenalamientoController {
  constructor(private readonly senalamientoService: SenalamientoService) {}

  /** Empieza un señalamiento: { mensaje?, segundos: number | null, senaladores?: jugadorId[], objetivos?: jugadorId[] }. */
  empezar = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { mensaje, segundos, senaladores, objetivos } = campos(peticion);
    this.como(sesion, responder, (yoId) => {
      if (segundos !== null && typeof segundos !== 'number') return { ok: false, error: 'Indica cuántos segundos dura la cuenta atrás.' };
      if (mensaje !== undefined && typeof mensaje !== 'string') return { ok: false, error: 'Mensaje no válido.' };
      const quienes = asientos(senaladores);
      const a = asientos(objetivos);
      if (!quienes || !a) return ASIENTO_DESCONOCIDO;
      return this.senalamientoService.empezar(yoId, { mensaje: mensaje ?? '', segundos, senaladores: quienes, objetivos: a });
    });
  };

  lilmonsta = (sesion: Sesion, _peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    this.como(sesion, responder, (yoId) => this.senalamientoService.lilmonsta(yoId));
  };

  terminar = (sesion: Sesion, _peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    this.como(sesion, responder, (yoId) => this.senalamientoService.terminar(yoId));
  };

  /** Señala a un asiento o deja de señalar: { jugadorId: string | null }. */
  senalar = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { jugadorId } = campos(peticion);
    this.como(sesion, responder, (yoId) =>
      jugadorId === null || typeof jugadorId === 'string'
        ? this.senalamientoService.senalar(yoId, jugadorId)
        : { ok: false, error: 'Ese asiento ya no existe.' },
    );
  };

  private como<R>(sesion: Sesion, responder: Responder<R | Fallo>, hacer: (yoId: string) => R | Fallo): void {
    como((clave) => this.senalamientoService.quienEs(clave), sesion, responder, hacer);
  }
}
