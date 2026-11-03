import {
  ADJUNTOS_DESPERTAR,
  FICHAS_DESPERTAR,
  TARJETAS_DESPERTAR,
  type EnvioDespertar,
  type FichaDespertar,
  type TarjetaDespertar,
} from '../compartido/despertar';
import type { PersonajeDeGuion } from '../guiones';

/** Largo máximo del texto «Personalizado» al despertar. */
export const SALA_TEXTO_DESPERTAR_MAX = 200;

/**
 * Lo que se quiere mandar a un despertar, tal cual se pide: una ficha o una
 * tarjeta, y lo que lleve (asientos, personajes, texto, alineamiento). Lo que no
 * lleva puede faltar o ser null (un EnvioDespertar ya compuesto también vale).
 */
export interface BorradorDespertar {
  ficha?: string | null;
  tarjeta?: string | null;
  jugadores?: readonly string[];
  personajes?: readonly string[];
  texto?: string | null;
  alineamiento?: string | null;
}

/** Lo que necesita saber de la partida para componer un mensaje. */
export interface EntornoMensaje {
  /** Si existe ese asiento. */
  hayAsiento(jugadorId: string): boolean;
  /** Un personaje del guion (o del catálogo). */
  personaje(id: string): PersonajeDeGuion | undefined;
}

/**
 * El mensaje de un despertar, limpio: una ficha (o, si lo manda el narrador, una
 * tarjeta) con justo lo que lleva (ver ADJUNTOS_DESPERTAR): al menos un asiento que
 * existe, al menos un personaje del guion, un texto no vacío (recortado). Si no
 * cuadra, el error.
 */
export function componerMensaje(
  borrador: BorradorDespertar,
  conTarjetas: boolean,
  entorno: EntornoMensaje,
): { error: string } | EnvioDespertar {
  const { ficha, tarjeta, jugadores, personajes, texto, alineamiento } = borrador;
  const esFicha = !!ficha && (FICHAS_DESPERTAR as readonly string[]).includes(ficha);
  const esTarjeta = conTarjetas && !!tarjeta && (TARJETAS_DESPERTAR as readonly string[]).includes(tarjeta);
  if (esFicha === esTarjeta) return { error: 'Mensaje desconocido.' };
  const clave = (esFicha ? ficha : tarjeta) as FichaDespertar | TarjetaDespertar;
  const adjunto = ADJUNTOS_DESPERTAR[clave] ?? {};

  const asientos = adjunto.jugadores ? [...new Set(jugadores ?? [])] : [];
  if (adjunto.jugadores && (!asientos.length || asientos.some((a) => !entorno.hayAsiento(a)))) {
    return { error: 'Elige al menos un jugador.' };
  }
  const elegidos = adjunto.personajes ? [...new Set(personajes ?? [])] : [];
  if (adjunto.personajes && (!elegidos.length || elegidos.some((id) => !entorno.personaje(id)))) {
    return { error: 'Elige al menos un personaje del guion.' };
  }
  const limpio = adjunto.texto && texto ? texto.replace(/\s+/g, ' ').trim().slice(0, SALA_TEXTO_DESPERTAR_MAX) : '';
  if (adjunto.texto && !limpio) return { error: 'Escribe el mensaje.' };
  const bando = adjunto.alineamiento && (alineamiento === 'bueno' || alineamiento === 'malvado') ? alineamiento : null;
  return {
    ficha: esFicha ? (ficha as FichaDespertar) : null,
    tarjeta: esTarjeta ? (tarjeta as TarjetaDespertar) : null,
    jugadores: asientos,
    personajes: elegidos,
    texto: adjunto.texto ? limpio : null,
    alineamiento: bando,
  };
}
