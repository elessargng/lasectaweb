import { barajar, type Azar } from '../partida/azar';
import { Jugador } from '../partida/Jugador';
import { Participantes } from './Participantes';

/** Asientos de la plaza: con cuántos empieza la sala y cuántos puede tener. */
export const SALA_ASIENTOS = { inicial: 7, min: 0, max: 20 };

/** Un cambio en los asientos (ver Sala.cambiarAsientos). */
export type CambioAsientos = { cambio: 'añadir' | 'quitar' | 'mezclar' } | { cambio: 'mover'; desde: string; hasta: string };

/** Qué jugador se ha quitado de la plaza (al quitar su asiento). */
export type OyenteQuitar = (jugador: Jugador) => void;

/**
 * La sala: quién está (narradores, jugadores y visitantes, ver Participantes) y la
 * plaza. La plaza son los jugadores en orden: un asiento no es nada más que una
 * posición (el asiento N es el jugador N-1). En un asiento libre hay un jugador al
 * que no juega nadie (ver Jugador). Al cambiar de silla, el jugador se mueve con
 * todo lo suyo: lo que se guarda por su id va con él.
 */
export class Sala {
  constructor(private readonly azar: Azar) {}

  readonly participantes = new Participantes();
  private readonly plaza: Jugador[] = Array.from({ length: SALA_ASIENTOS.inicial }, () => new Jugador());
  private oyentesQuitar: OyenteQuitar[] = [];

  /**
   * Los jugadores de la plaza, en orden: el primero a las 12 y siguiendo las agujas
   * del reloj. Un jugador solo lo juega alguien que sigue en la sala y es jugador:
   * se queda sin nadie cuando sale, se le acaba la espera de reconexión o cambia de papel.
   */
  jugadores(): Jugador[] {
    for (const jugador of this.plaza) {
      const id = jugador.participanteId;
      if (id && this.participantes.buscar(id)?.rol !== 'jugador') jugador.levantar();
    }
    return this.plaza;
  }

  jugador(id: string): Jugador | null {
    return this.jugadores().find((j) => j.id === id) ?? null;
  }

  /** El jugador al que juega un participante, o null (no está sentado). */
  jugadorDe(participanteId: string): Jugador | null {
    return this.jugadores().find((j) => j.participanteId === participanteId) ?? null;
  }

  /**
   * Si dos participantes son vecinos en la plaza: el asiento ocupado más cercano a
   * cada lado (los libres se saltan).
   */
  sonVecinos(unoId: string, otroId: string): boolean {
    const ocupados = this.jugadores().flatMap((j) => j.participanteId ?? []);
    const i = ocupados.indexOf(unoId);
    if (i < 0 || ocupados.length < 2) return false;
    const n = ocupados.length;
    return [ocupados[(i + 1) % n], ocupados[(i - 1 + n) % n]].includes(otroId);
  }

  /** Añade un asiento al final del círculo, con un jugador al que no juega nadie (hasta el máximo). Devuelve el error, si lo hay. */
  anadirAsiento(): string | null {
    if (this.plaza.length >= SALA_ASIENTOS.max) return `La plaza ya tiene el máximo de ${SALA_ASIENTOS.max} asientos.`;
    this.plaza.push(new Jugador());
    return null;
  }

  /**
   * Quita el último asiento del círculo, con su jugador; quien lo jugaba vuelve a
   * visitante. Devuelve el id del jugador, o null si ya no se puede quitar ninguno.
   */
  quitarAsiento(): string | null {
    if (this.plaza.length <= SALA_ASIENTOS.min) return null;
    const quitado = this.plaza.pop();
    const ocupante = quitado?.participanteId;
    if (ocupante) this.participantes.cambiarRol(ocupante, 'visitante');
    if (quitado) for (const oyente of this.oyentesQuitar) oyente(quitado);
    return quitado?.id ?? null;
  }

  /** Sienta a alguien en el asiento de un jugador al que no juega nadie (pasa a jugarlo) y pasa a jugador. Devuelve el error, si lo hay. */
  sentar(participanteId: string, jugadorId: string): string | null {
    const jugador = this.jugador(jugadorId);
    if (!jugador) return 'Ese asiento ya no existe.';
    if (jugador.participanteId) return 'Ese asiento ya está ocupado.';
    jugador.sentar(participanteId);
    this.participantes.cambiarRol(participanteId, 'jugador');
    return null;
  }

  /** Se levanta de su asiento (su jugador se queda, sin nadie) y vuelve a visitante. */
  levantar(participanteId: string): void {
    for (const jugador of this.plaza) if (jugador.participanteId === participanteId) jugador.levantar();
    this.participantes.cambiarRol(participanteId, 'visitante');
  }

  /**
   * Pasa al jugador `desde` (al que juega alguien) al asiento del jugador `hasta`, y
   * a este al suyo: se cambian de silla. Devuelve el error, si lo hay.
   */
  moverOcupante(desde: string, hasta: string): string | null {
    const plaza = this.jugadores();
    const i = plaza.findIndex((j) => j.id === desde);
    const k = plaza.findIndex((j) => j.id === hasta);
    if (i < 0 || k < 0) return 'Ese asiento ya no existe.';
    if (!plaza[i].participanteId) return 'Ya no hay nadie en ese asiento.';
    [plaza[i], plaza[k]] = [plaza[k], plaza[i]];
    return null;
  }

  /**
   * Reparte al azar a los jugadores entre los asientos (también a los que no juega
   * nadie). Devuelve cuántos había sentados.
   */
  mezclar(): number {
    const barajados = barajar(this.jugadores(), this.azar);
    this.plaza.splice(0, this.plaza.length, ...barajados);
    return barajados.filter((j) => j.participanteId).length;
  }

  /** Un narrador levanta a un jugador de su asiento: vuelve a visitante. Devuelve el error, si lo hay. */
  levantarJugador(participanteId: string): string | null {
    const elegido = this.participantes.buscar(participanteId);
    if (!elegido) return 'Esa persona ya no está en la sala.';
    if (elegido.rol !== 'jugador') return `${elegido.nombre} no está en ningún asiento.`;
    this.levantar(elegido.id);
    return null;
  }

  /**
   * Cambia los asientos: añade o quita uno al final del círculo, mezcla a quienes
   * están sentados o mueve a uno a otro asiento (intercambiándolos si está ocupado).
   * Devuelve el error, si lo hay.
   */
  cambiarAsientos(cambio: CambioAsientos): string | null {
    switch (cambio.cambio) {
      case 'añadir':
        return this.anadirAsiento();
      case 'quitar':
        return this.quitarAsiento() ? null : 'La plaza ya no tiene asientos.';
      case 'mover':
        return this.moverOcupante(cambio.desde, cambio.hasta);
      case 'mezclar':
        return this.mezclar() > 0 ? null : 'No hay nadie sentado para mezclar.';
    }
  }

  /** Se apunta a los asientos que se quitan (ver OyenteQuitar). */
  alQuitar(oyente: OyenteQuitar): void {
    this.oyentesQuitar.push(oyente);
  }
}
