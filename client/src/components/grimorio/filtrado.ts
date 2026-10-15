import { BookOpen, Crown, Dices, FlaskConical, Ghost, Shield, Skull, Sparkles, Users, Zap, type LucideIcon } from 'lucide-react';
import type { Character } from '../../data/botcRoles';

/** Los filtros del compendio: lo que se busca, la edición y el bando ('all' es «sin filtro»). */
export interface FiltrosPersonajes {
  q: string;
  edicion: string;
  bando: string;
}

export const FILTROS_VACIOS: FiltrosPersonajes = { q: '', edicion: 'all', bando: 'all' };

export interface OpcionEdicion {
  id: string;
  label: string;
  /** Logo oficial de la edición, si lo hay; si no, se pinta el icono en un medallón. */
  logo?: string;
  icon: LucideIcon;
  lang?: string;
}

export const EDICIONES: OpcionEdicion[] = [
  { id: 'all', label: 'Todas', icon: BookOpen },
  { id: 'trouble-brewing', label: 'Trouble Brewing', logo: '/ediciones/troublebrewing.webp', icon: BookOpen, lang: 'en' },
  { id: 'bad-moon-rising', label: 'Bad Moon Rising', logo: '/ediciones/badmoonrising.webp', icon: BookOpen, lang: 'en' },
  { id: 'sects-and-violets', label: 'Sects & Violets', logo: '/ediciones/sectsviolets.webp', icon: BookOpen, lang: 'en' },
  { id: 'experimental', label: 'Experimental', icon: FlaskConical },
  { id: 'fabled', label: 'Fábulas', icon: Sparkles },
  { id: 'loric', label: 'Loric', icon: Dices, lang: 'en' }
];

export interface OpcionBando {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Color del bando en el juego, solo para su icono. */
  color: string;
}

export const BANDOS: OpcionBando[] = [
  { id: 'all', label: 'Todos', icon: Users, color: '#d4af6a' },
  { id: 'townsfolk', label: 'Aldeanos', icon: Shield, color: '#7fb0e6' },
  { id: 'outsider', label: 'Forasteros', icon: Ghost, color: '#86c6d6' },
  { id: 'minion', label: 'Esbirros', icon: Skull, color: '#e0896a' },
  { id: 'demon', label: 'Demonios', icon: Crown, color: '#e05a63' },
  { id: 'traveller', label: 'Viajeros', icon: Zap, color: '#b9a2e0' }
];

/** «Ediciones» cuyos personajes no tienen bando (son del Narrador): con ellas no se filtra por bando. */
export const SIN_BANDO = ['fabled', 'loric'];

/** Texto sin tildes ni mayúsculas, para buscar «lavandera», «Lavandera» o «LAVANDERA» igual. */
export const normalizar = (texto: string): string =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Si un personaje cumple los filtros. La búsqueda mira nombre, nombre original, habilidad y resumen. */
export function coincide(char: Character, { q, edicion, bando }: FiltrosPersonajes): boolean {
  const busqueda = normalizar(q.trim());
  if (busqueda) {
    const texto = normalizar(`${char.name} ${char.originalName} ${char.ability} ${char.summary}`);
    if (!busqueda.split(/\s+/).every((palabra) => texto.includes(palabra))) return false;
  }
  if (edicion !== 'all' && char.edition !== edicion) return false;
  if (bando !== 'all' && !SIN_BANDO.includes(edicion) && char.team !== bando) return false;
  return true;
}

/** Lee los filtros de la dirección (?q=…&edicion=…&bando=…), ignorando valores que no existen. */
export function filtrosDeUrl(params: URLSearchParams): FiltrosPersonajes {
  const edicion = params.get('edicion') ?? 'all';
  const bando = params.get('bando') ?? 'all';
  const edicionValida = EDICIONES.some((e) => e.id === edicion) ? edicion : 'all';
  return {
    q: params.get('q') ?? '',
    edicion: edicionValida,
    bando: BANDOS.some((b) => b.id === bando) && !SIN_BANDO.includes(edicionValida) ? bando : 'all'
  };
}

/** Los filtros como parámetros de la dirección (solo los que no están vacíos). */
export function filtrosAUrl({ q, edicion, bando }: FiltrosPersonajes): Record<string, string> {
  const params: Record<string, string> = {};
  if (q.trim()) params.q = q;
  if (edicion !== 'all') params.edicion = edicion;
  if (bando !== 'all') params.bando = bando;
  return params;
}
