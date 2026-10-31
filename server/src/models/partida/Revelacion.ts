import type { Alineamiento } from '../compartido/jugador';
import type { Jugador } from './Jugador';

/** Cómo va la revelación del final: quién ha ganado, lo que ha pasado y las fichas ya reveladas. */
export interface EstadoRevelacion {
  ganador: Alineamiento;
  /** Lo que ha pasado (ids de CAUSAS_FIN_PARTIDA); vacío hasta que está todo revelado. */
  causas: string[];
  /** Los jugadores cuya ficha ya se ha revelado, en orden. */
  reveladas: string[];
  terminada: boolean;
}

/**
 * El final de la partida: el narrador dice qué bando ha ganado (y lo que ha
 * pasado, ver CAUSAS_FIN_PARTIDA), todas las fichas se dan la vuelta y él las va
 * revelando una a una. No comprueba permisos.
 */
export class Revelacion {
  private actual: { ganador: Alineamiento; causas: string[]; reveladas: string[] } | null = null;

  constructor(
    /** Los jugadores de la plaza, en orden. */
    private readonly plaza: () => readonly Jugador[],
  ) {}

  /** La revelación del grimorio en curso (o acabada), o null. */
  revelacion(): EstadoRevelacion | null {
    const r = this.actual;
    if (!r) return null;
    const plaza = this.plaza();
    // Solo cuentan los asientos que siguen en la plaza
    const reveladas = r.reveladas.filter((id) => plaza.some((a) => a.id === id));
    const terminada = plaza.every((a) => reveladas.includes(a.id));
    // Lo que ha pasado dice quién estaba en juego: no se cuenta hasta que todo está revelado
    return { ganador: r.ganador, causas: terminada ? [...r.causas] : [], reveladas, terminada };
  }

  /** Empieza a revelar el grimorio: ha ganado ese bando y todas las fichas se dan la vuelta. */
  empezar(ganador: Alineamiento, causas: string[]): void {
    this.actual = { ganador, causas, reveladas: [] };
  }

  /** Revela la ficha de un asiento (todos verán su personaje). */
  revelarFicha(jugadorId: string): void {
    const r = this.actual;
    if (r && !r.reveladas.includes(jugadorId) && this.plaza().some((a) => a.id === jugadorId)) r.reveladas.push(jugadorId);
  }

  /** Revela de una vez las que quedan. */
  revelarTodas(): void {
    for (const a of this.plaza()) this.revelarFicha(a.id);
  }

  /** Otra partida: no hay nada que revelar. */
  olvidar(): void {
    this.actual = null;
  }
}
