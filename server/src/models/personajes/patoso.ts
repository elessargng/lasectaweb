import type { Plazo } from '../partida/Declaraciones';
import { droison } from './ReglaPersonaje';
import type { SalaDeJuego } from '../SalaDeJuego';
import type { ContextoEtapa } from '../narradorVirtual/etapas/Etapa';
import type { Ganador } from '../narradorVirtual/final/comprobarFinal';
import { duracionFrase, FRASES, PAUSA_MS } from '../narradorVirtual/frases';
import { opcionesDeAsientos } from '../narradorVirtual/grimorio';
import { contextoNoche, nombreDeAsiento, vivo } from '../narradorVirtual/plazaDeJuego';
import { identidadDe } from '../partida/Grimorio';
import { otroJugador, type DeclaracionDia } from './DeclaracionDia';
import type { DefinicionPersonaje } from './DefinicionPersonaje';

/**
 * El Patoso: cuando se entera de que ha muerto (al ejecutarle, o al amanecer
 * muerto), elige en público a un jugador vivo; si es malvado, pierde el bien.
 * Cualquiera que muere puede declararse Patoso (lo sea o no) hasta que se acaba
 * esa noche (si murió de día) o ese día (si murió de noche): el narrador no espera
 * a nadie, que se notaría. Si el Patoso de verdad no ha elegido para entonces (o
 * nadie juega en su asiento), elige su estrategia por él.
 */

/** Los muertos que pueden declararse Patoso hasta `hasta` (sin repetir a quien ya puede). */
export function abrirPatosos(juego: SalaDeJuego, jugadores: string[], hasta: Plazo['hasta']): void {
  if (juego.narrador.actual()) juego.partida.declaraciones.abrir(deDia.id, jugadores, hasta);
}

/** Ya no puede declararse Patoso (lo ha hecho, o se ha acabado su momento). */
export function quitarPatoso(juego: SalaDeJuego, jugadorId: string): void {
  juego.partida.declaraciones.cerrar(deDia.id, jugadorId);
}

/**
 * Se acaba la noche o el día (`hasta`): quienes podían declararse hasta entonces ya
 * no pueden. El Patoso de verdad que no lo ha hecho elige ahora (lo decide su
 * estrategia) y se cuenta. Devuelve el ganador si con eso se acaba la partida.
 */
export async function cerrarPatosos(ctx: ContextoEtapa, hasta: Plazo['hasta']): Promise<Ganador | null> {
  const { juego } = ctx;
  const { partida } = juego;
  const cierran = partida.declaraciones.abiertos(deDia.id, hasta);
  for (const { jugador: asiento } of cierran) {
    quitarPatoso(juego, asiento);
    const delAsiento = partida.plaza().find((a) => a.id === asiento);
    const vivos = partida.plaza().filter(vivo);
    if (!delAsiento || identidadDe(delAsiento) !== 'klutz' || !vivos.length) continue;
    const elegido = await ctx.decidir({
      motivo: 'patoso',
      pregunta: `El Patoso (${nombreDeAsiento(juego, asiento)}) no ha elegido: el jugador vivo que elige.`,
      opciones: opcionesDeAsientos(juego, vivos),
    });
    const ganador = await contarPatoso(ctx, asiento, elegido.id, true);
    if (ganador) return ganador;
  }
  return null;
}

/**
 * Lo cuenta con una pausa: «Pepe se declara patoso y elige a Juan y…» y, si es el
 * Patoso de verdad (sano) y Juan es malvado, se acaba (gana el mal); si no, «La
 * partida continúa.». `porElNarrador`: no eligió a tiempo y eligió su estrategia.
 * Devuelve el ganador, si lo hay.
 */
export async function contarPatoso(ctx: ContextoEtapa, patosoId: string, elegidoId: string, porElNarrador = false): Promise<Ganador | null> {
  const { juego } = ctx;
  const { partida } = juego;
  quitarPatoso(juego, patosoId);
  const quien = partida.plaza().find((a) => a.id === patosoId);
  const elegido = partida.plaza().find((a) => a.id === elegidoId);
  if (!quien || !elegido) return null;
  partida.anotar({ tipo: 'patoso', asiento: partida.asientoDiario(patosoId), objetivo: partida.asientoDiario(elegidoId), porElNarrador });
  const frase = FRASES.patoso(nombreDeAsiento(juego, patosoId), nombreDeAsiento(juego, elegidoId));
  ctx.decir(frase);
  await new Promise<void>((seguir) => ctx.temporizador.programar(duracionFrase(frase) + PAUSA_MS, seguir));
  const deVerdad = identidadDe(quien) === 'klutz' && !droison(contextoNoche(juego), quien);
  if (deVerdad && partida.grimorio.alineamiento(elegido) === 'malvado') return 'malvado';
  ctx.decir(FRASES.partidaContinua());
  return null;
}

/**
 * Declararse Patoso: el muerto que aún está en su plazo (ver abrirPatosos) elige a
 * un jugador vivo. datos: { jugadorId } del elegido.
 */
const deDia: DeclaracionDia = {
  id: 'patoso',
  personaje: 'klutz',
  publica: true,
  puede: ({ partida, narrador }, yo) => {
    const mio = partida.jugadorDe(yo.id)?.id;
    const etapa = narrador.actual()?.etapa;
    return !!etapa && etapa !== 'revelando' && !!mio && partida.declaraciones.enPlazo(deDia.id, mio);
  },
  noPuede: () => 'Ya no puedes declararte Patoso.',
  async declarar(ctx, yo, datos) {
    const { partida } = ctx.juego;
    const elegido = otroJugador(ctx.juego, yo, datos, 'Elige a otro jugador.');
    if ('error' in elegido) return elegido;
    const mio = partida.jugadorDe(yo)?.id;
    if (!mio) return { error: 'No estás sentado.' };
    if (!vivo(partida.plaza().find((a) => a.id === elegido.jugadorId)!)) return { error: 'Elige a un jugador vivo.' };
    return { contar: () => contarPatoso(ctx, mio, elegido.jugadorId) };
  },
};

export const patoso: DefinicionPersonaje = { deDia };
