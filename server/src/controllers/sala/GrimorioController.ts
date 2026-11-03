import type { BorradorFicha, BorradorRecordatorio } from '../../models/partida/grimorioEnviado';
import type { GrimorioService } from '../../services/sala/GrimorioService';
import type { Responder } from '../../services/sala/SalaService';
import type { ResultadoAccion } from '../../views/dto/sala';
import { campos, como, type Fallo } from './peticion';
import type { Sesion } from './SalaController';

const ASIENTO_DESCONOCIDO: Fallo = { ok: false, error: 'Ese asiento ya no existe.' };
const ESTADO_DESCONOCIDO: Fallo = { ok: false, error: 'Estado desconocido.' };

/** Un texto o, si no lo es, vacío: el dominio lo rechaza como a cualquier id que no existe, con su mensaje. */
const cadena = (valor: unknown): string => (typeof valor === 'string' ? valor : '');
/** Un texto, o nada si no lo es. */
const texto = (valor: unknown): string | undefined => (typeof valor === 'string' ? valor : undefined);

/** Un recordatorio de una ficha que se envía: lo que no es del tipo que toca, como si no estuviera. */
function recordatorio(valor: unknown): BorradorRecordatorio {
  const { personaje, indice, texto: escrito, icono } = campos(valor);
  return { personaje: texto(personaje), indice: typeof indice === 'number' ? indice : undefined, texto: texto(escrito), icono };
}

/** Una ficha que se envía: lo que no es del tipo que toca, como si no estuviera (el dominio dice qué falta). */
function ficha(valor: unknown): BorradorFicha {
  const { jugadorId, personaje, alineamiento, muerto, recordatorios } = campos(valor);
  return {
    jugadorId: texto(jugadorId),
    personaje: personaje === null ? null : texto(personaje),
    alineamiento: texto(alineamiento),
    muerto: muerto === true,
    recordatorios: Array.isArray(recordatorios) ? recordatorios.map(recordatorio) : [],
  };
}

/**
 * El grimorio del narrador (hoy por WebSocket, ver infra/socketio): cada método lee
 * una petición, se la pasa a GrimorioService y contesta. Lo que cambia le llega a
 * cada uno con la sala, por el difusor.
 */
export class GrimorioController {
  constructor(private readonly grimorioService: GrimorioService) {}

  /** El personaje de una ficha: { jugadorId, personajeId: string | null }. */
  personaje = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { jugadorId, personajeId } = campos(peticion);
    this.como(sesion, responder, (yoId) => this.grimorioService.personaje(yoId, cadena(jugadorId), personajeId === null ? null : cadena(personajeId)));
  };

  /** Intercambia dos fichas: { desde, hasta } (ids de asiento). */
  intercambiar = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { desde, hasta } = campos(peticion);
    this.como(sesion, responder, (yoId) =>
      typeof desde === 'string' && typeof hasta === 'string' ? this.grimorioService.intercambiar(yoId, desde, hasta) : ASIENTO_DESCONOCIDO,
    );
  };

  /** El alineamiento de una ficha: { jugadorId, alineamiento: 'bueno' | 'malvado' }. */
  alineamiento = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { jugadorId, alineamiento } = campos(peticion);
    this.como(sesion, responder, (yoId) => {
      if (typeof jugadorId !== 'string') return ASIENTO_DESCONOCIDO;
      if (alineamiento !== 'bueno' && alineamiento !== 'malvado') return { ok: false, error: 'Alineamiento desconocido.' };
      return this.grimorioService.alineamiento(yoId, jugadorId, alineamiento);
    });
  };

  /** Mata o revive: { jugadorId, muerto: boolean }. */
  vida = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { jugadorId, muerto } = campos(peticion);
    this.como(sesion, responder, (yoId) => {
      if (typeof jugadorId !== 'string') return ASIENTO_DESCONOCIDO;
      if (typeof muerto !== 'boolean') return ESTADO_DESCONOCIDO;
      return this.grimorioService.vida(yoId, jugadorId, muerto);
    });
  };

  /** Anuncia una muerte pendiente: { jugadorId }. */
  confirmarMuerte = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { jugadorId } = campos(peticion);
    this.como(sesion, responder, (yoId) => (typeof jugadorId === 'string' ? this.grimorioService.confirmarMuerte(yoId, jugadorId) : ASIENTO_DESCONOCIDO));
  };

  /** El voto de un muerto: { jugadorId, gastado: boolean }. */
  voto = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { jugadorId, gastado } = campos(peticion);
    this.como(sesion, responder, (yoId) => {
      if (typeof jugadorId !== 'string') return ASIENTO_DESCONOCIDO;
      if (typeof gastado !== 'boolean') return ESTADO_DESCONOCIDO;
      return this.grimorioService.voto(yoId, jugadorId, gastado);
    });
  };

  barquero = (sesion: Sesion, _peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    this.como(sesion, responder, (yoId) => this.grimorioService.barquero(yoId));
  };

  /** Pone un recordatorio de un personaje: { jugadorId, personajeId, indice }. */
  recordatorio = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { jugadorId, personajeId, indice } = campos(peticion);
    this.como(sesion, responder, (yoId) =>
      this.grimorioService.recordatorio(yoId, cadena(jugadorId), cadena(personajeId), typeof indice === 'number' ? indice : NaN),
    );
  };

  /** Pone un recordatorio con texto propio: { jugadorId, texto, icono? }. */
  recordatorioTexto = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { jugadorId, texto: escrito, icono } = campos(peticion);
    this.como(sesion, responder, (yoId) => this.grimorioService.recordatorioTexto(yoId, cadena(jugadorId), cadena(escrito), icono));
  };

  /** Quita un recordatorio: { jugadorId, recordatorioId }. */
  quitarRecordatorio = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { jugadorId, recordatorioId } = campos(peticion);
    this.como(sesion, responder, (yoId) =>
      typeof jugadorId === 'string' && typeof recordatorioId === 'string'
        ? this.grimorioService.quitarRecordatorio(yoId, jugadorId, recordatorioId)
        : { ok: false, error: 'Petición desconocida.' },
    );
  };

  /** Escribe la nota de un asiento: { jugadorId, texto }. */
  nota = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { jugadorId, texto: escrito } = campos(peticion);
    this.como(sesion, responder, (yoId) => (typeof jugadorId === 'string' ? this.grimorioService.nota(yoId, jugadorId, cadena(escrito)) : ASIENTO_DESCONOCIDO));
  };

  /** Borra la nota de un asiento: { jugadorId }. */
  borrarNota = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { jugadorId } = campos(peticion);
    this.como(sesion, responder, (yoId) =>
      typeof jugadorId === 'string' ? this.grimorioService.borrarNota(yoId, jugadorId) : { ok: false, error: 'Petición desconocida.' },
    );
  };

  /** Envía un grimorio: { jugadorId, fichas: FichaEnviadaDto[], faroles?: string[] }. */
  enviar = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { jugadorId, fichas, faroles = [] } = campos(peticion);
    this.como(sesion, responder, (yoId) => {
      if (typeof jugadorId !== 'string') return ASIENTO_DESCONOCIDO;
      if (!Array.isArray(fichas)) return { ok: false, error: 'El grimorio no es válido.' };
      if (!Array.isArray(faroles) || faroles.some((id) => typeof id !== 'string')) return { ok: false, error: 'Los faroles no son válidos.' };
      return this.grimorioService.enviar(yoId, jugadorId, fichas.map(ficha), faroles);
    });
  };

  private como<R>(sesion: Sesion, responder: Responder<R | Fallo>, hacer: (yoId: string) => R | Fallo): void {
    como((clave) => this.grimorioService.quienEs(clave), sesion, responder, hacer);
  }
}
