import type { EstadisticasRepository, PartidaGuardada, Participacion } from '../../repositories/EstadisticasRepository';
import type { PersonajeRepository } from '../../repositories/PersonajeRepository';
import { CAUSAS_CON_VICTORIA } from '../../contrato/sala';

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
    // Los logros que exigen ganar solo cuentan en las partidas ganadas (también las guardadas antes de exigirlo)
    const causas = contar(jugadas.flatMap((p) => p.causas.filter((c) => !CAUSAS_CON_VICTORIA.includes(c) || p.gano)));
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

  /**
   * El historial de partidas de alguien (con las mismas reglas que el resumen: las
   * propias siempre, las de otro si son públicas), con lo guardado de cada una.
   *
   * Quien estuvo en una partida (jugando o narrando) la ve entera: al final se
   * revela el grimorio a todos. Si no estuvo (mira el historial público de otro), de
   * quienes tienen las estadísticas privadas no se dice nada (ni su nombre ni su
   * personaje: se cuentan aparte) y no se dan las nominaciones (llevan nombres).
   */
  async historial(userId: string, quienMira: string | null): Promise<{ partidas: HistorialPartida[] } | null> {
    const usuario = await this.estadisticas.nombreDe(userId);
    if (!usuario) return null;
    if (!(await this.estadisticas.sonPublicas(userId)) && quienMira !== userId) return null;
    const partidas = await this.estadisticas.historial(userId);
    return { partidas: partidas.map((p) => verPartida(p, userId, quienMira)) };
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

type ParticipanteGuardado = PartidaGuardada['participantes'][number];
type AsientoGuardado = NonNullable<PartidaGuardada['mesa']>[number];

/** Una partida del historial, como la ve quien mira (ver EstadisticasService.historial). */
export interface HistorialPartida extends Omit<PartidaGuardada, 'participantes' | 'mesa'> {
  /** Lo de la persona cuyo historial es. */
  propia: ParticipanteGuardado | null;
  /** Los demás con cuenta que se pueden ver. */
  participantes: ParticipanteGuardado[];
  /** Los que no se pueden ver (estadísticas privadas, y quien mira no estuvo). */
  ocultos: number;
  mesa: (AsientoGuardado & { oculto?: boolean })[] | null;
}

function verPartida(p: PartidaGuardada, userId: string, quienMira: string | null): HistorialPartida {
  const estuvo = !!quienMira && p.participantes.some((x) => x.userId === quienMira);
  const publico = (id: string) => !!p.participantes.find((y) => y.userId === id)?.estadisticasPublicas;
  const visible = (id: string | null) => estuvo || !id || id === userId || publico(id);
  const otros = p.participantes.filter((x) => x.userId !== userId);
  return {
    ...p,
    propia: p.participantes.find((x) => x.userId === userId) ?? null,
    participantes: otros.filter((x) => visible(x.userId)),
    ocultos: otros.filter((x) => !visible(x.userId)).length,
    mesa:
      p.mesa?.map((a) =>
        visible(a.userId)
          ? a
          : { numero: a.numero, nombre: null, userId: null, personaje: null, ficha: null, alineamiento: null, muerto: a.muerto, oculto: true },
      ) ?? null,
    votaciones: estuvo || p.participantes.every((x) => visible(x.userId)) ? p.votaciones : null,
  };
}
