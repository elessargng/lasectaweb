import { randomUUID } from 'crypto';
import { barajar } from '../partida/azar';
import { Jugador } from '../partida/Jugador';
import { Participantes } from './Participantes';

/** Asientos de la mesa: con cuántos empieza la sala y cuántos puede tener. */
export const SALA_ASIENTOS = { inicial: 7, min: 0, max: 20 };

/**
 * Un asiento de la mesa y el jugador que se sienta en él. Siempre hay uno: en un
 * asiento libre, un jugador sin ocupante (ver Jugador). Su posición es su lugar en la mesa.
 */
export interface Asiento {
  readonly id: string;
  jugador: Jugador;
}

/** Un asiento recién puesto: con un jugador sin nadie que lo juegue. */
const asientoNuevo = (): Asiento => ({ id: randomUUID(), jugador: new Jugador() });

/** Cómo se han movido los jugadores: del asiento de cada clave al de su valor. */
export type OyenteMover = (destino: Map<string, string>) => void;

/** Qué asiento se ha quitado de la mesa (con su jugador). */
export type OyenteQuitar = (asiento: Asiento) => void;

/**
 * La sala: quién está (narradores, jugadores y visitantes, ver Participantes) y la
 * mesa, con el jugador de cada asiento y quién lo juega. Al cambiar a los jugadores
 * de asiento, avisa (alMover) para que la partida lleve lo que aún guarda por
 * asiento; al quitar un asiento (alQuitar), para que olvide lo que tenía.
 */
export class Sala {
  readonly participantes = new Participantes();
  private readonly mesa: Asiento[] = Array.from({ length: SALA_ASIENTOS.inicial }, () => asientoNuevo());
  private oyentesMover: OyenteMover[] = [];
  private oyentesQuitar: OyenteQuitar[] = [];

  /**
   * Los asientos, en orden: el primero a las 12 y siguiendo las agujas del reloj.
   * Un jugador solo lo juega alguien que sigue en la sala y es jugador: se queda
   * sin nadie cuando sale, se le acaba la espera de reconexión o cambia de papel.
   */
  asientos(): Asiento[] {
    for (const { jugador } of this.mesa) {
      const id = jugador.participanteId;
      if (id && this.participantes.buscar(id)?.rol !== 'jugador') jugador.levantar();
    }
    return this.mesa;
  }

  asiento(id: string): Asiento | null {
    return this.asientos().find((a) => a.id === id) ?? null;
  }

  asientoDe(participanteId: string): Asiento | null {
    return this.asientos().find((a) => a.jugador.participanteId === participanteId) ?? null;
  }

  /**
   * Si dos participantes son vecinos en la mesa: el asiento ocupado más cercano a
   * cada lado (los libres se saltan).
   */
  sonVecinos(unoId: string, otroId: string): boolean {
    const ocupados = this.asientos().flatMap((a) => a.jugador.participanteId ?? []);
    const i = ocupados.indexOf(unoId);
    if (i < 0 || ocupados.length < 2) return false;
    const n = ocupados.length;
    return [ocupados[(i + 1) % n], ocupados[(i - 1 + n) % n]].includes(otroId);
  }

  /** Añade un asiento al final del círculo. No comprueba el máximo ni permisos. */
  anadirAsiento(): void {
    this.mesa.push(asientoNuevo());
  }

  /** Quita el último asiento del círculo; quien estuviera sentado vuelve a visitante. Devuelve su id. */
  quitarAsiento(): string | null {
    const quitado = this.mesa.pop();
    const ocupante = quitado?.jugador.participanteId;
    if (ocupante) this.participantes.cambiarRol(ocupante, 'visitante');
    if (quitado) for (const oyente of this.oyentesQuitar) oyente(quitado);
    return quitado?.id ?? null;
  }

  /** Sienta a alguien en un asiento libre (pasa a jugar a su jugador) y pasa a jugador. Devuelve el error, si lo hay. */
  sentar(participanteId: string, asientoId: string): string | null {
    const asiento = this.asiento(asientoId);
    if (!asiento) return 'Ese asiento ya no existe.';
    if (asiento.jugador.participanteId) return 'Ese asiento ya está ocupado.';
    asiento.jugador.sentar(participanteId);
    this.participantes.cambiarRol(participanteId, 'jugador');
    return null;
  }

  /** Se levanta de su asiento (su jugador se queda, sin nadie) y vuelve a visitante. */
  levantar(participanteId: string): void {
    for (const { jugador } of this.mesa) if (jugador.participanteId === participanteId) jugador.levantar();
    this.participantes.cambiarRol(participanteId, 'visitante');
  }

  /**
   * Pasa a quien está en el asiento `desde` al asiento `hasta`, con su jugador; el
   * jugador que había ahí (con alguien o sin nadie) pasa a `desde`. Devuelve el error, si lo hay.
   */
  moverOcupante(desde: string, hasta: string): string | null {
    const origen = this.asiento(desde);
    const destino = this.asiento(hasta);
    if (!origen || !destino) return 'Ese asiento ya no existe.';
    if (!origen.jugador.participanteId) return 'Ya no hay nadie en ese asiento.';
    if (origen === destino) return null;
    [origen.jugador, destino.jugador] = [destino.jugador, origen.jugador];
    this.avisar(new Map([[origen.id, destino.id], [destino.id, origen.id]]));
    return null;
  }

  /**
   * Reparte al azar a los jugadores entre los asientos (también a los que no juega
   * nadie). Devuelve cuántos había sentados.
   */
  mezclar(): number {
    const mesa = this.asientos();
    // Fisher-Yates sobre la mesa entera: los huecos libres también se barajan. Cada
    // asiento recibe al jugador que estaba en el de `orden[i]`
    const orden = barajar(mesa.map((_, i) => i));
    const jugadores = mesa.map((a) => a.jugador);
    mesa.forEach((a, i) => (a.jugador = jugadores[orden[i]]));
    this.avisar(new Map(orden.map((desde, i) => [mesa[desde].id, mesa[i].id])));
    return jugadores.filter((j) => j.participanteId).length;
  }

  /** Se apunta a los cambios de sitio de los jugadores (ver OyenteMover). */
  alMover(oyente: OyenteMover): void {
    this.oyentesMover.push(oyente);
  }

  /** Se apunta a los asientos que se quitan (ver OyenteQuitar). */
  alQuitar(oyente: OyenteQuitar): void {
    this.oyentesQuitar.push(oyente);
  }

  private avisar(destino: Map<string, string>): void {
    for (const oyente of this.oyentesMover) oyente(destino);
  }
}
