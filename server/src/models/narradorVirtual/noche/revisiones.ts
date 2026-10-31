import type { DesenlaceDespertar, EnvioDespertar } from '../../compartido/despertar';
import type { HabilidadNoche } from '../../partida/DespertarGuiado';
import { habilidadesDelGuion } from '../../partida/habilidades';
import { OK } from '../../partida/habilidades/HabilidadNocturna';
import type { ContextoEtapa } from '../etapas/Etapa';
import { describirAsiento, describirEnvio, describirOpcion, describirPersonaje } from '../grimorio';
import { contextoNoche } from '../plazaDeJuego';
import { destapaAlMal, opcionesFalsas, probabilidadVerdad, recordarDroison } from './criterioDroison';
import { informacionesFalsas } from './informacionFalsa';
import { ponerRecordatorio } from './requisitos';

/**
 * Lo que revisa el narrador en el despertar guiado (droison, alguien que puede
 * registrar como otro, el Alcalde): su estrategia elige una de las opciones y la
 * manda. Droison, según su estrategia (y lo que aconseja criterioDroison), la de
 * verdad o una falsa con su misma forma. Si lo que ha hecho el demonio puede acabar de
 * varias maneras (el Alcalde), además, decide cuál.
 */
export async function resolverRevision(ctx: ContextoEtapa, fila: HabilidadNoche): Promise<boolean> {
  const desenlaces = fila.avisos.find((a) => a.tipo === 'desenlaces');
  if (desenlaces?.tipo === 'desenlaces') await elegirDesenlace(ctx, fila.personaje, desenlaces.desenlaces);
  const envio = fila.opciones.length ? ((await droison(ctx, fila)) ?? (await elegirOpcion(ctx, fila))) : OK;
  return (await ctx.plaza.accion('narrador:resolverHabilidad', { personajeId: fila.personaje, ...envio })).ok;
}

/** Una de las respuestas propuestas (la primera es la de verdad; las demás, registrando como otro). */
function elegirOpcion(ctx: ContextoEtapa, fila: HabilidadNoche): Promise<EnvioDespertar> {
  return ctx.decidir({
    motivo: 'revision',
    pregunta: `Qué se le dice a ${describirPersonaje(ctx.juego, fila.personaje)}: alguien puede registrar como otro.`,
    opciones: fila.opciones.map((o, i) => ({
      clave: `o${i + 1}`,
      descripcion: describirOpcion(ctx.juego, o),
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
async function droison(ctx: ContextoEtapa, fila: HabilidadNoche): Promise<EnvioDespertar | null> {
  const { partida } = ctx.juego;
  if (!fila.avisos.some((a) => a.tipo === 'envenenado' || a.tipo === 'borracho')) return null;
  const habilidad = habilidadesDelGuion(partida.guion.actual()?.edicion ?? null).get(fila.personaje);
  if (!habilidad) return null;
  // La primera opción es la de verdad
  const verdadera = fila.opciones[0].envio;
  const falsas = informacionesFalsas({ verdadera, habilidad, ctx: contextoNoche(ctx.juego), personajes: partida.guion.actual()?.personajes ?? [] });
  if (!falsas.length) return null;
  const { recuerdos } = ctx;
  const { juego } = ctx;
  const quien = describirPersonaje(juego, fila.personaje);
  const verdad = await ctx.siONo({
    motivo: 'droisonVerdad',
    pregunta: `${quien} está envenenado o borracho: ¿se le dice la verdad (${describirEnvio(juego, verdadera)})? ${
      destapaAlMal(juego, verdadera) ? 'La verdad señala al mal.' : 'La verdad no le cuesta nada al mal.'
    }`,
    si: 'Recibe la información de verdad.',
    no: 'Recibe una información falsa.',
    probabilidad: probabilidadVerdad(juego, fila.jugador, fila.personaje, verdadera, recuerdos),
  });
  const dada = verdad
    ? verdadera
    : await ctx.decidir({
        motivo: 'informacionFalsa',
        pregunta: `La información falsa que recibe ${quien} (la de verdad sería: ${describirEnvio(juego, verdadera)}).`,
        opciones: opcionesFalsas(juego, fila.jugador, fila.personaje, verdadera, falsas, recuerdos),
      });
  recordarDroison(recuerdos, fila.jugador, fila.personaje, verdadera, dada);
  return dada;
}

/**
 * Lo que hace el demonio puede acabar de varias maneras (el Alcalde la rebota):
 * su estrategia elige una (la primera, la que toca sin el narrador) y se aplica.
 */
async function elegirDesenlace(ctx: ContextoEtapa, demonio: string, desenlaces: DesenlaceDespertar[]): Promise<void> {
  const { juego } = ctx;
  const asiento = (id: string) => juego.partida.plaza().find((a) => a.id === id);
  const elegido = await ctx.decidir({
    motivo: 'desenlace',
    pregunta: 'El demonio ha atacado: a quién le llega al final.',
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
  if (elegido.gasta) await ponerRecordatorio(ctx, elegido.gasta.asiento, elegido.gasta.personaje, elegido.gasta.texto);
  if (!elegido.muere) return;
  await ponerRecordatorio(ctx, elegido.muere, demonio, 'Dead');
  await ctx.plaza.accion('narrador:cambiarVida', { jugadorId: elegido.muere, muerto: true });
}
