import type { SalaAsiento, SalaSenalamiento } from '../../../contrato/sala';
import type { ContextoReglas } from './ReglaPersonaje';

/**
 * Lil' Monsta (demonio): no hay ficha de demonio; cada noche los esbirros eligen
 * (señalando) quién lo cuida, y ese lleva su «Is The Demon». No es una regla de
 * la lista (no cambia votaciones ni ejecuciones): es un señalamiento especial.
 */
export const DEMONIO_LILMONSTA = 'lilmonsta';

/**
 * Se puede empezar Lil' Monsta: es de noche, el guion lo trae, ninguna ficha
 * es un demonio y hay un esbirro más de los que tocan (el que hace de demonio).
 * Devuelve los asientos de los esbirros vivos, o null si no.
 */
export function esbirrosLilmonsta(
  ctx: ContextoReglas,
  partida: { noche: boolean; enElGuion: boolean; esbirrosQueTocan: number | null },
): string[] | null {
  if (!partida.noche || !partida.enElGuion) return null;
  const tipo = (a: SalaAsiento) => (a.personaje ? ctx.personaje(a.personaje)?.tipo : undefined);
  const mesa = ctx.mesa();
  if (mesa.some((a) => tipo(a) === 'demon')) return null;
  const esbirros = mesa.filter((a) => tipo(a) === 'minion');
  const tocan = partida.esbirrosQueTocan;
  if (esbirros.length === 0 || (tocan !== null && esbirros.length <= tocan)) return null;
  const vivos = esbirros.filter((a) => !a.muerto).map((a) => a.id);
  return vivos.length ? vivos : null;
}

/** El asiento que lo cuida, si todos los esbirros sentados señalan al mismo; si no, null. */
export function cuidadorLilmonsta(ctx: ContextoReglas, s: SalaSenalamiento): string | null {
  const sentados = ctx.mesa().filter((a) => a.ocupante && s.senaladores.includes(a.id));
  const elegidos = new Set(sentados.map((a) => s.senales[a.id]));
  if (sentados.length === 0 || elegidos.size !== 1) return null;
  const [cuidador] = [...elegidos];
  return cuidador ?? null;
}

/** Cuál de los recordatorios de Lil' Monsta es su «Is The Demon» (su índice y su texto), o null. */
export function recordatorioLilmonsta(ctx: ContextoReglas): { indice: number; texto: string } | null {
  const recordatorios = ctx.personaje(DEMONIO_LILMONSTA)?.recordatorios ?? [];
  const indice = recordatorios.findIndex((t) => /^is the demon$/i.test(t.trim()));
  return indice < 0 ? null : { indice, texto: recordatorios[indice] };
}
