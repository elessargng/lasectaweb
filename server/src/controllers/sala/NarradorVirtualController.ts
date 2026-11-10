import type { NarradorVirtualService } from '../../services/narradorVirtual/NarradorVirtualService';
import type { Responder } from '../../services/sala/SalaService';
import type { ResultadoAccion, ResultadoGuionesNarrables } from '../../views/dto/sala';
import { campos, como, comoAsincrono, type Fallo } from './peticion';
import type { Sesion } from './SalaController';

type Atender = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>) => void;

/**
 * El narrador virtual (hoy por WebSocket, ver infra/socketio): añadirlo, quitarlo y
 * lo que le piden los jugadores de día. Cada método lee una petición, se la pasa a
 * NarradorVirtualService y contesta. Lo que cambia le llega a cada uno con la sala,
 * por el difusor.
 */
export class NarradorVirtualController {
  constructor(private readonly narradorVirtualService: NarradorVirtualService) {}

  /** Los guiones que puede llevar, con cuántos jugadores (ver NarradorVirtualService.guionesNarrables). */
  guiones = (sesion: Sesion, _peticion: unknown, responder: Responder<ResultadoGuionesNarrables>): void => {
    comoAsincrono((clave) => this.narradorVirtualService.quienEs(clave), sesion, responder, (yoId) => this.narradorVirtualService.guionesNarrables(yoId));
  };

  /** Añade un narrador virtual: { narrador, guion, jugadores }. */
  anadir = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { narrador, guion, jugadores } = campos(peticion);
    this.comoAsincrono(sesion, responder, async (yoId) => {
      if (typeof narrador !== 'string') return { ok: false, error: 'Ese narrador virtual aún no está disponible.' };
      if (typeof guion !== 'string') return { ok: false, error: 'Ese guion aún no se puede jugar con narrador virtual.' };
      if (typeof jugadores !== 'number') return { ok: false, error: 'Indica cuántos jugadores hay.' };
      return this.narradorVirtualService.anadir(yoId, { narrador, guion, jugadores });
    });
  };

  quitar = (sesion: Sesion, _peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    como((clave) => this.narradorVirtualService.quienEs(clave), sesion, responder, (yoId) => this.narradorVirtualService.quitarPor(yoId));
  };

  /** Un jugador nomina a otro: { jugadorId } del nominado. */
  nominar = (sesion: Sesion, peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    const { jugadorId } = campos(peticion);
    this.comoAsincrono(sesion, responder, async (yoId) =>
      typeof jugadorId === 'string' ? this.narradorVirtualService.turno(yoId, 'nominar', { jugadorId }) : { ok: false, error: 'Ese asiento ya no existe.' },
    );
  };

  /** Quien nomina termina su acusación. */
  defensa = (sesion: Sesion, _peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    this.comoAsincrono(sesion, responder, (yoId) => this.narradorVirtualService.turno(yoId, 'defensa'));
  };

  /** El nominado termina su defensa. */
  voto = (sesion: Sesion, _peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    this.comoAsincrono(sesion, responder, (yoId) => this.narradorVirtualService.turno(yoId, 'voto'));
  };

  listo = (sesion: Sesion, _peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    this.comoAsincrono(sesion, responder, (yoId) => this.narradorVirtualService.turno(yoId, 'listo'));
  };

  seguirNominando = (sesion: Sesion, _peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    this.comoAsincrono(sesion, responder, (yoId) => this.narradorVirtualService.turno(yoId, 'seguirNominando'));
  };

  /** Quien lo añadió termina su reloj. */
  terminarReloj = (sesion: Sesion, _peticion: unknown, responder: Responder<ResultadoAccion>): void => {
    this.comoAsincrono(sesion, responder, (yoId) => this.narradorVirtualService.terminarReloj(yoId));
  };

  /** Las declaraciones del día que se pueden hacer (cada una con su evento, `declarar:<id>`). */
  declaraciones(): string[] {
    return this.narradorVirtualService.declaraciones();
  }

  /**
   * Cómo se atiende una declaración del día. Lo que lleva depende de cada una (la
   * valida su personaje: ver models/personajes), así que va tal cual.
   */
  declarar(id: string): Atender {
    return (sesion, peticion, responder) =>
      this.comoAsincrono(sesion, responder, (yoId) => this.narradorVirtualService.declarar(yoId, id, peticion));
  }

  private comoAsincrono<R>(sesion: Sesion, responder: Responder<R | Fallo>, hacer: (yoId: string) => Promise<R | Fallo>): void {
    comoAsincrono((clave) => this.narradorVirtualService.quienEs(clave), sesion, responder, hacer);
  }
}
