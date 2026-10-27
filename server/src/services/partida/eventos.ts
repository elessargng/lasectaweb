import type { SalaAlineamiento, SalaRegistroVotacion } from '../../contrato/sala';

/**
 * Lo que va pasando en la partida, para quien quiera enterarse sin que la sala
 * sepa de él (las estadísticas, por ejemplo). La sala los avisa en el orden en
 * que pasan; quien escucha tiene que estar suscrito desde el principio.
 */

/** Cuántos cambios de fase recuerda la máquina del tiempo del narrador. */
export const PASOS_DE_FASE_MAX = 20;

/** Un asiento de la mesa en un momento de la partida. */
export interface FotoAsiento {
  /** Su número en la mesa (1, el de las 12). */
  numero: number;
  /** Quien se sienta (su nombre en la sala), o null si está libre. */
  nombre: string | null;
  /** Su cuenta, si la tiene. */
  userId: string | null;
  /** Quien es de verdad (su «Is The …» o su ficha). */
  personaje: string | null;
  /** La ficha que lleva, si no es quien es de verdad (el Borracho que se cree Lavandera). */
  ficha: string | null;
  alineamiento: SalaAlineamiento | null;
  muerto: boolean;
}

export type EventoPartida =
  /** Anochece. `conCalavera`: las cuentas de quien llevaba la calavera al caer la noche (lo ejecutó la plaza). */
  | { tipo: 'anochece'; desdePreparacion: boolean; mesa: FotoAsiento[]; conCalavera: string[] }
  /** Amanece: empieza el día con la mesa así. */
  | { tipo: 'amanece'; mesa: FotoAsiento[] }
  /** Alguien nomina a alguien (sus cuentas, o null sin cuenta o con el asiento libre). */
  | { tipo: 'nominacion'; nomina: string | null; nominado: string | null }
  /** Alguien ha votado (su cuenta, o null). */
  | { tipo: 'voto'; userId: string | null }
  /** El narrador ha ejecutado a alguien (su cuenta, o null). */
  | { tipo: 'ejecucion'; userId: string | null }
  /**
   * La máquina del tiempo: se vuelve a la fase anterior. `deshace`: se deshace el
   * último cambio de fase (el último anochece o amanece), con lo que trajo; si
   * no, solo se vuelve atrás. `aPreparacion`: la partida aún no ha empezado.
   */
  | { tipo: 'vueltaAtras'; deshace: boolean; aPreparacion: boolean }
  /** Se limpia el grimorio: otra partida, desde el principio. */
  | { tipo: 'nuevaPartida' }
  /** Se revela el grimorio: la partida ha terminado. */
  | {
      tipo: 'partidaTerminada';
      ganador: SalaAlineamiento;
      /** Lo que ha pasado (CAUSAS_FIN_PARTIDA) y, si es de alguien concreto (el esbirro que cazó a la Doncel), su cuenta. */
      causas: { id: string; userId?: string | null }[];
      mesa: FotoAsiento[];
      narradores: { userId: string | null; nombre: string }[];
      npcs: string[];
      votaciones: SalaRegistroVotacion[];
      guion: string | null;
      edicion: string | null;
      /** Hasta qué día (o noche) se jugó. */
      dias: number;
    };

/** Quien escucha lo que pasa en la partida. */
export type OyentePartida = (evento: EventoPartida) => void;
