/**
 * El jugador de la plaza tal como se envía.
 * Lo que se envía al cliente (alias @views): solo tipos, sin Node ni servicios.
 */
import type { Recordatorio } from '../../models/compartido/grimorio';
import type { Alineamiento } from '../../models/compartido/jugador';

/**
 * Un jugador de la plaza, lo juegue alguien o no (su silla está libre): su ficha,
 * su muerte, su voto y sus faroles. Su asiento es su posición en `SalaDto.plaza`.
 */
export interface JugadorDto {
  id: string;
  /** id del participante que lo juega, o null si no lo juega nadie. */
  participanteId: string | null;
  /** Su ficha está muerta (lleva sudario). */
  muerto: boolean;
  /**
   * Muerta de noche, a falta de que el narrador lo anuncie (de día, al pulsar el
   * sudario): aún no cuenta como muerta. Solo la ven quienes ven el grimorio.
   */
  muertePendiente: boolean;
  /**
   * Muerta, ya ha gastado el único voto que le queda (se apaga su vela). Es
   * público: todos saben qué muertos pueden votar todavía. Al morir o revivir
   * vuelve a false.
   */
  votoGastado: boolean;
  /**
   * El personaje de su ficha (id del catálogo o del guion), o null si no tiene.
   * Solo lo ven los narradores y quien lo juega.
   */
  personaje: string | null;
  /**
   * Su alineamiento si el narrador lo ha cambiado; null: el de su tipo (aldeanos
   * y forasteros, buenos; esbirros y demonios, malvados; viajeros, sin decidir).
   */
  alineamiento: Alineamiento | null;
  /**
   * Las fichas recordatorio puestas junto a la suya, en el orden en que se
   * pusieron. Son del grimorio: las ven los narradores (y quien ve el grimorio),
   * no los jugadores, ni en su propia ficha.
   */
  recordatorios: Recordatorio[];
  /**
   * Los faroles que se ha puesto (o ha copiado de los del narrador): siempre 3
   * casillas, cada una un id de personaje o null. Los ven quien lo juega y quien
   * ve su personaje.
   */
  faroles: (string | null)[];
  /**
   * El farol que dice estar usando (uno de `faroles`), o null: el personaje por el
   * que se hace pasar. Lo ven los mismos que ven sus faroles (y el narrador).
   */
  farolEnUso: string | null;
}
