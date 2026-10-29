import type { SalaEnvioDespertar, SalaHabilidadNoche } from '../../../contrato/sala';
import { habilidadesDelGuion } from '../../partida/habilidades';
import { OK } from '../../partida/habilidades/HabilidadNocturna';
import type { ContextoEtapa } from '../etapas/Etapa';
import { describirEnvio, describirOpcion, describirPersonaje, opcionesDeAsientos } from '../grimorio';
import { contextoNoche, vivo } from '../mesaDeJuego';
import { destapaAlMal, opcionesFalsas, probabilidadVerdad, recordarDroison } from './criterioDroison';
import { informacionesFalsas } from './informacionFalsa';
import { ponerRecordatorio } from './requisitos';

/**
 * Lo que revisa el narrador en el despertar guiado (droison, alguien que puede
 * registrar como otro, el Alcalde): su estrategia elige una de las opciones y la
 * manda. Droison, según su estrategia (y lo que aconseja criterioDroison), la de
 * verdad o una falsa con su misma forma. Con el Alcalde, además, decide si muere él o rebota a otro.
 */
export async function resolverRevision(ctx: ContextoEtapa, fila: SalaHabilidadNoche): Promise<boolean> {
  const alcalde = fila.avisos.find((a) => a.tipo === 'alcalde');
  if (alcalde && 'asiento' in alcalde) await alcaldeAtacado(ctx, fila.personaje, alcalde.asiento);
  const envio = fila.opciones.length ? ((await droison(ctx, fila)) ?? (await elegirOpcion(ctx, fila))) : OK;
  return (await ctx.mesa.accion('narrador:resolverHabilidad', { personajeId: fila.personaje, ...envio })).ok;
}

/** Una de las respuestas propuestas (la primera es la de verdad; las demás, registrando como otro). */
function elegirOpcion(ctx: ContextoEtapa, fila: SalaHabilidadNoche): Promise<SalaEnvioDespertar> {
  return ctx.decidir({
    motivo: 'revision',
    pregunta: `Qué se le dice a ${describirPersonaje(ctx.sala, fila.personaje)}: alguien puede registrar como otro.`,
    opciones: fila.opciones.map((o, i) => ({
      clave: `o${i + 1}`,
      descripcion: describirOpcion(ctx.sala, o),
      valor: o.envio,
      ...(i === 0 ? { rasgos: ['verdad' as const] } : {}),
    })),
  });
}

/**
 * Droison: la información de verdad o una falsa (lo que decida su estrategia, con
 * lo que aconseja criterioDroison), y se apunta para ser coherente otras noches.
 * Null si no está droison o no se sabe inventar una falsa.
 */
async function droison(ctx: ContextoEtapa, fila: SalaHabilidadNoche): Promise<SalaEnvioDespertar | null> {
  if (!fila.avisos.some((a) => a.tipo === 'envenenado' || a.tipo === 'borracho')) return null;
  const habilidad = habilidadesDelGuion(ctx.sala.guion()?.edicion ?? null).get(fila.personaje);
  if (!habilidad) return null;
  // La primera opción es la de verdad
  const verdadera = fila.opciones[0].envio;
  const falsas = informacionesFalsas({ verdadera, habilidad, ctx: contextoNoche(ctx.sala), personajes: ctx.sala.guion()?.personajes ?? [] });
  if (!falsas.length) return null;
  const { sala, recuerdos } = ctx;
  const quien = describirPersonaje(sala, fila.personaje);
  const verdad = await ctx.siONo({
    motivo: 'droisonVerdad',
    pregunta: `${quien} está envenenado o borracho: ¿se le dice la verdad (${describirEnvio(sala, verdadera)})? ${
      destapaAlMal(sala, verdadera) ? 'La verdad señala al mal.' : 'La verdad no le cuesta nada al mal.'
    }`,
    si: 'Recibe la información de verdad.',
    no: 'Recibe una información falsa.',
    probabilidad: probabilidadVerdad(sala, fila.asiento, fila.personaje, verdadera, recuerdos),
  });
  const dada = verdad
    ? verdadera
    : await ctx.decidir({
        motivo: 'informacionFalsa',
        pregunta: `La información falsa que recibe ${quien} (la de verdad sería: ${describirEnvio(sala, verdadera)}).`,
        opciones: opcionesFalsas(sala, fila.asiento, fila.personaje, verdadera, falsas, recuerdos),
      });
  recordarDroison(recuerdos, fila.asiento, fila.personaje, verdadera, dada);
  return dada;
}

/** El demonio ataca al Alcalde: muere él o la muerte rebota a otro vivo (no al demonio). */
async function alcaldeAtacado(ctx: ContextoEtapa, demonio: string, alcaldeId: string): Promise<void> {
  const otros = ctx.sala.asientos().filter((a) => vivo(a) && a.id !== alcaldeId && a.personaje !== demonio);
  const rebota =
    otros.length > 0 &&
    (await ctx.siONo({
      motivo: 'alcaldeRebota',
      pregunta: 'El demonio ataca al Alcalde: ¿la muerte rebota a otro jugador?',
      si: 'Muere otro jugador en su lugar.',
      no: 'Muere el Alcalde.',
    }));
  const muere = rebota
    ? (await ctx.decidir({ motivo: 'alcaldeAQuien', pregunta: 'A quién rebota la muerte del Alcalde.', opciones: opcionesDeAsientos(ctx.sala, otros) })).id
    : alcaldeId;
  await ponerRecordatorio(ctx, muere, demonio, 'Dead');
  await ctx.mesa.accion('narrador:cambiarVida', { asientoId: muere, muerto: true });
}
