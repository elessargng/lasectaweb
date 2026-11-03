import type { FarolService } from '../../services/sala/FarolService';
import type { Responder } from '../../services/sala/SalaService';
import type { ResultadoAccion } from '../../views/dto/sala';
import { campos, como, type Fallo } from './peticion';
import type { Sesion } from './SalaController';

/** Una casilla de farol: su posición y el personaje (null: vaciarla), o por qué no se entiende. */
function casilla(peticion: unknown): Fallo | { posicion: number; personajeId: string | null } {
  const { posicion, personajeId } = campos(peticion);
  if (typeof posicion !== 'number') return { ok: false, error: 'Esa casilla de farol no existe.' };
  if (personajeId !== null && typeof personajeId !== 'string') return { ok: false, error: 'Ese personaje no está en el guion.' };
  return { posicion, personajeId };
}

/**
 * Los faroles de la sala (hoy por WebSocket, ver infra/socketio): cada método lee
 * una petición, se la pasa a FarolService y contesta. Lo que cambia le llega a cada
 * uno con la sala, por el difusor.
 */
export class FarolController {
  constructor(private readonly farolService: FarolService) {}

  /** El narrador prepara un farol del demonio: { posicion: 0..2, personajeId: string | null }. */
  preparar = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const farol = casilla(peticion);
    this.como(sesion, responder, (yoId) => ('ok' in farol ? farol : this.farolService.preparar(yoId, farol.posicion, farol.personajeId)));
  };

  /** Un jugador se pone un farol: { posicion: 0..2, personajeId: string | null }. */
  poner = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const farol = casilla(peticion);
    this.como(sesion, responder, (yoId) => ('ok' in farol ? farol : this.farolService.poner(yoId, farol.posicion, farol.personajeId)));
  };

  /** Un jugador dice qué farol usa: { personajeId: string | null }. */
  usar = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { personajeId = null } = campos(peticion);
    this.como(sesion, responder, (yoId) =>
      personajeId === null || typeof personajeId === 'string'
        ? this.farolService.usar(yoId, personajeId)
        : { ok: false, error: 'Personaje desconocido.' },
    );
  };

  /** El jugador despierto copia los que le ha enseñado el narrador: { personajes: id[] }. */
  copiar = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { personajes } = campos(peticion);
    this.como(sesion, responder, (yoId) =>
      Array.isArray(personajes) && personajes.every((id) => typeof id === 'string')
        ? this.farolService.copiar(yoId, personajes)
        : { ok: false, error: 'No hay faroles que copiar.' },
    );
  };

  private como<R>(sesion: Sesion, responder: Responder<R | Fallo>, hacer: (yoId: string) => R | Fallo): void {
    como((clave) => this.farolService.quienEs(clave), sesion, responder, hacer);
  }
}
