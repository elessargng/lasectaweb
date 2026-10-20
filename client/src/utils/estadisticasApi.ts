import { parseApiResponse } from './api';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';

type Bando = 'bueno' | 'malvado';

/** Lo de alguien en una partida de la sala (como jugador o como narrador). */
export interface Participacion {
  partidaId: string;
  fecha: string;
  guion: string | null;
  edicion: string | null;
  ganador: Bando;
  dias: number;
  jugadores: number;
  papel: 'jugador' | 'narrador';
  roles: string[];
  rolFinal: string | null;
  alineamientoInicial: Bando | null;
  alineamientoFinal: Bando | null;
  gano: boolean | null;
  vivo: boolean | null;
  causas: string[];
  nominaciones: number;
  nominado: number;
  votos: number;
  ejecutado: number;
}

export interface Conteo {
  id: string;
  veces: number;
}

/** Las estadísticas de un jugador (ver EstadisticasService en el servidor). */
export interface ResumenEstadisticas {
  usuario: { userId: string; username: string; profilePicture: string | null };
  publicas: boolean;
  jugadas: number;
  ganadas: number;
  porBando: Record<Bando, { jugadas: number; ganadas: number }>;
  empezo: Record<Bando, number>;
  cambiosDeBando: number;
  vivoAlFinal: number;
  nominaciones: number;
  nominado: number;
  votos: number;
  ejecutado: number;
  narradas: number;
  roles: Conteo[];
  causas: Conteo[];
  guiones: Conteo[];
  personajes: Record<string, { nombre: string; icono: string | null; tipo: string }>;
  ultimas: Participacion[];
}

export interface JugadorPublico {
  userId: string;
  username: string;
  profilePicture: string | null;
  partidas: number;
}

const conToken = (token: string | null): HeadersInit => (token ? { Authorization: `Bearer ${token}` } : {});

/** Las estadísticas de alguien (las propias, siempre; las de otro, si son públicas). */
export async function getEstadisticas(userId: string, token: string | null): Promise<ResumenEstadisticas> {
  const r = await fetch(`${API_URL}/estadisticas/${encodeURIComponent(userId)}`, { headers: conToken(token) });
  return parseApiResponse<ResumenEstadisticas>(r);
}

/** Quienes tienen sus estadísticas públicas. */
export async function getJugadoresPublicos(): Promise<JugadorPublico[]> {
  return parseApiResponse<JugadorPublico[]>(await fetch(`${API_URL}/estadisticas`));
}

/** Lo público de alguien: su nombre, su avatar y si sus estadísticas son públicas. */
export interface PerfilPublico {
  userId: string;
  username: string;
  profilePicture: string | null;
  createdAt: string;
  estadisticasPublicas: boolean;
}

export async function getPerfilPublico(userId: string): Promise<PerfilPublico> {
  return parseApiResponse<PerfilPublico>(await fetch(`${API_URL}/usuarios/${encodeURIComponent(userId)}/perfil`));
}

/** Un personaje del catálogo (todos los que existen), para la lista de jugados. */
export interface PersonajeDelCatalogo {
  id: string;
  nombre: string;
  tipo: string;
  icono: string | null;
}

let catalogo: Promise<PersonajeDelCatalogo[]> | null = null;

/** Todos los personajes del catálogo (se pide una vez por visita). */
export function getCatalogoPersonajes(): Promise<PersonajeDelCatalogo[]> {
  catalogo ??= fetch(`${API_URL}/personajes`)
    .then((r) => parseApiResponse<PersonajeDelCatalogo[]>(r))
    .catch((e) => {
      catalogo = null;
      throw e;
    });
  return catalogo;
}

/** Un asiento de la mesa de una partida del historial (con cuenta o sin ella). */
export interface AsientoHistorial {
  numero: number;
  nombre: string | null;
  userId: string | null;
  /** Quien era de verdad. */
  personaje: string | null;
  /** La ficha que llevaba, si no era quien era (el Borracho que se creía Lavandera). */
  ficha: string | null;
  alineamiento: Bando | null;
  muerto: boolean;
  /** Tiene las estadísticas privadas y quien mira no estuvo en la partida: no se dice quién era. */
  oculto?: boolean;
}

/** Alguien con cuenta en una partida del historial. */
export interface ParticipanteHistorial {
  userId: string;
  username: string;
  profilePicture: string | null;
  papel: 'jugador' | 'narrador';
  roles: string[];
  rolFinal: string | null;
  alineamientoInicial: Bando | null;
  alineamientoFinal: Bando | null;
  gano: boolean | null;
  vivo: boolean | null;
  causas: string[];
  nominaciones: number;
  nominado: number;
  votos: number;
  ejecutado: number;
}

/** Una nominación de la partida (como en el registro del narrador). */
export interface VotacionHistorial {
  hora: number;
  dia: number;
  nomina: string;
  nominado: string;
  votantes: string[] | null;
  votos: number | null;
}

/** Una partida del historial, como la puede ver quien mira (ver EstadisticasService.historial). */
export interface PartidaHistorial {
  partidaId: string;
  fecha: string;
  guion: string | null;
  edicion: string | null;
  ganador: Bando;
  dias: number;
  causas: string[];
  /** Lo de la persona cuyo historial es. */
  propia: ParticipanteHistorial | null;
  /** Los demás con cuenta que se pueden ver. */
  participantes: ParticipanteHistorial[];
  /** Los que no se pueden ver (estadísticas privadas). */
  ocultos: number;
  /** La mesa entera (null en las partidas de antes de guardarla). */
  mesa: AsientoHistorial[] | null;
  narradoresNombres: string[] | null;
  npcs: string[] | null;
  /** Las nominaciones (null si no se guardaron o no se pueden ver). */
  votaciones: VotacionHistorial[] | null;
}

/** El historial de partidas de alguien (el propio, siempre; el de otro, si son públicas). */
export async function getHistorial(userId: string, token: string | null): Promise<{ partidas: PartidaHistorial[] }> {
  const r = await fetch(`${API_URL}/estadisticas/${encodeURIComponent(userId)}/historial`, { headers: conToken(token) });
  return parseApiResponse<{ partidas: PartidaHistorial[] }>(r);
}

/** El idioma en el que alguien ve los nombres de los personajes (el de la sala), con su género. */
export interface IdiomaNombres {
  id: string;
  genero: 'masculino' | 'femenino';
}

/** El original (inglés): sin traducción. */
export const IDIOMA_ORIGINAL = 'en';

/**
 * El idioma de los nombres de los personajes que tiene elegido quien mira (en la
 * sala: Preferencias > Usuario). Con cuenta, el de su configuración guardada; sin
 * ella o si falla, el original.
 */
export async function getIdiomaNombres(token: string | null): Promise<IdiomaNombres> {
  const original: IdiomaNombres = { id: IDIOMA_ORIGINAL, genero: 'masculino' };
  if (!token) return original;
  try {
    const r = await fetch(`${API_URL}/sala/configuracion`, { headers: conToken(token) });
    const datos = await parseApiResponse<{ actual: { preferencias?: { idiomaNombres?: unknown; genero?: unknown } } | null }>(r);
    const p = datos.actual?.preferencias;
    const id = typeof p?.idiomaNombres === 'string' && /^[a-z0-9_-]{1,40}$/i.test(p.idiomaNombres) ? p.idiomaNombres : IDIOMA_ORIGINAL;
    return { id, genero: p?.genero === 'femenino' ? 'femenino' : 'masculino' };
  } catch {
    return original;
  }
}

/** Los nombres de los personajes en un idioma (y el código de ese idioma, para `lang`). */
export async function getNombresEnIdioma({ id, genero }: IdiomaNombres): Promise<{ codigo: string; nombres: Map<string, string> }> {
  const r = await fetch(`${API_URL}/idiomas/${encodeURIComponent(id)}/traducciones?genero=${genero}`);
  const d = await parseApiResponse<{ idioma: { codigo: string }; traducciones: { personajeId: string; nombre: string | null }[] }>(r);
  return {
    codigo: d.idioma.codigo,
    nombres: new Map(d.traducciones.flatMap((t) => (t.nombre ? [[t.personajeId, t.nombre] as [string, string]] : []))),
  };
}
