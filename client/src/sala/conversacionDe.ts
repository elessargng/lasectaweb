import { enumerar } from './despertar';
import type { SalaEstado } from './useSala';

/**
 * Para el lector, con quién conversa alguien en privado: «con Ana y Luis»,
 * «contigo y con Ana», o vacío si se ha quedado solo. undefined si no conversa
 * (como miembro; quien solo escucha no cuenta). De noche, un jugador solo ve
 * las conversaciones en las que está: de las demás no sabe nada.
 */
export function conQuienConversa(estado: SalaEstado, id: string): string | undefined {
  const suya = estado.conversaciones.find((c) => c.miembros.includes(id));
  if (!suya) return undefined;
  const otros = suya.miembros.filter((m) => m !== id);
  const conmigo = otros.includes(estado.yo);
  const nombres = otros
    .filter((m) => m !== estado.yo)
    .map((m) => estado.participantes.find((p) => p.id === m)?.nombre ?? 'alguien');
  if (conmigo) return nombres.length ? `contigo y con ${enumerar(nombres)}` : 'contigo';
  return nombres.length ? `con ${enumerar(nombres)}` : '';
}
