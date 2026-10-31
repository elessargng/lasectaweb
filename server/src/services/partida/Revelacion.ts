import type { Alineamiento } from '../../contrato/jugador';
import type { RevelacionDto } from '../../contrato/partida';
import type { Jugador } from './Jugador';

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
  revelacion(): RevelacionDto | null {
    const r = this.actual;
    if (!r) return null;
    const mesa = this.plaza();
    // Solo cuentan los asientos que siguen en la mesa
    const reveladas = r.reveladas.filter((id) => mesa.some((a) => a.id === id));
    const terminada = mesa.every((a) => reveladas.includes(a.id));
    // Lo que ha pasado dice quién estaba en juego: no se cuenta hasta que todo está revelado
    return { ganador: r.ganador, causas: terminada ? [...r.causas] : [], reveladas, terminada };
  }

  /** Empieza a revelar el grimorio: ha ganado ese bando y todas las fichas se dan la vuelta. */
  empezar(ganador: Alineamiento, causas: string[]): void {
    this.actual = { ganador, causas, reveladas: [] };
  }

  /** Revela la ficha de un asiento (todos verán su personaje). */
  revelarFicha(asientoId: string): void {
    const r = this.actual;
    if (r && !r.reveladas.includes(asientoId) && this.plaza().some((a) => a.id === asientoId)) r.reveladas.push(asientoId);
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
