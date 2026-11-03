import type { CambiosAjustes } from '../../models/partida/Configuracion';
import type { PreparacionService } from '../../services/sala/PreparacionService';
import type { Responder } from '../../services/sala/SalaService';
import type { ResultadoAccion } from '../../views/dto/sala';
import { campos, como, comoAsincrono, type Fallo } from './peticion';
import type { Sesion } from './SalaController';

const AJUSTE_DESCONOCIDO: Fallo = { ok: false, error: 'Ajuste desconocido.' };

/** Los ajustes que llegan, si son del tipo que toca (lo que no viene, no se cambia); si no, null. */
function ajustes(peticion: unknown): CambiosAjustes | null {
  const { grimorioJugadores, segundosPorFicha, mensajes, ocultarCamarasConversacion } = campos(peticion);
  const cambios: CambiosAjustes = {};
  if (grimorioJugadores !== undefined) {
    if (typeof grimorioJugadores !== 'boolean') return null;
    cambios.grimorioJugadores = grimorioJugadores;
  }
  if (segundosPorFicha !== undefined) {
    if (typeof segundosPorFicha !== 'number') return null;
    cambios.segundosPorFicha = segundosPorFicha;
  }
  if (mensajes !== undefined) {
    if (typeof mensajes !== 'string') return null;
    cambios.mensajes = mensajes as CambiosAjustes['mensajes'];
  }
  if (ocultarCamarasConversacion !== undefined) {
    if (typeof ocultarCamarasConversacion !== 'boolean') return null;
    cambios.ocultarCamarasConversacion = ocultarCamarasConversacion;
  }
  return cambios;
}

/**
 * La preparación de la partida (hoy por WebSocket, ver infra/socketio): cada método
 * lee una petición, se la pasa a PreparacionService y contesta. Lo que cambia le
 * llega a cada uno con la sala, por el difusor.
 */
export class PreparacionController {
  constructor(private readonly preparacionService: PreparacionService) {}

  /**
   * Ajustes de la partida: cualquiera de { grimorioJugadores: boolean, segundosPorFicha:
   * número, mensajes: 'ninguno' | 'vecinos' | 'todos', ocultarCamarasConversacion: boolean }.
   */
  configurar = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const cambios = ajustes(peticion);
    this.como(sesion, responder, (yoId) => (cambios ? this.preparacionService.configurar(yoId, cambios) : AJUSTE_DESCONOCIDO));
  };

  /** Abre o cierra los privados: { abiertos: boolean }. */
  privados = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { abiertos } = campos(peticion);
    this.como(sesion, responder, (yoId) =>
      typeof abiertos === 'boolean' ? this.preparacionService.privados(yoId, abiertos) : { ok: false, error: 'Estado desconocido.' },
    );
  };

  /** Carga un guion: { predeterminado: id } o { json: texto del archivo, archivo?: su nombre }. */
  guion = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { predeterminado, json, archivo } = campos(peticion);
    const pedido = typeof predeterminado === 'string' ? { predeterminado } : { json, archivo: typeof archivo === 'string' ? archivo : undefined };
    comoAsincrono((clave) => this.preparacionService.quienEs(clave), sesion, responder, (yoId) => this.preparacionService.guion(yoId, pedido));
  };

  /** Cambia el fondo: { predeterminado: true }, { imagen: data URL } o { biblioteca: id de la versión }. */
  fondo = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { predeterminado, imagen, biblioteca } = campos(peticion);
    comoAsincrono((clave) => this.preparacionService.quienEs(clave), sesion, responder, async (yoId) => {
      if (predeterminado === true) return this.preparacionService.fondo(yoId, { predeterminado: true });
      if (imagen !== undefined) return this.preparacionService.fondo(yoId, { imagen });
      if (typeof biblioteca === 'string') return this.preparacionService.fondo(yoId, { biblioteca });
      return { ok: false, error: 'Fondo desconocido.' };
    });
  };

  /** Pone o quita un NPC: { personajeId }. */
  npc = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { personajeId } = campos(peticion);
    this.como(sesion, responder, (yoId) =>
      typeof personajeId === 'string' ? this.preparacionService.npc(yoId, personajeId) : { ok: false, error: 'Ese personaje no existe.' },
    );
  };

  /** Las reglas del Bootlegger: { reglas: string[] | null } (lo que no es texto, fuera). */
  bootlegger = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { reglas } = campos(peticion);
    this.como(sesion, responder, (yoId) => {
      if (reglas === null) return this.preparacionService.bootlegger(yoId, null);
      if (!Array.isArray(reglas)) return { ok: false, error: 'Reglas desconocidas.' };
      return this.preparacionService.bootlegger(yoId, reglas.filter((r): r is string => typeof r === 'string'));
    });
  };

  /** El personaje del Storm Catcher: { personajeId: string | null }. */
  stormcatcher = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { personajeId } = campos(peticion);
    this.como(sesion, responder, (yoId) =>
      personajeId === null || typeof personajeId === 'string'
        ? this.preparacionService.stormcatcher(yoId, personajeId)
        : { ok: false, error: 'El Storm Catcher nombra un personaje bueno (aldeano o forastero).' },
    );
  };

  /** Pide silencio o lo levanta: { activo: boolean }. */
  silencio = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { activo } = campos(peticion);
    this.como(sesion, responder, (yoId) =>
      typeof activo === 'boolean' ? this.preparacionService.silencio(yoId, activo) : { ok: false, error: 'Petición desconocida.' },
    );
  };

  asignarPersonajes = (sesion: Sesion, _peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    this.como(sesion, responder, (yoId) => this.preparacionService.asignarPersonajes(yoId));
  };

  entregarFichas = (sesion: Sesion, _peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    this.como(sesion, responder, (yoId) => this.preparacionService.entregarFichas(yoId));
  };

  private como<R>(sesion: Sesion, responder: Responder<R | Fallo>, hacer: (yoId: string) => R | Fallo): void {
    como((clave) => this.preparacionService.quienEs(clave), sesion, responder, hacer);
  }
}
