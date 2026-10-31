import { NUM_FAROLES } from '../compartido/jugador';
import type { Jugador } from './Jugador';
import type { Diario } from './eventos';

/** Las casillas de farol, todas vacías. */
export const farolesVacios = (): (string | null)[] => Array.from({ length: NUM_FAROLES }, () => null);

/** Las casillas con `personajeId` en `posicion` (fuera de cualquier otra en la que estuviera). */
function ponerEnCasilla(casillas: (string | null)[], posicion: number, personajeId: string | null): (string | null)[] {
  const nuevas = casillas.map((id) => (personajeId && id === personajeId ? null : id));
  nuevas[posicion] = personajeId;
  return nuevas;
}

/**
 * Los faroles para el demonio: los que prepara el narrador y los de cada asiento
 * (los que se pone su jugador o le copia el narrador). Lo que se cambia se apunta
 * en el diario. No comprueba permisos ni el guion.
 */
export class Faroles {
  /** Los faroles que el narrador prepara para el demonio (ver SalaDto.faroles). */
  private delNarrador: (string | null)[] = farolesVacios();

  /**
   * Los faroles de cada jugador (por su id; van con él si cambia de silla), con
   * quién lo jugaba al ponerlos: si lo juega otro (o nadie), dejan de valer, como los despertares.
   */
  private deJugadores = new Map<string, { ocupante: string | null; faroles: (string | null)[]; enUso: string | null }>();

  constructor(
    /** Los jugadores de la plaza, en orden. */
    private readonly plaza: () => readonly Jugador[],
    private readonly diario: Diario,
  ) {}

  faroles(): (string | null)[] {
    return [...this.delNarrador];
  }

  /**
   * Pone un personaje en una casilla de farol del narrador (o la vacía, con
   * null). Si ya estaba en otra casilla, sale de ella.
   */
  ponerFarol(posicion: number, personajeId: string | null): void {
    this.delNarrador = ponerEnCasilla(this.delNarrador, posicion, personajeId);
    this.diario.anotar({ tipo: 'farol', asiento: null, posicion, personaje: personajeId });
  }

  /** Los faroles del jugador, si siguen siendo de quien lo juega. */
  deJugador(jugador: Jugador): (string | null)[] {
    const f = this.deJugadores.get(jugador.id);
    return f && f.ocupante === jugador.participanteId ? [...f.faroles] : farolesVacios();
  }

  /** El farol que dice usar el jugador, si sigue siendo de quien lo juega (y sigue entre sus faroles). */
  enUso(jugador: Jugador): string | null {
    const f = this.deJugadores.get(jugador.id);
    return f && f.ocupante === jugador.participanteId ? f.enUso : null;
  }

  /** Pone un farol en una casilla de un asiento (o la vacía). Si el que usaba ya no está, deja de usarlo. */
  ponerFarolAsiento(jugadorId: string, posicion: number, personajeId: string | null): void {
    const jugador = this.plaza().find((j) => j.id === jugadorId);
    if (jugador) this.guardar(jugador, ponerEnCasilla(this.deJugador(jugador), posicion, personajeId), this.enUso(jugador));
    this.diario.anotar({ tipo: 'farol', asiento: this.diario.asiento(jugadorId), posicion, personaje: personajeId });
  }

  /** Cambia de una vez los faroles de un asiento (los que le ha enseñado el narrador). */
  copiarFaroles(jugadorId: string, personajes: string[]): void {
    const jugador = this.plaza().find((j) => j.id === jugadorId);
    if (jugador) this.guardar(jugador, farolesVacios().map((_, i) => personajes[i] ?? null), this.enUso(jugador));
    this.diario.anotar({ tipo: 'copiaFaroles', asiento: this.diario.asiento(jugadorId), personajes });
  }

  /** El asiento dice usar uno de sus faroles (o ninguno, con null). Devuelve el error, si lo hay. */
  usarFarol(jugadorId: string, personajeId: string | null): string | null {
    const jugador = this.plaza().find((j) => j.id === jugadorId);
    if (!jugador) return 'Ese asiento ya no existe.';
    const faroles = this.deJugador(jugador);
    if (personajeId !== null && !faroles.includes(personajeId)) return 'Ese personaje no está entre tus faroles.';
    this.guardar(jugador, faroles, personajeId);
    this.diario.anotar({ tipo: 'usaFarol', asiento: this.diario.asiento(jugadorId), personaje: personajeId });
    return null;
  }

  private guardar(jugador: Jugador, faroles: (string | null)[], enUso: string | null): void {
    this.deJugadores.set(jugador.id, { ocupante: jugador.participanteId, faroles, enUso: enUso && faroles.includes(enUso) ? enUso : null });
  }

  /** Otra partida (u otro guion): todos vacíos. */
  vaciar(): void {
    this.delNarrador = farolesVacios();
    this.deJugadores.clear();
  }
}
