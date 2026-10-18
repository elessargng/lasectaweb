import type { EstadisticasRepository, Participacion } from '../../repositories/EstadisticasRepository';
import type { PersonajeRepository } from '../../repositories/PersonajeRepository';

/** Cuántas veces sale algo (un rol, una causa, un guion), de más a menos. */
interface Conteo {
  id: string;
  veces: number;
}

export interface ResumenEstadisticas {
  usuario: { userId: string; username: string; profilePicture: string | null };
  publicas: boolean;
  jugadas: number;
  ganadas: number;
  /** Las que acabó en cada bando y cuántas de ellas ganó. */
  porBando: Record<'bueno' | 'malvado', { jugadas: number; ganadas: number }>;
  /** Con qué bando empezó. */
  empezo: Record<'bueno' | 'malvado', number>;
  /** Las que acabó en otro bando del que empezó. */
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
  /** Nombre e icono de los personajes que salen (roles y causas). */
  personajes: Record<string, { nombre: string; icono: string | null; tipo: string }>;
  /** Las últimas partidas, de la más reciente a la más antigua. */
  ultimas: Participacion[];
}

const ULTIMAS = 20;

function contar(valores: (string | null)[]): Conteo[] {
  const n = new Map<string, number>();
  for (const v of valores) if (v) n.set(v, (n.get(v) ?? 0) + 1);
  return [...n].map(([id, veces]) => ({ id, veces })).sort((a, b) => b.veces - a.veces || a.id.localeCompare(b.id));
}

/**
 * Las estadísticas de un jugador, calculadas de sus partidas guardadas. Las
 * suyas las ve siempre; las de otro, solo si las tiene públicas.
 */
export class EstadisticasService {
  constructor(
    private estadisticas: EstadisticasRepository,
    private personajes: PersonajeRepository,
  ) {}

  /** El resumen de alguien, o null si no existe o no se pueden ver (son privadas y no es quien mira). */
  async resumen(userId: string, quienMira: string | null): Promise<ResumenEstadisticas | null> {
    const usuario = await this.estadisticas.nombreDe(userId);
    if (!usuario) return null;
    const publicas = await this.estadisticas.sonPublicas(userId);
    if (!publicas && quienMira !== userId) return null;

    const todas = await this.estadisticas.participaciones(userId);
    const jugadas = todas.filter((p) => p.papel === 'jugador');
    const en = (bando: 'bueno' | 'malvado') => jugadas.filter((p) => p.alineamientoFinal === bando);
    const roles = contar(jugadas.flatMap((p) => p.roles));
    const causas = contar(jugadas.flatMap((p) => p.causas));
    const ids = [...new Set([...roles.map((r) => r.id), ...causas.map((c) => c.id), ...jugadas.flatMap((p) => p.roles)])];
    const personajes = Object.fromEntries(
      (await this.personajes.buscarPorIds(ids)).map((p) => [p.id, { nombre: p.nombre, icono: p.icono, tipo: p.tipo }]),
    );
    const suma = (campo: 'nominaciones' | 'nominado' | 'votos' | 'ejecutado') => jugadas.reduce((t, p) => t + p[campo], 0);

    return {
      usuario: { userId, ...usuario },
      publicas,
      jugadas: jugadas.length,
      ganadas: jugadas.filter((p) => p.gano).length,
      porBando: {
        bueno: { jugadas: en('bueno').length, ganadas: en('bueno').filter((p) => p.gano).length },
        malvado: { jugadas: en('malvado').length, ganadas: en('malvado').filter((p) => p.gano).length },
      },
      empezo: {
        bueno: jugadas.filter((p) => p.alineamientoInicial === 'bueno').length,
        malvado: jugadas.filter((p) => p.alineamientoInicial === 'malvado').length,
      },
      cambiosDeBando: jugadas.filter((p) => p.alineamientoInicial && p.alineamientoFinal && p.alineamientoInicial !== p.alineamientoFinal).length,
      vivoAlFinal: jugadas.filter((p) => p.vivo).length,
      nominaciones: suma('nominaciones'),
      nominado: suma('nominado'),
      votos: suma('votos'),
      ejecutado: suma('ejecutado'),
      narradas: todas.filter((p) => p.papel === 'narrador').length,
      roles,
      causas,
      guiones: contar(jugadas.map((p) => p.guion)),
      personajes,
      ultimas: todas.slice(0, ULTIMAS),
    };
  }

  /** El perfil público de alguien, o null si no existe. */
  perfil(userId: string) {
    return this.estadisticas.perfil(userId);
  }

  /** Quienes tienen sus estadísticas públicas. */
  publicos() {
    return this.estadisticas.publicos();
  }
}
