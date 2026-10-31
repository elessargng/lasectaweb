import type { FichaEnviadaDto, GrimorioEnviadoDto } from '../../views/dto/grimorio';
import type { Alineamiento } from '../compartido/jugador';
import type { Diario } from './eventos';
import type { Jugador } from './Jugador';

/** Lo que sabe un jugador de su ficha. */
export interface FichaEntregada {
  personaje: string | null;
  alineamiento: Alineamiento | null;
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
  private grimoriosEnviados = new Map<string, { ocupante: string; grimorio: GrimorioEnviadoDto }>();
  /** Con el Gardener: los personajes repartidos aún no se han entregado a los jugadores. */
  private retenidas = false;

  constructor(
    /** Los jugadores de la plaza, en orden. */
    private readonly plaza: () => readonly Jugador[],
    private readonly diario: Diario,
  ) {}

  /**
   * Entrega a cada jugador su ficha tal como está ahora: al repartir la bolsa o,
   * con el Gardener, cuando el narrador la entrega (con lo que haya cambiado
   * mientras tanto).
   */
  entregarFichas(): void {
    this.entregadas = new Map(this.plaza().map((a) => [a.id, { personaje: a.personaje, alineamiento: a.alineamiento }]));
    this.retenidas = false;
  }

  /**
   * El narrador le dice a un jugador quién es («Tú eres», de noche): su ficha pasa a
   * ser esa (el personaje, si es uno solo, y el alineamiento, si se le dice). Así
   * es como se entera de un cambio: lo que el narrador cambie en el grimorio no lo ve.
   */
  comunicarFicha(jugadorId: string, personajes: string[], alineamiento: Alineamiento | null): void {
    const antes = this.fichaEntregada(jugadorId);
    this.entregadas.set(jugadorId, {
      personaje: personajes.length === 1 ? personajes[0] : antes.personaje,
      alineamiento: alineamiento ?? antes.alineamiento,
    });
  }

  /** La ficha que se entregó a un asiento en el último reparto (sin reparto, vacía). */
  fichaEntregada(jugadorId: string): FichaEntregada {
    return this.entregadas.get(jugadorId) ?? { personaje: null, alineamiento: null };
  }

  fichasRetenidas(): boolean {
    return this.retenidas;
  }

  retenerFichas(retenidas: boolean): void {
    this.retenidas = retenidas;
  }

  /** Envía un grimorio (sus fichas y los faroles) a quien se sienta en un asiento y lo apunta en el diario. No comprueba las fichas. */
  enviarGrimorio(jugadorId: string, fichas: FichaEnviadaDto[], faroles: string[] = []): void {
    const ocupante = this.plaza().find((a) => a.id === jugadorId)?.participanteId;
    if (ocupante) this.grimoriosEnviados.set(jugadorId, { ocupante, grimorio: { hora: Date.now(), fichas, faroles } });
    this.diario.anotar({ tipo: 'grimorio', asiento: this.diario.asiento(jugadorId) });
  }

  /** El último grimorio enviado a un participante (si sigue en el asiento al que se envió), o null. */
  grimorioRecibidoPor(participanteId: string): GrimorioEnviadoDto | null {
    const jugador = this.plaza().find((a) => a.participanteId === participanteId);
    const enviado = jugador ? this.grimoriosEnviados.get(jugador.id) : undefined;
    return enviado && enviado.ocupante === participanteId ? enviado.grimorio : null;
  }

  /** Otra partida: nada entregado, nada enviado, nada retenido. */
  olvidar(): void {
    this.entregadas.clear();
    this.grimoriosEnviados.clear();
    this.retenidas = false;
  }
}
