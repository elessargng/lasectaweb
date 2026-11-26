import { NarradorVirtual } from './narradorVirtual/NarradorVirtual';
import type { Azar } from './partida/azar';
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
  /** El azar viene de fuera (infra/azar; en los tests, con semilla). */
  constructor(private readonly azar: Azar) {}

  /** Quién está en la sala y en qué asiento se sienta cada jugador. */
  readonly sala = new Sala(this.azar);
  /** La partida que se juega en la sala. */
  readonly partida: Partida = new Partida(this.sala, { hayNarradorVirtual: () => !!this.narrador.actual(), azar: this.azar });
  /** El narrador virtual, si lo hay: su participante es de la sala; lo que lleva, de la partida. */
  readonly narrador: NarradorVirtual = new NarradorVirtual(this.sala, this.partida);
}
