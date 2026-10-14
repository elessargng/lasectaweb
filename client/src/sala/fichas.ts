import { createContext, useContext } from 'react';
import type { PersonajeMostrado } from './guiones';
import type { SalaAlineamiento } from './useSala';

/**
 * Los personajes en las fichas de la mesa: qué personajes se pueden poner (los
 * del guion, en el idioma de cada uno), cómo se ve cada uno según su
 * alineamiento y el grimorio propio de un jugador (sus notas, solo en su navegador).
 */

/** Los tipos que pueden ir en la ficha de un jugador (no los legendarios ni los lóricos). */
export const TIPOS_EN_FICHA = ['townsfolk', 'outsider', 'minion', 'demon', 'traveller'];

/** Lo que lleva una ficha: el personaje (id) y su alineamiento si se ha cambiado (null: el de su tipo). */
export interface ContenidoFicha {
  personaje: string | null;
  alineamiento: SalaAlineamiento | null;
}

/** El alineamiento de un tipo si nadie lo cambia: los viajeros no tienen (null). */
export function alineamientoDeTipo(tipo: string): SalaAlineamiento | null {
  if (tipo === 'townsfolk' || tipo === 'outsider') return 'bueno';
  if (tipo === 'minion' || tipo === 'demon') return 'malvado';
  return null;
}

/** El alineamiento que tiene la ficha: el elegido o, si no, el de su tipo. */
export const alineamientoDe = (p: PersonajeMostrado, elegido: SalaAlineamiento | null) =>
  elegido ?? alineamientoDeTipo(p.tipo);

/** El icono según el alineamiento: el bueno o el malvado (si lo hay) o, sin alineamiento, el de por defecto. */
export function iconoDe(p: PersonajeMostrado, elegido: SalaAlineamiento | null): string | null {
  const alineamiento = alineamientoDe(p, elegido);
  if (alineamiento === 'bueno') return p.iconoBueno ?? p.icono;
  if (alineamiento === 'malvado') return p.iconoMalvado ?? p.icono;
  return p.icono;
}

export interface ContextoFichas {
  /** Hay guion: sin él no se pueden poner personajes (ni cambiar alineamientos). */
  hayGuion: boolean;
  /** Los personajes del guion que pueden ir en una ficha, en su orden. */
  personajes: PersonajeMostrado[];
  porId: Map<string, PersonajeMostrado>;
  /** El grimorio propio del jugador: lo que ha anotado en cada ficha (por asiento). */
  notas: Record<string, ContenidoFicha>;
  anotar: (asientoId: string, contenido: ContenidoFicha) => void;
}

export const FichasContexto = createContext<ContextoFichas>({
  hayGuion: false,
  personajes: [],
  porId: new Map(),
  notas: {},
  anotar: () => {},
});

export const useFichas = () => useContext(FichasContexto);

/** Los tipos que se reparten, con su nombre y su color (azul los buenos, rojo los malvados). */
export const TIPOS_REPARTO = [
  { tipo: 'townsfolk', clave: 'aldeanos', nombre: 'Aldeanos', color: 'text-sky-300' },
  { tipo: 'outsider', clave: 'forasteros', nombre: 'Forasteros', color: 'text-sky-300' },
  { tipo: 'minion', clave: 'esbirros', nombre: 'Esbirros', color: 'text-red-400' },
  { tipo: 'demon', clave: 'demonios', nombre: 'Demonios', color: 'text-red-400' },
] as const;

/** Cuántos personajes de cada tipo hay en la bolsa. */
export function contarBolsa(bolsa: string[], tipoDe: (id: string) => string | undefined): Record<string, number> {
  const cuenta: Record<string, number> = {};
  for (const id of bolsa) {
    const tipo = tipoDe(id);
    if (tipo) cuenta[tipo] = (cuenta[tipo] ?? 0) + 1;
  }
  return cuenta;
}

