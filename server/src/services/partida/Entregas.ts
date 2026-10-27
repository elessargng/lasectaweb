import type { SalaAlineamiento, SalaAsiento, SalaFichaEnviada, SalaGrimorioEnviado } from '../../contrato/sala';

/** Lo que sabe un jugador de su ficha. */
export interface FichaEntregada {
  personaje: string | null;
  alineamiento: SalaAlineamiento | null;
}

/**
 * Lo que el narrador les ha dado a los jugadores: la ficha que se entregó a cada
 * asiento (lo único que ve de ella quien se sienta ahí: lo que el narrador
 * cambie después es del grimorio) y los grimorios enviados (al Espía, a la
 * Viuda). Con el Gardener, las fichas se retienen hasta que el narrador las
 * entrega. No comprueba permisos.
 */
export class Entregas {
  private entregadas = new Map<string, FichaEntregada>();
  /**
   * Los grimorios enviados, por asiento: el último, y a quién estaba sentado
   * entonces (si se sienta otro, no lo ve).
   */
  private grimoriosEnviados = new Map<string, { ocupante: string; grimorio: SalaGrimorioEnviado }>();
  /** Con el Gardener: los personajes repartidos aún no se han entregado a los jugadores. */
  private retenidas = false;

  constructor(
    /** La mesa, en orden. */
    private readonly mesa: () => SalaAsiento[],
  ) {}

  /**
   * Entrega a cada jugador su ficha tal como está ahora: al repartir la bolsa o,
   * con el Gardener, cuando el narrador la entrega (con lo que haya cambiado
   * mientras tanto).
   */
  entregarFichas(): void {
    this.entregadas = new Map(this.mesa().map((a) => [a.id, { personaje: a.personaje, alineamiento: a.alineamiento }]));
    this.retenidas = false;
  }

  /**
   * El narrador le dice a un jugador quién es («Tú eres», de noche): su ficha pasa a
   * ser esa (el personaje, si es uno solo, y el alineamiento, si se le dice). Así
   * es como se entera de un cambio: lo que el narrador cambie en el grimorio no lo ve.
   */
  comunicarFicha(asientoId: string, personajes: string[], alineamiento: SalaAlineamiento | null): void {
    const antes = this.fichaEntregada(asientoId);
    this.entregadas.set(asientoId, {
      personaje: personajes.length === 1 ? personajes[0] : antes.personaje,
      alineamiento: alineamiento ?? antes.alineamiento,
    });
  }

  /** La ficha que se entregó a un asiento en el último reparto (sin reparto, vacía). */
  fichaEntregada(asientoId: string): FichaEntregada {
    return this.entregadas.get(asientoId) ?? { personaje: null, alineamiento: null };
  }

  fichasRetenidas(): boolean {
    return this.retenidas;
  }

  retenerFichas(retenidas: boolean): void {
    this.retenidas = retenidas;
  }

  /** Envía un grimorio (sus fichas y los faroles) a quien se sienta en un asiento. No comprueba las fichas. */
  enviarGrimorio(asientoId: string, fichas: SalaFichaEnviada[], faroles: string[] = []): void {
    const ocupante = this.mesa().find((a) => a.id === asientoId)?.ocupante;
    if (ocupante) this.grimoriosEnviados.set(asientoId, { ocupante, grimorio: { hora: Date.now(), fichas, faroles } });
  }

  /** El último grimorio enviado a un participante (si sigue en el asiento al que se envió), o null. */
  grimorioRecibidoPor(participanteId: string): SalaGrimorioEnviado | null {
    const asiento = this.mesa().find((a) => a.ocupante === participanteId);
    const enviado = asiento ? this.grimoriosEnviados.get(asiento.id) : undefined;
    return enviado && enviado.ocupante === participanteId ? enviado.grimorio : null;
  }

  /** Otra partida: nada entregado, nada enviado, nada retenido. */
  olvidar(): void {
    this.entregadas.clear();
    this.grimoriosEnviados.clear();
    this.retenidas = false;
  }

  /** Los asientos han cambiado de sitio (ver SalaService.llevarFichas): lo entregado y lo enviado va con su ficha. */
  remapear(a: (asientoId: string) => string): void {
    const remapear = <V>(m: Map<string, V>) => new Map([...m].map(([k, v]) => [a(k), v] as const));
    this.entregadas = remapear(this.entregadas);
    this.grimoriosEnviados = remapear(this.grimoriosEnviados);
  }
}
