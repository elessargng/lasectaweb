import { barajar } from '../../../contrato/bolsaAleatoria';
import { escarlataAImp, esDemonio, type Ganador } from '../final/comprobarFinal';
import { fraseAlRevelar } from '../final/cronica';
import { duracionFrase, FRASES } from '../frases';
import type { ContextoEtapa, Etapa } from './Etapa';

/** Lo que espera entre ficha y ficha al revelar (ms), como poco: más si la frase es larga. */
const ENTRE_FICHAS_MS = 2500;

/**
 * Se acaba la partida: revela el grimorio con el bando que gana, ficha a ficha en
 * un orden al azar, con los demonios los últimos, y de cada uno cuenta quién era,
 * lo que eligió y recibió cada noche y cómo murió (ver cronica), y al acabar dice
 * quién gana. Si aún no lo
 * ha dicho (al ejecutar ya dice «…y revelamos el grimorio»), dice «Revelamos el grimorio».
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
    // Se acaba la partida: nadie más puede declararse Patoso
    ctx.sala.actualizarNarradorVirtual({ patosos: [] });
    // Si acaba antes de la noche en que lo sería, la Mujer Escarlata que ha heredado se revela ya como el Imp
    await escarlataAImp(ctx);
    if (!(await ctx.mesa.accion('narrador:revelarGrimorio', { ganador: this.ganador })).ok) return;
    const asientos = ctx.sala.asientos();
    const demonios = asientos.filter((a) => esDemonio(ctx.sala, a));
    const orden = [...barajar(asientos.filter((a) => !demonios.includes(a)), ctx.azar), ...barajar(demonios, ctx.azar)];
    void this.revelar(ctx, orden.map((a) => a.id));
  }

  alSalir(): void {
    this.seguir = false;
    this.cancelar?.();
  }

  private async revelar(ctx: ContextoEtapa, orden: string[]): Promise<void> {
    // Tras «Revelamos el grimorio», un respiro antes de la primera
    let espera = ENTRE_FICHAS_MS;
    for (const asientoId of orden) {
      await new Promise<void>((listo) => (this.cancelar = ctx.temporizador.programar(espera, listo)));
      if (!this.seguir) return;
      const asiento = ctx.sala.asientos().find((a) => a.id === asientoId);
      if (!asiento) continue;
      const frase = fraseAlRevelar(ctx.recuerdos.cronica, ctx.sala, asiento);
      await ctx.mesa.accion('narrador:revelarFicha', { asientoId });
      ctx.decir(frase);
      espera = Math.max(ENTRE_FICHAS_MS, duracionFrase(frase));
    }
    // Revelado todo (y dicho lo último), quién gana
    await new Promise<void>((listo) => (this.cancelar = ctx.temporizador.programar(espera, listo)));
    if (this.seguir) ctx.decir(FRASES.gana(this.ganador, ctx.azar));
  }
}
