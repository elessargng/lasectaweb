import type { SalaEnvioDespertar, SalaHabilidadNoche } from '../../../contrato/sala';
import { habilidadesDelGuion } from '../../partida/habilidades';
import { OK } from '../../partida/habilidades/HabilidadNocturna';
import type { ContextoEtapa } from '../etapas/Etapa';
import { contextoNoche, vivo } from '../mesaDeJuego';
import { informacionFalsa } from './informacionFalsa';
import { ponerRecordatorio } from './requisitos';

/**
 * Lo que revisa el narrador en el despertar guiado (droison, alguien que puede
 * registrar como otro, el Alcalde): elige una de las opciones con su estrategia y
 * la manda. Droison, según su estrategia, la de verdad o una falsa con su misma
 * forma. Con el Alcalde, además, decide si muere él o rebota a otro.
 */
export async function resolverRevision(ctx: ContextoEtapa, fila: SalaHabilidadNoche): Promise<boolean> {
  const alcalde = fila.avisos.find((a) => a.tipo === 'alcalde');
  if (alcalde && 'asiento' in alcalde) await alcaldeAtacado(ctx, fila.personaje, alcalde.asiento);
  const envio = fila.opciones.length ? (falsaSiDroison(ctx, fila) ?? ctx.estrategia.elegirUno(fila.opciones).envio) : OK;
  return (await ctx.mesa.accion('narrador:resolverHabilidad', { personajeId: fila.personaje, ...envio })).ok;
}

/** Droison y sin que toque la verdad: una información falsa (o null, si no toca o no se sabe inventar). */
function falsaSiDroison(ctx: ContextoEtapa, fila: SalaHabilidadNoche): SalaEnvioDespertar | null {
  const droison = fila.avisos.some((a) => a.tipo === 'envenenado' || a.tipo === 'borracho');
  if (!droison || ctx.estrategia.droisonDaLaVerdad()) return null;
  const habilidad = habilidadesDelGuion(ctx.sala.guion()?.edicion ?? null).get(fila.personaje);
  if (!habilidad) return null;
  return informacionFalsa({
    // La primera opción es la de verdad
    verdadera: fila.opciones[0].envio,
    habilidad,
    ctx: contextoNoche(ctx.sala),
    personajes: ctx.sala.guion()?.personajes ?? [],
    elegirUno: (opciones) => ctx.estrategia.elegirUno(opciones),
  });
}

/** El demonio ataca al Alcalde: muere él o la muerte rebota a otro vivo (no al demonio). */
async function alcaldeAtacado(ctx: ContextoEtapa, demonio: string, alcaldeId: string): Promise<void> {
  const otros = ctx.sala.asientos().filter((a) => vivo(a) && a.id !== alcaldeId && a.personaje !== demonio);
  const muere = ctx.estrategia.elegirUno(['alcalde', 'rebota'] as const) === 'rebota' && otros.length ? ctx.estrategia.elegirUno(otros).id : alcaldeId;
  await ponerRecordatorio(ctx, muere, demonio, 'Dead');
  await ctx.mesa.accion('narrador:cambiarVida', { asientoId: muere, muerto: true });
}
