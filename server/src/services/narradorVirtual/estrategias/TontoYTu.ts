import type { Azar } from '../puertos';
import type { Decision, EstrategiaNarrador, PreguntaSiONo } from './EstrategiaNarrador';

/**
 * «Tonto y tú»: elige siempre al azar entre lo que se puede, con el peso que
 * aconseja la mesa en cada opción, y contesta sí o no con la probabilidad que
 * aconseja (o a cara o cruz). No mira el grimorio.
 */
export class TontoYTu implements EstrategiaNarrador {
  constructor(private readonly sorteo: Azar = Math.random) {}

  async elegir<T>({ opciones }: Decision<T>): Promise<T> {
    return this.elegirAhora(opciones).valor;
  }

  async siONo({ probabilidad = 0.5 }: PreguntaSiONo): Promise<boolean> {
    return this.sorteo() < probabilidad;
  }

  /** Lo mismo, sin esperar (lo usa el respaldo de Jarvis). */
  elegirAhora<O extends { peso?: number }>(opciones: readonly O[]): O {
    if (opciones.length === 0) throw new Error('No hay nada entre lo que elegir.');
    const total = opciones.reduce((s, o) => s + (o.peso ?? 1), 0);
    let tirada = this.sorteo() * total;
    for (const o of opciones) {
      tirada -= o.peso ?? 1;
      if (tirada < 0) return o;
    }
    return opciones[opciones.length - 1];
  }
}
