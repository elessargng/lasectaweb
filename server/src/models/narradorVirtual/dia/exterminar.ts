import { droison } from '../../partida/reglas/ReglaPersonaje';
import type { ContextoEtapa } from '../etapas/Etapa';
import { apuntarMuerteDeDia } from '../final/cronica';
import { comprobarFinal, type Ganador } from '../final/comprobarFinal';
import { duracionFrase, FRASES, PAUSA_MS } from '../frases';
import { contextoNoche, nombreDeAsiento, tipoReal } from '../plazaDeJuego';
import { ponerRecordatorio } from '../noche/requisitos';
import { abrirPatosos } from './patoso';
import { identidadDe } from '../../partida/Grimorio';

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
  const narrador = juego.narrador.actual();
  if (narrador) juego.narrador.actualizar({ exterminadores: [...narrador.exterminadores, tirador] });
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
