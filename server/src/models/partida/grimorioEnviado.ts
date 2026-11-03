import { randomUUID } from 'crypto';
import { RECORDATORIO_TEXTO, SALA_RECORDATORIO_TEXTO_MAX, type Recordatorio } from '../compartido/grimorio';
import { NUM_FAROLES } from '../compartido/jugador';
import type { PersonajeDeGuion } from '../guiones';
import { SALA_ASIENTOS } from '../sala/Sala';
import type { FichaEnviada } from './Entregas';
import { MAX_RECORDATORIOS } from './Grimorio';

/** Un recordatorio de una ficha del grimorio que se envía, tal cual se pide. */
export interface BorradorRecordatorio {
  personaje?: string;
  indice?: number;
  texto?: string;
  icono?: unknown;
}

/** Una ficha del grimorio que se envía, tal cual se pide (lo que no es del tipo que toca, como si no estuviera). */
export interface BorradorFicha {
  jugadorId?: string;
  personaje?: string | null;
  alineamiento?: string;
  muerto?: boolean;
  recordatorios?: readonly BorradorRecordatorio[];
}

/** Lo que necesita saber de la partida para componer el grimorio. */
export interface EntornoGrimorioEnviado {
  /** Si existe ese asiento. */
  hayAsiento(jugadorId: string): boolean;
  /** Un personaje del guion (o del catálogo). */
  personaje(id: string): PersonajeDeGuion | undefined;
  /** El icono de un recordatorio con texto propio: el suyo, null sin icono, o undefined si no está en el guion. */
  iconoDeRecordatorio(icono: unknown): string | null | undefined;
}

/**
 * El grimorio que el narrador envía (el Espía, la Viuda), limpio: una copia del de
 * la partida que puede haber cambiado. Cada ficha es de un asiento de la plaza y
 * lleva personajes del guion; sus recordatorios, del guion o con un texto corto
 * (y un icono del guion); los faroles, del guion. Si algo no cuadra, el error.
 */
export function componerGrimorio(
  fichas: readonly BorradorFicha[],
  faroles: readonly string[],
  entorno: EntornoGrimorioEnviado,
): { error: string } | { fichas: FichaEnviada[]; faroles: string[] } {
  if (fichas.length > SALA_ASIENTOS.max) return { error: 'El grimorio no es válido.' };
  const limpias: FichaEnviada[] = [];
  for (const f of fichas) {
    if (!f.jugadorId || !entorno.hayAsiento(f.jugadorId)) return { error: 'El grimorio no es válido.' };
    const personaje = f.personaje === null ? null : f.personaje && entorno.personaje(f.personaje) ? f.personaje : undefined;
    if (personaje === undefined) return { error: 'Hay un personaje que no está en el guion.' };
    const alineamiento = f.alineamiento === 'bueno' || f.alineamiento === 'malvado' ? f.alineamiento : null;
    const recordatorios = f.recordatorios ?? [];
    if (recordatorios.length > MAX_RECORDATORIOS) return { error: 'Hay una ficha con demasiados recordatorios.' };
    const limpios: Recordatorio[] = [];
    for (const r of recordatorios) {
      const texto = r.texto?.replace(/\s+/g, ' ').trim() ?? '';
      if (r.personaje === RECORDATORIO_TEXTO) {
        if (!texto || [...texto].length > SALA_RECORDATORIO_TEXTO_MAX) return { error: 'Hay un recordatorio con un texto no válido.' };
        const icono = entorno.iconoDeRecordatorio(r.icono);
        if (icono === undefined) return { error: 'Hay un recordatorio con un icono que no está en el guion.' };
        limpios.push({ id: randomUUID(), personaje: RECORDATORIO_TEXTO, indice: -1, texto, ...(icono ? { icono } : {}) });
        continue;
      }
      const del = r.personaje ? entorno.personaje(r.personaje) : undefined;
      const indice = r.indice !== undefined && Number.isInteger(r.indice) ? r.indice : -1;
      const original = del?.recordatorios[indice];
      if (!del || original === undefined) return { error: 'Hay un recordatorio que no está en el guion.' };
      limpios.push({ id: randomUUID(), personaje: del.id, indice, texto: original });
    }
    limpias.push({ jugadorId: f.jugadorId, personaje, alineamiento, muerto: f.muerto === true, recordatorios: limpios });
  }
  // Los faroles del demonio (los que el narrador haya dejado en la copia)
  if (faroles.length > NUM_FAROLES) return { error: 'Los faroles no son válidos.' };
  if (faroles.some((id) => !entorno.personaje(id))) return { error: 'Hay un farol que no está en el guion.' };
  return { fichas: limpias, faroles: [...faroles] };
}
