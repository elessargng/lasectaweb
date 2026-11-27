/**
 * El narrador virtual tal como se envía.
 * Lo que se envía al cliente (alias @views): solo tipos, sin Node ni servicios.
 */
import type { TurnoNominacion } from './partida';

/**
 * Los narradores virtuales: llevan la partida solos, sin una persona de narrador.
 * «Tonto y tú» elige siempre al azar.
 */
export const NARRADORES_VIRTUALES = [
  { id: 'tontoYTu', nombre: 'Tonto y tú', descripcion: 'Elige siempre al azar.', disponible: true, avatar: '/narradores/tonto-y-tu.webp' },
  { id: 'jarvis', nombre: 'Jarvis', descripcion: 'Decide con el modelo JEV.', disponible: true, avatar: '/narradores/jarvis.webp' },
] as const;

export type IdNarradorVirtual = (typeof NARRADORES_VIRTUALES)[number]['id'];

/** Cuántos jugadores puede tener una partida con narrador virtual. */
export const JUGADORES_NARRADOR_VIRTUAL = { min: 5, max: 15 } as const;

/** El guion ya cargado en la sala, en lugar de uno de los predeterminados. */
export const GUION_DE_LA_SALA = 'sala';

/** Un guion que puede llevar el narrador virtual: uno predeterminado (su id) o el de la sala (GUION_DE_LA_SALA), y con cuántos jugadores se llena su bolsa. */
export interface GuionNarrable {
  id: string;
  nombre: string;
  jugadores: number[];
}

/** Por dónde va la partida del narrador virtual. */
export type EtapaNarradorVirtual =
  | 'esperandoJugadores'
  | 'noche'
  | 'privados'
  | 'puestaEnComun'
  | 'nominaciones'
  | 'violinista'
  | 'revelando';

/** El narrador virtual de la sala, para todos. */
export interface NarradorVirtualDto {
  id: IdNarradorVirtual;
  /** Su participante (con `rol: 'narrador'` y `virtual`). */
  participante: string;
  /** Quien lo añadió: el único que puede quitarlo. */
  creador: string;
  /** Un predeterminado (su id) o el de la sala (GUION_DE_LA_SALA). */
  guion: string;
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
}
