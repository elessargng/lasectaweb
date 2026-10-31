/**
 * Los despertares de noche: lo que se dicen el narrador y el jugador despierto, y lo que propone el despertar guiado.
 * Dominio que comparten el servidor y el cliente (alias @models): solo tipos y valores puros.
 */
import type { Alineamiento } from './jugador';
import type { Fase } from './partida';

/**
 * Lo que se puede mandar al despertar a alguien de noche. Las fichas las usan
 * el narrador y el jugador despierto; las tarjetas, solo el narrador. El
 * cliente tiene el mismo catálogo (client/src/sala/despertar.ts).
 */
export const FICHAS_DESPERTAR = [
  'entendido', 'si', 'no', 'bueno', 'malvado',
  'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco',
  'jugador', 'personaje', 'personalizado',
] as const;

export type FichaDespertar = (typeof FICHAS_DESPERTAR)[number];

/** Con lo que contesta el jugador a lo que le manda el despertar guiado (si no le pide que elija). */
export const FICHAS_RESPUESTA_GUIADA: readonly FichaDespertar[] = ['entendido', 'personalizado'];

export const TARJETAS_DESPERTAR = [
  'habilidad', 'eleccion', 'noEnJuego', 'demonio', 'esbirros', 'tuEres', 'esteJugadorEs', 'teHaElegido',
] as const;

export type TarjetaDespertar = (typeof TARJETAS_DESPERTAR)[number];

/** Lo que lleva cada ficha o tarjeta además de sí misma. */
export interface AdjuntoDespertar {
  jugadores?: boolean;
  personajes?: boolean;
  texto?: boolean;
  /** Un alineamiento (bueno o malvado), opcional. */
  alineamiento?: boolean;
}

export const ADJUNTOS_DESPERTAR: Partial<Record<FichaDespertar | TarjetaDespertar, AdjuntoDespertar>> = {
  jugador: { jugadores: true },
  personaje: { personajes: true },
  personalizado: { texto: true },
  noEnJuego: { personajes: true },
  demonio: { jugadores: true },
  esbirros: { jugadores: true },
  tuEres: { personajes: true, alineamiento: true },
  esteJugadorEs: { jugadores: true, personajes: true },
  teHaElegido: { personajes: true },
};

/** Lo que se manda mientras alguien está despierto: una ficha o una tarjeta, con lo que lleve. */
export interface MensajeDespertar {
  id: string;
  /** 'narrador', o el id del jugador que contesta. */
  autor: string;
  ficha: FichaDespertar | null;
  tarjeta: TarjetaDespertar | null;
  /** ids de jugador. */
  jugadores: string[];
  /** ids de personaje. */
  personajes: string[];
  texto: string | null;
  /** «Tú eres»: el alineamiento, si se dice. */
  alineamiento: Alineamiento | null;
  /**
   * «Haz una elección» de una habilidad (el despertar guiado):
   * a cuántos jugadores elige y si puede elegirse a sí mismo. El jugador solo puede
   * contestar con la ficha «Jugador» y justo esos. null: una elección libre.
   */
  eleccion: EleccionDespertar | null;
  /**
   * Lo ha mandado el despertar guiado (la habilidad del que despierta). Si es lo
   * último del narrador y no le pide que elija, el jugador solo contesta
   * «Entendido» o con un texto («Personalizado»).
   */
  guiado: boolean;
  /** En qué momento de la partida se mandó («Noche 2»). */
  fase: { momento: Fase['momento']; numero: number };
  /** ms */
  hora: number;
}

/** Lo que se manda en un despertar, sin quién, cuándo ni elección. */
export type EnvioDespertar = Omit<MensajeDespertar, 'id' | 'autor' | 'fase' | 'hora' | 'eleccion' | 'guiado'>;

/** La elección que pide una habilidad: a cuántos jugadores y si puede elegirse a sí mismo. */
export interface EleccionDespertar {
  cantidad: number;
  puedeElegirse: boolean;
}

/**
 * Cómo está el despertar guiado de una fila del orden de noche:
 * - listo: se hace solo, con un clic;
 * - falta: falta algo en el grimorio (ver los avisos) y no se puede;
 * - revisar: el narrador mira lo propuesto (las opciones) y lo cambia si quiere antes de mandarlo;
 * - esperando: se le ha pedido que elija y aún no ha contestado;
 * - hecho: ya está, esta noche.
 */
export type EstadoHabilidad = 'listo' | 'falta' | 'revisar' | 'esperando' | 'hecho';

/**
 * Cómo registra en una opción quien puede registrar como otra cosa (ver
 * Percepcion): como bueno o malvado, el demonio o no, un esbirro o no, o ni lo
 * uno ni lo otro.
 */
export type Registro = 'bueno' | 'malvado' | 'demonio' | 'noDemonio' | 'esbirro' | 'noEsbirro' | 'niDemonioNiEsbirro';

/**
 * Lo que dice el despertar guiado al narrador (el cliente lo pone en palabras):
 * - faltaRecordatorio: hay que poner antes ese recordatorio (de ese personaje, con ese texto);
 * - envenenado / borracho: el que despierta está droison;
 * - muerto: el de la ficha está muerto;
 * - noMuere: el Ravenkeeper no muere esta noche;
 * - registro: en lo que se calcula entra quien puede registrar como otra cosa (`jugador`);
 * - sinEfecto: estaba droison al elegir; se le ha contestado sin poner el recordatorio;
 * - protegido: el demonio ha elegido a uno protegido (`jugador`): no muere;
 * - alcalde: el demonio ha elegido al Alcalde (`jugador`): decide el narrador;
 * - elegido: a quién ha elegido (`jugadores`);
 * - pocosJugadores: hay menos de 7 jugadores: los esbirros y el demonio no se despiertan;
 * - faltanFaroles: el narrador aún no ha puesto los 3 faroles del demonio.
 */
export type AvisoHabilidad =
  | { tipo: 'faltaRecordatorio'; personaje: string; texto: string }
  | { tipo: 'envenenado' | 'borracho' | 'muerto' | 'noMuere' | 'sinEfecto' | 'pocosJugadores' | 'faltanFaroles' }
  | { tipo: 'registro' | 'protegido' | 'alcalde'; jugador: string }
  | { tipo: 'elegido'; jugadores: string[] };

/** Una respuesta posible: lo que se manda y, con quien puede registrar como otra cosa, cómo registra cada uno para que salga. */
export interface OpcionDespertar {
  envio: EnvioDespertar;
  registros: { jugador: string; como: Registro }[];
}
