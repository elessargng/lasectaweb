import type { SalaAsiento } from '../../contrato/sala';

/**
 * La ficha de un asiento de la mesa: lo que es de la partida (personaje, muerte,
 * calavera, recordatorios…). Cada asiento tiene la suya, haya alguien sentado o no.
 */
export type Ficha = Pick<
  SalaAsiento,
  'muerto' | 'muertePendiente' | 'votoGastado' | 'marcado' | 'votosMarca' | 'personaje' | 'alineamiento' | 'recordatorios' | 'nota'
>;

/** Una ficha como al principio: viva, sin personaje, sin calavera y sin recordatorios. */
const fichaNueva = (): Ficha => ({
  muerto: false,
  muertePendiente: false,
  votoGastado: false,
  marcado: false,
  votosMarca: null,
  personaje: null,
  alineamiento: null,
  recordatorios: [],
  nota: null,
});

/** Las fichas de la mesa, por id de asiento. No comprueba permisos ni que el asiento exista. */
export class Fichas {
  private porAsiento = new Map<string, Ficha>();

  /** La ficha de un asiento (la de un asiento nuevo, como al principio). */
  de(asientoId: string): Ficha {
    let ficha = this.porAsiento.get(asientoId);
    if (!ficha) this.porAsiento.set(asientoId, (ficha = fichaNueva()));
    return ficha;
  }

  /** Se ha quitado el asiento: su ficha, con él. */
  olvidar(asientoId: string): void {
    this.porAsiento.delete(asientoId);
  }

  /** Otra partida: todas como al principio. */
  limpiar(): void {
    this.porAsiento.clear();
  }

  /** Los asientos han cambiado de sitio (ver Sala.alMover): cada ficha va con su jugador. */
  remapear(a: (asientoId: string) => string): void {
    this.porAsiento = new Map([...this.porAsiento].map(([k, v]) => [a(k), v] as const));
  }
}
