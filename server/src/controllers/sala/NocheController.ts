import type { BorradorDespertar } from '../../models/partida/mensajeDespertar';
import type { NocheService } from '../../services/sala/NocheService';
import type { Responder } from '../../services/sala/SalaService';
import type { ResultadoAccion } from '../../views/dto/sala';
import { campos, como, type Fallo } from './peticion';
import type { Sesion } from './SalaController';

const ASIENTO_DESCONOCIDO: Fallo = { ok: false, error: 'Ese asiento ya no existe.' };
const SIN_HABILIDAD: Fallo = { ok: false, error: 'Ese personaje no se despierta solo.' };

/** Un texto, o nada si no lo es. */
const texto = (valor: unknown): string | undefined => (typeof valor === 'string' ? valor : undefined);
/** Una lista de textos, o nada si no lo es. */
const textos = (valor: unknown): string[] | undefined =>
  Array.isArray(valor) && valor.every((v) => typeof v === 'string') ? valor : undefined;

/** Lo que se quiere mandar a un despertar: lo que no es del tipo que toca, como si no estuviera (el dominio dice qué falta). */
function borrador(peticion: unknown): BorradorDespertar {
  const { ficha, tarjeta, jugadores, personajes, texto: escrito, alineamiento } = campos(peticion);
  return {
    ficha: texto(ficha),
    tarjeta: texto(tarjeta),
    jugadores: textos(jugadores),
    personajes: textos(personajes),
    texto: texto(escrito),
    alineamiento: texto(alineamiento),
  };
}

/**
 * La noche (hoy por WebSocket, ver infra/socketio): cada método lee una petición,
 * se la pasa a NocheService y contesta. Lo que cambia le llega a cada uno con la
 * sala, por el difusor.
 */
export class NocheController {
  constructor(private readonly nocheService: NocheService) {}

  /** Abre el despertar de un asiento: { jugadorId }. */
  despertar = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { jugadorId } = campos(peticion);
    this.como(sesion, responder, (yoId) => (typeof jugadorId === 'string' ? this.nocheService.despertar(yoId, jugadorId) : ASIENTO_DESCONOCIDO));
  };

  /**
   * Un mensaje en un despertar: { jugadorId | jugadorIds (solo el narrador), ficha |
   * tarjeta, jugadores?, personajes?, texto?, alineamiento? } (según lo que lleve).
   */
  enviar = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { jugadorId, jugadorIds } = campos(peticion);
    // A varios (sin repetir) o, si no, a uno
    const destinos = Array.isArray(jugadorIds) ? [...new Set(textos(jugadorIds) ?? [])] : typeof jugadorId === 'string' ? [jugadorId] : [];
    this.como(sesion, responder, (yoId) => this.nocheService.enviar(yoId, destinos, borrador(peticion)));
  };

  /** El despertar guiado de una fila del orden de noche: { personajeId }. */
  despertarHabilidad = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { personajeId } = campos(peticion);
    this.como(sesion, responder, (yoId) =>
      typeof personajeId === 'string' ? this.nocheService.despertarHabilidad(yoId, personajeId) : SIN_HABILIDAD,
    );
  };

  /** El despertar guiado, revisado: { personajeId, ficha | tarjeta, jugadores?, personajes?, texto?, alineamiento? }. */
  resolverHabilidad = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { personajeId } = campos(peticion);
    this.como(sesion, responder, (yoId) =>
      typeof personajeId === 'string' ? this.nocheService.resolverHabilidad(yoId, personajeId, borrador(peticion)) : SIN_HABILIDAD,
    );
  };

  /** El nuevo Imp: { jugadorId }. */
  nuevoImp = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { jugadorId } = campos(peticion);
    this.como(sesion, responder, (yoId) => (typeof jugadorId === 'string' ? this.nocheService.nuevoImp(yoId, jugadorId) : ASIENTO_DESCONOCIDO));
  };

  /** La estrella de una fila del orden de noche: { id: personaje del guion | 'esbirros' | 'demonios', activo }. */
  recordatorio = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { id, activo } = campos(peticion);
    this.como(sesion, responder, (yoId) => {
      if (typeof id !== 'string') return { ok: false, error: 'Ese personaje no está en el guion.' };
      if (typeof activo !== 'boolean') return { ok: false, error: 'Estado desconocido.' };
      return this.nocheService.recordatorio(yoId, id, activo);
    });
  };

  private como<R>(sesion: Sesion, responder: Responder<R | Fallo>, hacer: (yoId: string) => R | Fallo): void {
    como((clave) => this.nocheService.quienEs(clave), sesion, responder, hacer);
  }
}
