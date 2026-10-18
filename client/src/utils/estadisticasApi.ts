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
