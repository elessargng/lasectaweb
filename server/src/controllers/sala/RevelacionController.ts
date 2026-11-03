import type { RevelacionService } from '../../services/sala/RevelacionService';
import type { Responder } from '../../services/sala/SalaService';
import type { ResultadoAccion } from '../../views/dto/sala';
import { campos, como, type Fallo } from './peticion';
import type { Sesion } from './SalaController';

/** Un objeto con todos sus valores de texto (o null si no lo es). */
const deTextos = (valor: unknown): Record<string, string> | null =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor) && Object.values(valor).every((v) => typeof v === 'string')
    ? (valor as Record<string, string>)
    : null;

/**
 * La revelación del grimorio al acabar la partida (hoy por WebSocket, ver
 * infra/socketio): cada método lee una petición, se la pasa a RevelacionService y
 * contesta. Lo que cambia le llega a cada uno con la sala, por el difusor.
 */
export class RevelacionController {
  constructor(private readonly revelacionService: RevelacionService) {}

  /** Revela el grimorio: { ganador: 'bueno' | 'malvado', causas?: string[], esbirros?: { [causa]: jugadorId } }. */
  empezar = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { ganador, causas = [], esbirros = {} } = campos(peticion);
    this.como(sesion, responder, (yoId) => {
      if (ganador !== 'bueno' && ganador !== 'malvado') return { ok: false, error: 'Bando desconocido.' };
      if (!Array.isArray(causas) || causas.some((c) => typeof c !== 'string')) return { ok: false, error: 'Hay un personaje que no está en juego.' };
      const deEsbirro = deTextos(esbirros);
      if (!deEsbirro) return { ok: false, error: 'Esbirros no válidos.' };
      return this.revelacionService.empezar(yoId, ganador, causas as string[], deEsbirro);
    });
  };

  /** Revela la ficha de un asiento: { jugadorId }. */
  revelarFicha = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { jugadorId } = campos(peticion);
    this.como(sesion, responder, (yoId) =>
      typeof jugadorId === 'string'
        ? this.revelacionService.revelarFicha(yoId, jugadorId)
        : { ok: false, error: 'Ese asiento ya no existe.' },
    );
  };

  terminar = (sesion: Sesion, _peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    this.como(sesion, responder, (yoId) => this.revelacionService.terminar(yoId));
  };

  private como<R>(sesion: Sesion, responder: Responder<R | Fallo>, hacer: (yoId: string) => R | Fallo): void {
    como((clave) => this.revelacionService.quienEs(clave), sesion, responder, hacer);
  }
}
