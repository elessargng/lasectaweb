import { llenarAlAzar } from '../../contrato/bolsaAleatoria';
import type { GuionNarradorVirtual } from '../../contrato/sala';
import type { SalaService } from '../SalaService';
import type { EstrategiaNarrador } from './estrategias/EstrategiaNarrador';
import type { MesaNarrador } from './puertos';

/**
 * Prepara la partida como lo haría un narrador al llegar: grimorio limpio, tantos
 * asientos como jugadores (sin echar a nadie: los sentados de los que sobran se
 * mueven a uno libre), el guion pedido, el grimorio de los jugadores puesto y la
 * bolsa llena al azar. Devuelve el error o, si sale bien, los que han salido
 * pero no van en la bolsa (el Borracho: lo pone el narrador la primera noche).
 */
export async function prepararPartida(
  sala: SalaService,
  mesa: MesaNarrador,
  estrategia: EstrategiaNarrador,
  { guion, jugadores }: { guion: GuionNarradorVirtual; jugadores: number },
): Promise<{ error: string } | { fuera: string[] }> {
  const paso = async (accion: string, datos?: unknown) => {
    const r = await mesa.accion(accion, datos);
    if (!r.ok) throw new Error(r.error);
  };
  try {
    await paso('narrador:limpiarGrimorio');
    while (sala.asientos().length < jugadores) await paso('narrador:asientos', { cambio: 'añadir' });
    while (sala.asientos().length > jugadores) {
      const asientos = sala.asientos();
      const ultimo = asientos[asientos.length - 1];
      const libre = asientos.slice(0, -1).find((a) => !a.ocupante);
      if (ultimo.ocupante && libre) await paso('narrador:asientos', { cambio: 'mover', desde: ultimo.id, hasta: libre.id });
      await paso('narrador:asientos', { cambio: 'quitar' });
    }
    await paso('narrador:cambiarGuion', { predeterminado: guion });
    await paso('narrador:configurarPartida', { grimorioJugadores: true });
    const personajes = sala.guion()?.personajes ?? [];
    const bolsa = llenarAlAzar(personajes, sala.distribucion(), [], () => estrategia.azar());
    if (!bolsa) return { error: 'No hay reparto para tantos jugadores.' };
    await paso('narrador:llenarBolsa', { personajes: bolsa.personajes });
    return { fuera: bolsa.fuera.map((f) => f.personaje.id) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'No se ha podido preparar la partida.' };
  }
}
