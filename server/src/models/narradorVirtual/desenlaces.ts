import type { DesenlaceDespertar } from '../compartido/despertar';
import type { ContextoEtapa } from './etapas/Etapa';
import { describirAsiento } from './grimorio';

/**
 * Lo que alguien le ha hecho a un jugador puede acabar de varias maneras (ver
 * Objetivo: el Alcalde la rebota): con una, esa; con varias, la elige su
 * estrategia (la primera, la que toca sin el narrador).
 */
export async function elegirDesenlace(ctx: ContextoEtapa, pregunta: string, desenlaces: readonly DesenlaceDespertar[]): Promise<DesenlaceDespertar> {
  if (desenlaces.length === 1) return desenlaces[0];
  const { juego } = ctx;
  const asiento = (id: string) => juego.partida.plaza().find((a) => a.id === id);
  return ctx.decidir({
    motivo: 'desenlace',
    pregunta,
    opciones: desenlaces.map((d, i) => {
      const quien = d.muere ? asiento(d.muere) : undefined;
      return {
        clave: `d${i + 1}`,
        descripcion: quien ? `Muere ${describirAsiento(juego, quien)}.` : 'No muere nadie.',
        valor: d,
        ...(i === 0 ? { rasgos: ['verdad' as const] } : {}),
      };
    }),
  });
}
