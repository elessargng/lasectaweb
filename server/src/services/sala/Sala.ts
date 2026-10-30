import { randomUUID } from 'crypto';
import { barajar } from '../partida/azar';
import { Participantes } from './Participantes';

/** Asientos de la mesa: con cuántos empieza la sala y cuántos puede tener. */
export const SALA_ASIENTOS = { inicial: 7, min: 0, max: 20 };

/** Un asiento de la mesa y quién está sentado en él (id de participante), o null si está libre. */
export interface Asiento {
  id: string;
  ocupante: string | null;
}

/** Un asiento recién puesto: libre. */
const asientoNuevo = (): Asiento => ({ id: randomUUID(), ocupante: null });

/** Cómo se han movido los ocupantes: del asiento de cada clave al de su valor. */
export type OyenteMover = (destino: Map<string, string>) => void;

/**
 * La sala: quién está (narradores, jugadores y visitantes, ver Participantes) y en
 * qué asiento de la mesa se sienta cada jugador. No sabe nada de la partida: al
 * mover a los ocupantes, avisa (alMover) para que la partida lleve sus fichas.
 */
export class Sala {
  readonly participantes = new Participantes();
  private readonly mesa: Asiento[] = Array.from({ length: SALA_ASIENTOS.inicial }, () => asientoNuevo());
  private oyentes: OyenteMover[] = [];

  /**
   * Los asientos, en orden: el primero a las 12 y siguiendo las agujas del reloj.
   * Un asiento solo está ocupado por alguien que sigue en la sala y es jugador: se
   * libera solo cuando el jugador sale, se le acaba la espera de reconexión o
   * cambia de papel.
   */
  asientos(): Asiento[] {
    for (const asiento of this.mesa) {
      if (asiento.ocupante && this.participantes.buscar(asiento.ocupante)?.rol !== 'jugador') asiento.ocupante = null;
    }
    return this.mesa;
  }

  asiento(id: string): Asiento | null {
    return this.asientos().find((a) => a.id === id) ?? null;
  }

  asientoDe(participanteId: string): Asiento | null {
    return this.asientos().find((a) => a.ocupante === participanteId) ?? null;
  }

  /**
   * Si dos participantes son vecinos en la mesa: el asiento ocupado más cercano a
   * cada lado (los libres se saltan).
   */
  sonVecinos(unoId: string, otroId: string): boolean {
    const ocupados = this.asientos().filter((a) => a.ocupante);
    const i = ocupados.findIndex((a) => a.ocupante === unoId);
    if (i < 0 || ocupados.length < 2) return false;
    const n = ocupados.length;
    return [ocupados[(i + 1) % n].ocupante, ocupados[(i - 1 + n) % n].ocupante].includes(otroId);
  }

  /** Añade un asiento al final del círculo. No comprueba el máximo ni permisos. */
  anadirAsiento(): void {
    this.mesa.push(asientoNuevo());
  }

  /** Quita el último asiento del círculo; quien estuviera sentado vuelve a visitante. Devuelve su id. */
  quitarAsiento(): string | null {
    const quitado = this.mesa.pop();
    if (quitado?.ocupante) this.participantes.cambiarRol(quitado.ocupante, 'visitante');
    return quitado?.id ?? null;
  }

  /** Sienta a alguien en un asiento libre y pasa a jugador. Devuelve el error, si lo hay. */
  sentar(participanteId: string, asientoId: string): string | null {
    const asiento = this.asiento(asientoId);
    if (!asiento) return 'Ese asiento ya no existe.';
    if (asiento.ocupante) return 'Ese asiento ya está ocupado.';
    asiento.ocupante = participanteId;
    this.participantes.cambiarRol(participanteId, 'jugador');
    return null;
  }

  /** Se levanta de su asiento y vuelve a visitante. */
  levantar(participanteId: string): void {
    for (const asiento of this.mesa) if (asiento.ocupante === participanteId) asiento.ocupante = null;
    this.participantes.cambiarRol(participanteId, 'visitante');
  }

  /**
   * Pasa a quien está en el asiento `desde` al asiento `hasta`; si ahí había
   * alguien, se intercambian. Devuelve el error, si lo hay.
   */
  moverOcupante(desde: string, hasta: string): string | null {
    const origen = this.asiento(desde);
    const destino = this.asiento(hasta);
    if (!origen || !destino) return 'Ese asiento ya no existe.';
    if (!origen.ocupante) return 'Ya no hay nadie en ese asiento.';
    if (origen === destino) return null;
    [origen.ocupante, destino.ocupante] = [destino.ocupante, origen.ocupante];
    this.avisar(new Map([[origen.id, destino.id], [destino.id, origen.id]]));
    return null;
  }

  /**
   * Reparte al azar a quienes están sentados entre todos los asientos (también
   * los libres). Devuelve cuántos había sentados.
   */
  mezclar(): number {
    const mesa = this.asientos();
    // Fisher-Yates sobre la mesa entera: los huecos libres también se barajan. Cada
    // asiento recibe a quien estaba en el de `orden[i]`
    const orden = barajar(mesa.map((_, i) => i));
    const ocupantes = mesa.map((a) => a.ocupante);
    mesa.forEach((a, i) => (a.ocupante = ocupantes[orden[i]]));
    this.avisar(new Map(orden.map((desde, i) => [mesa[desde].id, mesa[i].id])));
    return ocupantes.filter(Boolean).length;
  }

  /** Se apunta a los cambios de sitio de los ocupantes (ver OyenteMover). */
  alMover(oyente: OyenteMover): void {
    this.oyentes.push(oyente);
  }

  private avisar(destino: Map<string, string>): void {
    for (const oyente of this.oyentes) oyente(destino);
  }
}
