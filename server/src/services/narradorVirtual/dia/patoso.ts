import type { SalaPatoso } from '../../../contrato/sala';
import { droison } from '../../partida/reglas/ReglaPersonaje';
import type { SalaDeJuego } from '../../SalaDeJuego';
import type { ContextoEtapa } from '../etapas/Etapa';
import type { Ganador } from '../final/comprobarFinal';
import { duracionFrase, FRASES, PAUSA_MS } from '../frases';
import { opcionesDeAsientos } from '../grimorio';
import { contextoNoche, nombreDeAsiento, vivo } from '../mesaDeJuego';
import { identidadDe } from '../../partida/Grimorio';

/**
 * El Patoso: cuando se entera de que ha muerto (al ejecutarle, o al amanecer
 * muerto), elige en público a un jugador vivo; si es malvado, pierde el bien.
 * Cualquiera que muere puede declararse Patoso (lo sea o no) hasta que se acaba
 * esa noche (si murió de día) o ese día (si murió de noche): el narrador no espera
 * a nadie, que se notaría. Si el Patoso de verdad no ha elegido para entonces (o
 * nadie juega en su asiento), elige su estrategia por él.
 */

/** Los muertos que pueden declararse Patoso hasta `hasta` (sin repetir a quien ya puede). */
export function abrirPatosos(juego: SalaDeJuego, asientos: string[], hasta: SalaPatoso['hasta']): void {
  const narrador = juego.narrador.actual();
  if (!narrador || !asientos.length) return;
  const nuevos = asientos.filter((id) => !narrador.patosos.some((p) => p.asiento === id)).map((asiento) => ({ asiento, hasta }));
  if (nuevos.length) juego.narrador.actualizar({ patosos: [...narrador.patosos, ...nuevos] });
}

/** Ya no puede declararse Patoso (lo ha hecho, o se ha acabado su momento). */
export function quitarPatoso(juego: SalaDeJuego, asientoId: string): void {
  const narrador = juego.narrador.actual();
  if (narrador) juego.narrador.actualizar({ patosos: narrador.patosos.filter((p) => p.asiento !== asientoId) });
}

/**
 * Se acaba la noche o el día (`hasta`): quienes podían declararse hasta entonces ya
 * no pueden. El Patoso de verdad que no lo ha hecho elige ahora (lo decide su
 * estrategia) y se cuenta. Devuelve el ganador si con eso se acaba la partida.
 */
export async function cerrarPatosos(ctx: ContextoEtapa, hasta: SalaPatoso['hasta']): Promise<Ganador | null> {
  const { juego } = ctx;
  const { partida, narrador } = juego;
  const cierran = narrador.actual()?.patosos.filter((p) => p.hasta === hasta) ?? [];
  for (const { asiento } of cierran) {
    quitarPatoso(juego, asiento);
    const patoso = partida.plaza().find((a) => a.id === asiento);
    const vivos = partida.plaza().filter(vivo);
    if (!patoso || identidadDe(patoso) !== 'klutz' || !vivos.length) continue;
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
  const patoso = partida.plaza().find((a) => a.id === patosoId);
  const elegido = partida.plaza().find((a) => a.id === elegidoId);
  if (!patoso || !elegido) return null;
  partida.anotar({ tipo: 'patoso', asiento: partida.asientoDiario(patosoId), objetivo: partida.asientoDiario(elegidoId), porElNarrador });
  const frase = FRASES.patoso(nombreDeAsiento(juego, patosoId), nombreDeAsiento(juego, elegidoId));
  ctx.decir(frase);
  await new Promise<void>((seguir) => ctx.temporizador.programar(duracionFrase(frase) + PAUSA_MS, seguir));
  const deVerdad = identidadDe(patoso) === 'klutz' && !droison(contextoNoche(juego), patoso);
  if (deVerdad && partida.grimorio.alineamiento(elegido) === 'malvado') return 'malvado';
  ctx.decir(FRASES.partidaContinua());
  return null;
}
