import { NarradorVirtualEnMemoria, type NarradorVirtualRepository } from '../repositories/NarradorVirtualRepository';
import { NarradorVirtual } from './narradorVirtual/NarradorVirtual';
import { Partida } from './partida/Partida';
import { Sala } from './sala/Sala';

/**
 * La sala de juego, en memoria: se pierde al reiniciar el servidor, como una sala
 * que se vacía. Junta la sala (quién está y dónde se sienta, ver Sala), la
 * partida que se juega en ella (ver Partida) y el narrador virtual, que es de las
 * dos (ver NarradorVirtual). Quien la usa coge la pieza que necesita:
 * `const { sala, partida } = juego`.
 */
export class SalaDeJuego {
  /** Quién está en la sala y en qué asiento se sienta cada jugador. */
  readonly sala = new Sala();
  /** La partida que se juega en la sala. */
  readonly partida = new Partida(this.sala, { hayNarradorVirtual: () => !!this.narrador.actual() });
  /** El narrador virtual, si lo hay: su participante es de la sala; lo que lleva, de la partida. */
  readonly narrador: NarradorVirtual;

  constructor(
    /** Dónde se guarda el narrador virtual de la sala (ver NarradorVirtualService). */
    narradoresVirtuales: NarradorVirtualRepository = new NarradorVirtualEnMemoria(),
  ) {
    this.narrador = new NarradorVirtual(narradoresVirtuales, this.sala, this.partida);
  }
}
