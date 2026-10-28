import { esDemonio, type Ganador } from '../final/comprobarFinal';
import { FRASES } from '../frases';
import type { ContextoEtapa, Etapa } from './Etapa';

/** Lo que espera entre ficha y ficha al revelar (ms). */
const ENTRE_FICHAS_MS = 2500;

/**
 * Se acaba la partida: revela el grimorio con el bando que gana, ficha a ficha en
 * un orden que decide su estrategia, con los demonios los últimos. Si aún no lo
 * ha dicho (al ejecutar ya dice «…y revelamos grimorio»), dice «Revelamos el grimorio».
 */
export class Revelando implements Etapa {
  readonly id = 'revelando' as const;
  private cancelar: (() => void) | null = null;
  private seguir = true;

  constructor(
    private readonly ganador: Ganador,
    private readonly yaDicho = false,
  ) {}

  async alEntrar(ctx: ContextoEtapa): Promise<void> {
    if (!this.yaDicho) ctx.decir(FRASES.revelamos());
    if (!(await ctx.mesa.accion('narrador:revelarGrimorio', { ganador: this.ganador })).ok) return;
    const asientos = ctx.sala.asientos();
    const demonios = asientos.filter((a) => esDemonio(ctx.sala, a));
    const orden = [...ctx.estrategia.barajar(asientos.filter((a) => !demonios.includes(a))), ...ctx.estrategia.barajar(demonios)];
    void this.revelar(ctx, orden.map((a) => a.id));
  }

  alSalir(): void {
    this.seguir = false;
    this.cancelar?.();
  }

  private async revelar(ctx: ContextoEtapa, orden: string[]): Promise<void> {
    for (const asientoId of orden) {
      await new Promise<void>((listo) => (this.cancelar = ctx.temporizador.programar(ENTRE_FICHAS_MS, listo)));
      if (!this.seguir) return;
      await ctx.mesa.accion('narrador:revelarFicha', { asientoId });
    }
  }
}
