import { NUM_FAROLES, type SalaAsiento } from '../../contrato/sala';

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
 * (los que se pone su jugador o le copia el narrador). No comprueba permisos ni el guion.
 */
export class Faroles {
  /** Los faroles que el narrador prepara para el demonio (ver SalaEstado.faroles). */
  private delNarrador: (string | null)[] = farolesVacios();

  /**
   * Los faroles de cada asiento, con quién estaba sentado al ponerlos: si se
   * sienta otro (o se levanta), dejan de valer, como los despertares.
   */
  private deAsientos = new Map<string, { ocupante: string | null; faroles: (string | null)[]; enUso: string | null }>();

  constructor(
    /** La mesa como está ahora. */
    private readonly mesa: () => SalaAsiento[],
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
  }

  /** Los faroles del asiento, si siguen siendo de quien se sienta en él. */
  deAsiento(asiento: SalaAsiento): (string | null)[] {
    const f = this.deAsientos.get(asiento.id);
    return f && f.ocupante === asiento.ocupante ? [...f.faroles] : farolesVacios();
  }

  /** El farol que dice usar el asiento, si sigue siendo de quien se sienta en él (y sigue entre sus faroles). */
  enUso(asiento: SalaAsiento): string | null {
    const f = this.deAsientos.get(asiento.id);
    return f && f.ocupante === asiento.ocupante ? f.enUso : null;
  }

  /** Pone un farol en una casilla de un asiento (o la vacía). Si el que usaba ya no está, deja de usarlo. */
  ponerFarolAsiento(asientoId: string, posicion: number, personajeId: string | null): void {
    const asiento = this.mesa().find((a) => a.id === asientoId);
    if (!asiento) return;
    this.guardar(asiento, ponerEnCasilla(this.deAsiento(asiento), posicion, personajeId), this.enUso(asiento));
  }

  /** Cambia de una vez los faroles de un asiento (los que le ha enseñado el narrador). */
  copiarFaroles(asientoId: string, personajes: string[]): void {
    const asiento = this.mesa().find((a) => a.id === asientoId);
    if (!asiento) return;
    this.guardar(asiento, farolesVacios().map((_, i) => personajes[i] ?? null), this.enUso(asiento));
  }

  /** El asiento dice usar uno de sus faroles (o ninguno, con null). Devuelve el error, si lo hay. */
  usarFarol(asientoId: string, personajeId: string | null): string | null {
    const asiento = this.mesa().find((a) => a.id === asientoId);
    if (!asiento) return 'Ese asiento ya no existe.';
    const faroles = this.deAsiento(asiento);
    if (personajeId !== null && !faroles.includes(personajeId)) return 'Ese personaje no está entre tus faroles.';
    this.guardar(asiento, faroles, personajeId);
    return null;
  }

  private guardar(asiento: SalaAsiento, faroles: (string | null)[], enUso: string | null): void {
    this.deAsientos.set(asiento.id, { ocupante: asiento.ocupante, faroles, enUso: enUso && faroles.includes(enUso) ? enUso : null });
  }

  /** Otra partida (u otro guion): todos vacíos. */
  vaciar(): void {
    this.delNarrador = farolesVacios();
    this.deAsientos.clear();
  }

  /** Los asientos han cambiado de sitio (ver SalaService.llevarFichas): cada farol va con el suyo. */
  remapear(a: (asientoId: string) => string): void {
    this.deAsientos = new Map([...this.deAsientos].map(([k, v]) => [a(k), v] as const));
  }
}
