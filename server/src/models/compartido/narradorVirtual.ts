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

/** Cuántos jugadores puede tener una partida con narrador virtual. */
export const JUGADORES_NARRADOR_VIRTUAL = { min: 5, max: 15 } as const;

/** El guion ya cargado en la sala, en lugar de uno de los predeterminados. */
export const GUION_DE_LA_SALA = 'sala';

/**
 * Un guion que puede llevar el narrador virtual (ver models/narradorVirtual/guionNarrable):
 * uno predeterminado (su id) o el de la sala (GUION_DE_LA_SALA), y con cuántos
 * jugadores se llena su bolsa.
 */
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

