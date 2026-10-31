/**
 * El narrador virtual tal como se envía.
 * Lo que se envía al cliente (alias @views): solo tipos, sin Node ni servicios.
 */
import type { EtapaNarradorVirtual, GuionNarradorVirtual, IdNarradorVirtual, Patoso } from '../../models/compartido/narradorVirtual';
import type { TurnoNominacion } from '../../models/compartido/partida';

/** El narrador virtual de la sala, para todos. */
export interface NarradorVirtualDto {
  id: IdNarradorVirtual;
  /** Su participante (con `rol: 'narrador'` y `virtual`). */
  participante: string;
  /** Quien lo añadió: el único que puede quitarlo. */
  creador: string;
  guion: GuionNarradorVirtual;
  jugadores: number;
  etapa: EtapaNarradorVirtual;
  /** Lo último que ha dicho (se oye con la voz y sale escrito junto a su cuadro). */
  frase: string | null;
  /**
   * En una nominación, quién tiene la palabra: el que nomina acusa (y pasa a la
   * «Defensa»), el nominado se defiende (y pasa al «Voto») y se vota. null sin nominación.
   */
  turno: TurnoNominacion | null;
  /** Los jugadores listos para pasar a la noche (quien ya ha nominado lo está siempre). */
  listos: string[];
  /** Quienes ya se han declarado Exterminador y han disparado (una vez por partida). */
  exterminadores: string[];
  /** Quienes ya le han hecho su pregunta de Artista (una vez por partida). */
  artistas: string[];
  /**
   * Los muertos que aún pueden declararse Patoso (lo sean o no): los ejecutados o
   * muertos de día, hasta el amanecer; los muertos de noche, durante ese día.
   */
  patosos: Patoso[];
}
