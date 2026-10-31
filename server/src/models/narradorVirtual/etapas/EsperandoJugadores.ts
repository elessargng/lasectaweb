import { FRASES } from '../frases';
import type { ContextoEtapa, Etapa } from './Etapa';
import { Noche } from './Noche';

/**
 * Con la partida preparada (asientos, guion y bolsa), espera a que se llene la
 * plaza. Llena, reparte los personajes y empieza la primera noche.
 */
export class EsperandoJugadores implements Etapa {
  readonly id = 'esperandoJugadores' as const;

  async alCambiar(ctx: ContextoEtapa): Promise<void> {
    const { partida } = ctx.juego;
    const jugadores = partida.plaza();
    if (jugadores.length === 0 || jugadores.some((a) => !a.participanteId)) return;
    const reparto = await ctx.plaza.accion('narrador:asignarPersonajes');
    if (!reparto.ok) return;
    const noche = await ctx.plaza.accion('narrador:irANoche');
    if (!noche.ok) return;
    ctx.decir(FRASES.primeraNoche());
    await ctx.pasarA(new Noche());
  }
}
