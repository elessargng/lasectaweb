import type { AsientoDiario, HechoDiario } from '../../compartido/diario';

/** Donde las piezas de la partida apuntan lo que se hace con ellas (ver Partida.anotar y Registro). */
export interface Diario {
  anotar(hecho: HechoDiario): void;
  /** Un asiento como se apunta: su número, su id y quien se sienta ahora. */
  asiento(jugadorId: string): AsientoDiario;
}
