import { droison } from '../partida/reglas/ReglaPersonaje';
import type { ContextoEtapa } from '../narradorVirtual/etapas/Etapa';
import { apuntarMuerteDeDia } from '../narradorVirtual/final/cronica';
import { comprobarFinal, type Ganador } from '../narradorVirtual/final/comprobarFinal';
import { duracionFrase, FRASES, PAUSA_MS } from '../narradorVirtual/frases';
import { contextoNoche, nombreDeAsiento, tipoReal } from '../narradorVirtual/plazaDeJuego';
import { ponerRecordatorio } from '../narradorVirtual/noche/requisitos';
import { abrirPatosos } from './patoso';
import { identidadDe } from '../partida/Grimorio';
import { diaVirtual } from '../narradorVirtual/dia/reglasDia';
import { otroJugador, type DeclaracionDia } from './DeclaracionDia';

/**
 * Un jugador se declara Exterminador y dispara a otro (una vez por partida y
 * persona, lo sea o no). Solo mata si es de verdad el Exterminador, sano, y el
 * otro es el demonio, o la Reclusa (sana) si su estrategia decide que registra como tal.
 * El Exterminador de verdad pierde su habilidad («No Ability»). Devuelve si muere;
 * la muerte no se pone aquí, sino al contarlo (ver contarDisparo).
 */
export async function exterminar(ctx: ContextoEtapa, tirador: string, jugadorId: string): Promise<boolean> {
  const { juego } = ctx;
  const { partida } = juego;
  const desde = partida.jugadorDe(tirador);
  const objetivo = partida.plaza().find((a) => a.id === jugadorId);
  if (!desde || !objetivo) return false;
  const noche = contextoNoche(juego);
  const esExterminador = identidadDe(desde) === 'slayer' && !droison(noche, desde);
  let registraComoDemonio = tipoReal(juego, objetivo) === 'demon';
  if (!registraComoDemonio && esExterminador && identidadDe(objetivo) === 'recluse' && !droison(noche, objetivo)) {
    registraComoDemonio = await ctx.siONo({
      motivo: 'reclusaComoDemonio',
      pregunta: 'El Exterminador dispara a la Reclusa: ¿registra como demonio?',
      si: 'Registra como demonio: la Reclusa muere.',
      no: 'No registra como demonio: no pasa nada.',
    });
  }
  if (identidadDe(desde) === 'slayer') await ponerRecordatorio(ctx, desde.id, 'slayer', 'No Ability');
  partida.declaraciones.apuntar(exterminador.id, tirador);
  return esExterminador && !objetivo.muerto && registraComoDemonio;
}

/** Muere de un disparo del Exterminador: ya no nomina (queda listo para la noche) y puede declararse Patoso hasta el amanecer. */
export async function morirDeUnDisparo(ctx: ContextoEtapa, jugadorId: string): Promise<void> {
  const { juego } = ctx;
  const { partida } = juego;
  const objetivo = partida.plaza().find((a) => a.id === jugadorId);
  if (!objetivo) return;
  await ctx.plaza.accion('narrador:cambiarVida', { jugadorId, muerto: true });
  apuntarMuerteDeDia(ctx.recuerdos.cronica, juego, jugadorId, 'exterminador');
  abrirPatosos(juego, [jugadorId], 'amanecer');
  const narrador = juego.narrador.actual();
  const ocupante = objetivo.participanteId;
  if (narrador && ocupante && !narrador.listos.includes(ocupante)) juego.narrador.actualizar({ listos: [...narrador.listos, ocupante] });
}

/**
 * Lo cuenta con pausas: «Pepe se declara exterminador y dispara a Juan y…»; si
 * muere, entonces se le pone la muerte y «Juan muere.»; y al final «La partida
 * continúa.» o, si se acaba (sin demonio, salvo que lo herede la Mujer Escarlata),
 * el ganador para revelar. Lo que tarda cada parte se espera antes de seguir.
 */
export async function contarDisparo(ctx: ContextoEtapa, tirador: string, jugadorId: string, muere: boolean): Promise<Ganador | null> {
  const { juego } = ctx;
  const { partida } = juego;
  const desde = partida.jugadorDe(tirador);
  if (!desde) return null;
  partida.anotar({ tipo: 'exterminador', asiento: partida.asientoDiario(desde.id), objetivo: partida.asientoDiario(jugadorId), muere });
  const decirYEsperar = async (frase: string) => {
    ctx.decir(frase);
    await new Promise<void>((seguir) => ctx.temporizador.programar(duracionFrase(frase) + PAUSA_MS, seguir));
  };
  await decirYEsperar(FRASES.disparo(nombreDeAsiento(juego, desde.id), nombreDeAsiento(juego, jugadorId)));
  if (muere) {
    await morirDeUnDisparo(ctx, jugadorId);
    const ganador = await comprobarFinal(ctx);
    await decirYEsperar(FRASES.muere(nombreDeAsiento(juego, jugadorId)));
    if (ganador) return ganador;
  }
  ctx.decir(FRASES.partidaContinua());
  return null;
}

/** Disparar como Exterminador: de día, sin nominación en marcha, una vez por partida y persona. datos: { jugadorId }. */
export const exterminador: DeclaracionDia = {
  id: 'exterminar',
  publica: true,
  puede: (juego, yo) => {
    const { partida } = juego;
    return !!diaVirtual(juego) && !!partida.jugadorDe(yo.id) && !partida.declaraciones.hecha(exterminador.id, yo.id) && !partida.nominaciones.nominacion();
  },
  noPuede: ({ partida }, yo) => (partida.declaraciones.hecha(exterminador.id, yo.id) ? 'Ya has disparado en esta partida.' : 'Ahora no se puede disparar.'),
  async declarar(ctx, yo, datos) {
    const elegido = otroJugador(ctx.juego, yo, datos, 'No puedes dispararte a ti.');
    if ('error' in elegido) return elegido;
    const muere = await exterminar(ctx, yo, elegido.jugadorId);
    return { contar: () => contarDisparo(ctx, yo, elegido.jugadorId, muere) };
  },
};
