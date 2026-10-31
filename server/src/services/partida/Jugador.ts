import { randomUUID } from 'crypto';
import type { SalaAlineamiento, SalaRecordatorio } from '../../contrato/sala';

/**
 * Quién juega a un jugador: una persona de la sala (un participante sentado) o
 * nadie (un asiento libre: el jugador sigue en la partida y el narrador decide por él).
 */
export type Ocupante = { tipo: 'humano'; participanteId: string } | { tipo: 'vacio' };

const VACIO: Ocupante = { tipo: 'vacio' };

/**
 * Un jugador de la partida: lo que hace falta para jugar a Clocktower (su
 * personaje, si está vivo, si le queda voto…), lo juegue quien lo juegue. No es
 * una persona: cuando alguien se sienta o se levanta solo cambia su ocupante, y
 * al cambiarse de silla se lleva al jugador con él. No anota nada en el diario
 * ni comprueba permisos (lo hace el Grimorio).
 */
export class Jugador {
  /** Lo identifica en la plaza: lo que se guarda por él va con él al cambiar de silla. */
  readonly id: string = randomUUID();
  ocupante: Ocupante = VACIO;
  /** El personaje de su ficha (id del catálogo o del guion), o null si no tiene. */
  personaje: string | null = null;
  /** Su alineamiento si el narrador lo ha cambiado; null: el de su tipo (ver Grimorio.alineamiento). */
  alineamiento: SalaAlineamiento | null = null;
  /** Está muerto (lleva sudario). */
  muerto = false;
  /** Muerto de noche, a falta de que el narrador lo anuncie: aún no cuenta como muerto. */
  muertePendiente = false;
  /** Muerto, ya ha gastado el único voto que le queda. Al morir o revivir vuelve a false. */
  votoGastado = false;
  /**
   * Las fichas recordatorio que el narrador le ha puesto, en el orden en que se
   * pusieron: su estado en el grimorio («Poisoned», «Is The Drunk», «No Ability»…).
   */
  recordatorios: SalaRecordatorio[] = [];

  /** El participante que lo juega, o null (nadie). */
  get participanteId(): string | null {
    return this.ocupante.tipo === 'humano' ? this.ocupante.participanteId : null;
  }

  sentar(participanteId: string): void {
    this.ocupante = { tipo: 'humano', participanteId };
  }

  levantar(): void {
    this.ocupante = VACIO;
  }

  /**
   * Muere. De noche, si estaba vivo, la muerte queda pendiente (ver muertePendiente).
   * Devuelve si ha muerto ya (false: queda pendiente).
   */
  morir(deNoche: boolean): boolean {
    if (deNoche && !this.muerto) {
      this.muertePendiente = true;
      return false;
    }
    // Al morir tiene su voto
    if (!this.muerto) this.votoGastado = false;
    this.muerto = true;
    this.muertePendiente = false;
    return true;
  }

  /** Revive (también si su muerte estaba pendiente) y, si estaba muerto, recupera su voto. */
  revivir(): void {
    if (this.muerto) this.votoGastado = false;
    this.muerto = false;
    this.muertePendiente = false;
  }

  /** La muerte pendiente se hace efectiva (el narrador la anuncia). false si no la tenía. */
  confirmarMuerte(): boolean {
    if (!this.muertePendiente) return false;
    this.muertePendiente = false;
    this.muerto = true;
    this.votoGastado = false;
    return true;
  }

  /** Gasta o recupera el voto de un muerto. false si no está muerto. */
  cambiarVoto(gastado: boolean): boolean {
    if (!this.muerto) return false;
    this.votoGastado = gastado;
    return true;
  }

  /** Otra partida: vivo, sin personaje, con su voto y sin recordatorios. Quien lo juega sigue. */
  nuevaPartida(): void {
    this.recordatorios = [];
    this.personaje = null;
    this.alineamiento = null;
    this.muerto = false;
    this.muertePendiente = false;
    this.votoGastado = false;
  }
}
