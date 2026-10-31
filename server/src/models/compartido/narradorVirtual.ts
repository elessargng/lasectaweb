/**
 * El narrador virtual: quiénes hay, qué guiones llevan y por dónde va.
 * Dominio que comparten el servidor y el cliente (alias @models): solo tipos y valores puros.
 */

/**
 * Los narradores virtuales: llevan la partida solos, sin una persona de narrador.
 * «Tonto y tú» elige siempre al azar; Jarvis sale, pero aún no se puede elegir.
 */
export const NARRADORES_VIRTUALES = [
  { id: 'tontoYTu', nombre: 'Tonto y tú', descripcion: 'Elige siempre al azar.', disponible: true, avatar: '/narradores/tonto-y-tu.webp' },
  {
    id: 'jarvis',
    nombre: 'Jarvis',
    descripcion: 'Decide con el modelo JEV.',
    disponible: true,
    avatar: '/narradores/jarvis.webp',
  },
] as const;

export type IdNarradorVirtual = (typeof NARRADORES_VIRTUALES)[number]['id'];

/**
 * Los guiones que puede llevar un narrador virtual (los predeterminados, por su id),
 * cada uno con los jugadores para los que está pensado: No Greater Joy, de 5 a 6;
 * Trouble Brewing, de 7 en adelante.
 */
export const GUIONES_NARRADOR_VIRTUAL = [
  { id: 'nogreaterjoy', nombre: 'No Greater Joy', jugadores: { min: 5, max: 6 } },
  { id: 'troublebrewing', nombre: 'Trouble Brewing', jugadores: { min: 7, max: 15 } },
] as const;

export type GuionNarradorVirtual = (typeof GUIONES_NARRADOR_VIRTUAL)[number]['id'];

/** Cuántos jugadores puede tener una partida con narrador virtual. */
export const JUGADORES_NARRADOR_VIRTUAL = { min: 5, max: 15 } as const;

/** Los guiones que se pueden narrar con ese número de jugadores. */
export const guionesParaJugadores = (jugadores: number) =>
  GUIONES_NARRADOR_VIRTUAL.filter((g) => jugadores >= g.jugadores.min && jugadores <= g.jugadores.max);

/** Por dónde va la partida del narrador virtual. */
export type EtapaNarradorVirtual =
  | 'esperandoJugadores'
  | 'noche'
  | 'privados'
  | 'puestaEnComun'
  | 'nominaciones'
  | 'violinista'
  | 'revelando';

/** Un muerto que puede declararse Patoso y hasta cuándo (cuando se acaba esa noche o ese día). */
export interface Patoso {
  jugador: string;
  hasta: 'amanecer' | 'anochecer';
}
