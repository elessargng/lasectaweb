import { barajar } from '../../partida/azar';
import { identidadDe } from '../../partida/Grimorio';
import { heredadosADemonio, esDemonio, type Ganador } from '../final/comprobarFinal';
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
    const { partida, narrador } = ctx.juego;
    if (!this.yaDicho) ctx.decir(FRASES.revelamos());
    // Se acaba la partida: nadie más puede declararse Patoso
    partida.declaraciones.cerrarTodos();
    // Si acaba antes de la noche en que lo sería, la Mujer Escarlata que ha heredado se revela ya como el Imp
    await heredadosADemonio(ctx);
    const jugadores = partida.plaza();
    // Lo apuntado para los logros, de quien sigue en juego (si no, no se podría revelar)
    const enJuego = new Set(jugadores.map(identidadDe));
    const causas = [...ctx.recuerdos.cronica.causas].filter((c) => enJuego.has(c));
    if (!(await ctx.plaza.revelarGrimorio(this.ganador, causas)).ok) return;
    const demonios = jugadores.filter((a) => esDemonio(ctx.juego, a));
    const orden = [...barajar(jugadores.filter((a) => !demonios.includes(a)), ctx.azar), ...barajar(demonios, ctx.azar)];
    void this.revelar(ctx, orden.map((a) => a.id));
  }

  alSalir(): void {
    this.seguir = false;
    this.cancelar?.();
  }

  private async revelar(ctx: ContextoEtapa, orden: string[]): Promise<void> {
    // Tras «Revelamos el grimorio», un respiro antes de la primera
    const { partida } = ctx.juego;
    let espera = ENTRE_FICHAS_MS;
    for (const jugadorId of orden) {
      await new Promise<void>((listo) => (this.cancelar = ctx.temporizador.programar(espera, listo)));
      if (!this.seguir) return;
      const jugador = partida.plaza().find((a) => a.id === jugadorId);
      if (!jugador) continue;
      const frase = fraseAlRevelar(ctx.recuerdos.cronica, ctx.juego, jugador);
      await ctx.plaza.revelarFicha(jugadorId);
      ctx.decir(frase);
      espera = Math.max(ENTRE_FICHAS_MS, duracionFrase(frase));
    }
    // Revelado todo (y dicho lo último), quién gana
    await new Promise<void>((listo) => (this.cancelar = ctx.temporizador.programar(espera, listo)));
    if (this.seguir) ctx.decir(FRASES.gana(this.ganador, ctx.azar));
  }
}
