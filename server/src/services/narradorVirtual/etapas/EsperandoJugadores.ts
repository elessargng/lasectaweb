import { FRASES } from '../frases';
import type { ContextoEtapa, Etapa } from './Etapa';
import { Noche } from './Noche';

/**
 * Con la partida preparada (asientos, guion y bolsa), espera a que se llene la
 * mesa. Llena, reparte los personajes y empieza la primera noche.
 */
export class EsperandoJugadores implements Etapa {
  readonly id = 'esperandoJugadores' as const;

  async alCambiar(ctx: ContextoEtapa): Promise<void> {
    const { partida } = ctx.juego;
    const asientos = partida.plaza();
    if (asientos.length === 0 || asientos.some((a) => !a.participanteId)) return;
    const reparto = await ctx.mesa.accion('narrador:asignarPersonajes');
    if (!reparto.ok) return;
    const noche = await ctx.mesa.accion('narrador:irANoche');
    if (!noche.ok) return;
    ctx.decir(FRASES.primeraNoche());
    await ctx.pasarA(new Noche());
  }
}
