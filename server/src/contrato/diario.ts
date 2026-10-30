import type { RespuestaArtista } from './artista';
import type { FichaDespertar, SalaAlineamiento, SalaFase, TarjetaDespertar } from './sala';

/**
 * El diario de la partida: todo lo que se hace en ella, por noches y días, para
 * verlo en el historial al terminar. Lo apunta la sala al pasar (ver
 * SalaService.anotar), con o sin narrador virtual; lo que solo hace el narrador
 * virtual (el disparo del Exterminador, el Patoso, el Artista) solo sale con él.
 */

/** Un asiento tal como estaba al apuntarlo: su número en la mesa y quien se sentaba (null: libre). */
export interface AsientoDiario {
  numero: number;
  nombre: string | null;
}

export type HechoDiario =
  /** Un mensaje en un despertar: del narrador al asiento o del jugador al narrador. `eleccion`: a cuántos le pide elegir. */
  | {
      tipo: 'despertar';
      asiento: AsientoDiario;
      delNarrador: boolean;
      ficha: FichaDespertar | null;
      tarjeta: TarjetaDespertar | null;
      jugadores: AsientoDiario[];
      personajes: string[];
      texto: string | null;
      alineamiento: SalaAlineamiento | null;
      eleccion: number | null;
    }
  /** Muere (de noche, cuando se le pone la muerte, aunque se anuncie al amanecer). */
  | { tipo: 'muere'; asiento: AsientoDiario }
  | { tipo: 'revive'; asiento: AsientoDiario }
  | { tipo: 'ejecucion'; asiento: AsientoDiario }
  /** Su ficha pasa a ser otra (null: se le quita). */
  | { tipo: 'personaje'; asiento: AsientoDiario; personaje: string | null }
  | { tipo: 'alineamiento'; asiento: AsientoDiario; alineamiento: SalaAlineamiento }
  /** Se le pone (o se le quita) un recordatorio. */
  | { tipo: 'recordatorio'; asiento: AsientoDiario; personaje: string; texto: string; quitado: boolean }
  /** El narrador le envía una copia del grimorio. */
  | { tipo: 'grimorio'; asiento: AsientoDiario }
  /** Pone un farol en una casilla (null: la vacía). Sin asiento, los del narrador para el demonio. */
  | { tipo: 'farol'; asiento: AsientoDiario | null; posicion: number; personaje: string | null }
  /** Copia en sus faroles los que le ha enseñado el narrador. */
  | { tipo: 'copiaFaroles'; asiento: AsientoDiario; personajes: string[] }
  /** Dice que se hace pasar por uno de sus faroles (null: por ninguno). */
  | { tipo: 'usaFarol'; asiento: AsientoDiario; personaje: string | null }
  /** En un señalamiento, señala a otro (null: deja de señalar). */
  | { tipo: 'senala'; asiento: AsientoDiario; objetivo: AsientoDiario | null }
  /** Se declara Exterminador y dispara (con narrador virtual). */
  | { tipo: 'exterminador'; asiento: AsientoDiario; objetivo: AsientoDiario; muere: boolean }
  /** Se declara Patoso y elige (con narrador virtual). `porElNarrador`: no eligió a tiempo y eligió el narrador. */
  | { tipo: 'patoso'; asiento: AsientoDiario; objetivo: AsientoDiario; porElNarrador: boolean }
  /** Hace la pregunta del Artista (con narrador virtual). */
  | { tipo: 'artista'; asiento: AsientoDiario; pregunta: string; respuesta: RespuestaArtista };

/** Un hecho del diario, con cuándo pasó. */
export type EntradaDiario = HechoDiario & {
  fase: { momento: SalaFase['momento']; numero: number };
  /** ms */
  hora: number;
};
