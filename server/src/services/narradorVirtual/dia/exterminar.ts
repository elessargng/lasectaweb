import { droison } from '../../partida/reglas/ReglaPersonaje';
import type { ContextoEtapa } from '../etapas/Etapa';
import { apuntarMuerteDeDia } from '../final/cronica';
import { FRASES } from '../frases';
import { contextoNoche, nombreDeAsiento, tipoReal } from '../mesaDeJuego';
import { ponerRecordatorio } from '../noche/requisitos';

/**
 * Un jugador se declara Exterminador y dispara a otro (una vez por partida y
 * persona, lo sea o no). Solo mata si es de verdad el Exterminador, sano, y el
 * otro es el demonio, o la Reclusa si su estrategia decide que registra como tal.
 * El Exterminador de verdad pierde su habilidad («No Ability»). Devuelve si ha muerto.
 */
export async function exterminar(ctx: ContextoEtapa, tirador: string, asientoId: string): Promise<boolean> {
  const { sala } = ctx;
  const desde = sala.asientoDe(tirador);
  const objetivo = sala.asientos().find((a) => a.id === asientoId);
  if (!desde || !objetivo) return false;
  const noche = contextoNoche(sala);
  const esExterminador = sala.identidad(desde) === 'slayer' && !droison(noche, desde);
  let registraComoDemonio = tipoReal(sala, objetivo) === 'demon';
  if (!registraComoDemonio && esExterminador && sala.identidad(objetivo) === 'recluse' && !droison(noche, objetivo)) {
    registraComoDemonio = await ctx.siONo({
      motivo: 'reclusaComoDemonio',
      pregunta: 'El Exterminador dispara a la Reclusa: ¿registra como demonio?',
      si: 'Registra como demonio: la Reclusa muere.',
      no: 'No registra como demonio: no pasa nada.',
    });
  }
  const muere = esExterminador && !objetivo.muerto && registraComoDemonio;
  if (sala.identidad(desde) === 'slayer') await ponerRecordatorio(ctx, desde.id, 'slayer', 'No Ability');
  if (muere) {
    await ctx.mesa.accion('narrador:cambiarVida', { asientoId: objetivo.id, muerto: true });
    apuntarMuerteDeDia(ctx.recuerdos.cronica, sala, objetivo.id, 'exterminador');
  }
  const narrador = sala.narradorVirtual();
  if (narrador) {
    // El muerto ya no nomina: queda listo para la noche
    const ocupante = muere ? objetivo.ocupante : null;
    const listos = ocupante && !narrador.listos.includes(ocupante) ? [...narrador.listos, ocupante] : narrador.listos;
    sala.actualizarNarradorVirtual({ exterminadores: [...narrador.exterminadores, tirador], listos });
  }
  ctx.decir(FRASES.disparo(nombreDeAsiento(sala, desde.id), nombreDeAsiento(sala, objetivo.id), muere));
  return muere;
}
