import { randomUUID } from 'crypto';
import { DatabaseRepository } from './DatabaseRepository';
import type { AsientoPartida, RegistroPartida } from '../services/estadisticas/SeguimientoPartida';
import type { SalaRegistroVotacion } from '../types/sala';

/** Lo que ha hecho alguien en una partida (como jugador o como narrador), con la partida. */
export interface Participacion {
  partidaId: string;
  fecha: string;
  guion: string | null;
  edicion: string | null;
  ganador: 'bueno' | 'malvado';
  dias: number;
  jugadores: number;
  papel: 'jugador' | 'narrador';
  roles: string[];
  rolFinal: string | null;
  alineamientoInicial: 'bueno' | 'malvado' | null;
  alineamientoFinal: 'bueno' | 'malvado' | null;
  gano: boolean | null;
  vivo: boolean | null;
  causas: string[];
  nominaciones: number;
  nominado: number;
  votos: number;
  ejecutado: number;
}

const lista = (texto: string | null): string[] => {
  try {
    const v = JSON.parse(texto ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};
const booleano = (n: number | null) => (n === null ? null : n === 1);
/** Un JSON guardado (una lista), o null si no lo hay (las partidas de antes de guardarlo). */
const jsonLista = <T>(texto: string | null): T[] | null => {
  if (texto === null || texto === undefined) return null;
  try {
    const v = JSON.parse(texto);
    return Array.isArray(v) ? (v as T[]) : null;
  } catch {
    return null;
  }
};

/** Alguien con cuenta en una partida del historial, con su nombre y si sus estadísticas son públicas. */
export interface ParticipanteHistorial
  extends Omit<Participacion, 'partidaId' | 'fecha' | 'guion' | 'edicion' | 'ganador' | 'dias' | 'jugadores'> {
  userId: string;
  username: string;
  profilePicture: string | null;
  estadisticasPublicas: boolean;
}

/** Una partida, con todo lo guardado de ella. */
export interface PartidaGuardada {
  partidaId: string;
  fecha: string;
  guion: string | null;
  edicion: string | null;
  ganador: 'bueno' | 'malvado';
  dias: number;
  causas: string[];
  participantes: ParticipanteHistorial[];
  /** null en las partidas de antes de guardar la mesa entera. */
  mesa: AsientoPartida[] | null;
  narradoresNombres: string[] | null;
  npcs: string[] | null;
  votaciones: SalaRegistroVotacion[] | null;
}

/**
 * Las partidas de la sala que han terminado (tabla sala_partidas) y lo de cada
 * jugador y narrador con cuenta en ellas (sala_partidas_participantes).
 */
export class EstadisticasRepository {
  /** Guarda una partida terminada y lo de cada uno, de una vez. */
  async guardar(r: RegistroPartida): Promise<void> {
    const db = await DatabaseRepository.getInstance();
    const id = randomUUID();
    await db.exec('BEGIN TRANSACTION;');
    try {
      await db.run(
        `INSERT INTO sala_partidas (id, fecha, guion, edicion, ganador, dias, jugadores, causas, mesa, narradoresNombres, npcs, votaciones)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, r.fecha.toISOString(), r.guion, r.edicion, r.ganador, r.dias, r.jugadores.length, JSON.stringify(r.causas),
          JSON.stringify(r.mesa), JSON.stringify(r.narradoresNombres), JSON.stringify(r.npcs), JSON.stringify(r.votaciones),
        ]
      );
      for (const j of r.jugadores) {
        await db.run(
          `INSERT OR IGNORE INTO sala_partidas_participantes
             (partidaId, userId, papel, roles, rolFinal, alineamientoInicial, alineamientoFinal, gano, vivo, causas, nominaciones, nominado, votos, ejecutado)
           VALUES (?, ?, 'jugador', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id, j.userId, JSON.stringify(j.roles), j.rolFinal, j.alineamientoInicial, j.alineamientoFinal,
            j.gano === null ? null : j.gano ? 1 : 0, j.vivo === null ? null : j.vivo ? 1 : 0,
            JSON.stringify(j.causas), j.nominaciones, j.nominado, j.votos, j.ejecutado,
          ]
        );
      }
      // Quien narraba (si no jugaba también en ella, que no debería)
      for (const userId of r.narradores) {
        await db.run("INSERT OR IGNORE INTO sala_partidas_participantes (partidaId, userId, papel) VALUES (?, ?, 'narrador')", [id, userId]);
      }
      await db.exec('COMMIT;');
    } catch (err) {
      await db.exec('ROLLBACK;');
      throw err;
    }
  }

  /** Las partidas de alguien, de la más reciente a la más antigua. */
  async participaciones(userId: string): Promise<Participacion[]> {
    const db = await DatabaseRepository.getInstance();
    const filas = await db.all<any[]>(
      `SELECT p.id AS partidaId, p.fecha, p.guion, p.edicion, p.ganador, p.dias, p.jugadores,
              pp.papel, pp.roles, pp.rolFinal, pp.alineamientoInicial, pp.alineamientoFinal, pp.gano, pp.vivo,
              pp.causas, pp.nominaciones, pp.nominado, pp.votos, pp.ejecutado
         FROM sala_partidas_participantes pp JOIN sala_partidas p ON p.id = pp.partidaId
        WHERE pp.userId = ?
        ORDER BY p.fecha DESC`,
      [userId]
    );
    return filas.map((f) => ({ ...f, roles: lista(f.roles), causas: lista(f.causas), gano: booleano(f.gano), vivo: booleano(f.vivo) }));
  }

  /**
   * Las partidas en las que ha estado alguien (jugando o narrando), de la más
   * reciente a la más antigua, con todo lo guardado y todos los que tenían cuenta.
   */
  async historial(userId: string): Promise<PartidaGuardada[]> {
    const db = await DatabaseRepository.getInstance();
    const partidas = await db.all<any[]>(
      `SELECT p.* FROM sala_partidas p
        WHERE p.id IN (SELECT partidaId FROM sala_partidas_participantes WHERE userId = ?)
        ORDER BY p.fecha DESC`,
      [userId]
    );
    if (partidas.length === 0) return [];
    const marcas = partidas.map(() => '?').join(', ');
    const filas = await db.all<any[]>(
      `SELECT pp.*, u.username, u.profilePicture, u.estadisticasPublicas
         FROM sala_partidas_participantes pp JOIN users u ON u.id = pp.userId
        WHERE pp.partidaId IN (${marcas})`,
      partidas.map((p) => p.id)
    );
    return partidas.map((p) => ({
      partidaId: p.id,
      fecha: p.fecha,
      guion: p.guion,
      edicion: p.edicion,
      ganador: p.ganador,
      dias: p.dias,
      causas: lista(p.causas),
      participantes: filas
        .filter((f) => f.partidaId === p.id)
        .map((f) => ({
          userId: f.userId,
          username: f.username,
          profilePicture: f.profilePicture ?? null,
          estadisticasPublicas: f.estadisticasPublicas === 1,
          papel: f.papel,
          roles: lista(f.roles),
          rolFinal: f.rolFinal,
          alineamientoInicial: f.alineamientoInicial,
          alineamientoFinal: f.alineamientoFinal,
          gano: booleano(f.gano),
          vivo: booleano(f.vivo),
          causas: lista(f.causas),
          nominaciones: f.nominaciones,
          nominado: f.nominado,
          votos: f.votos,
          ejecutado: f.ejecutado,
        })),
      mesa: jsonLista<AsientoPartida>(p.mesa),
      narradoresNombres: jsonLista<string>(p.narradoresNombres),
      npcs: jsonLista<string>(p.npcs),
      votaciones: jsonLista<SalaRegistroVotacion>(p.votaciones),
    }));
  }

  /** Cuántas partidas ha jugado alguien (como jugador). */
  async contarPartidas(userId: string): Promise<number> {
    const db = await DatabaseRepository.getInstance();
    const fila = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM sala_partidas_participantes WHERE userId = ? AND papel = 'jugador'", [userId]);
    return fila?.n ?? 0;
  }

  /** Si alguien tiene sus estadísticas públicas. */
  async sonPublicas(userId: string): Promise<boolean> {
    const db = await DatabaseRepository.getInstance();
    const fila = await db.get<{ estadisticasPublicas: number }>('SELECT estadisticasPublicas FROM users WHERE id = ?', [userId]);
    return fila?.estadisticasPublicas === 1;
  }

  /** Quienes tienen las estadísticas públicas y alguna partida, por nombre. */
  async publicos(): Promise<{ userId: string; username: string; profilePicture: string | null; partidas: number }[]> {
    const db = await DatabaseRepository.getInstance();
    return db.all(
      `SELECT u.id AS userId, u.username, u.profilePicture, COUNT(pp.partidaId) AS partidas
         FROM users u JOIN sala_partidas_participantes pp ON pp.userId = u.id
        WHERE u.estadisticasPublicas = 1
        GROUP BY u.id
        ORDER BY u.username COLLATE NOCASE`
    );
  }

  /** Lo público de alguien (su perfil para los demás): nada de correo ni datos personales. */
  async perfil(userId: string): Promise<{ userId: string; username: string; profilePicture: string | null; createdAt: string; estadisticasPublicas: boolean } | null> {
    const db = await DatabaseRepository.getInstance();
    const fila = await db.get<any>('SELECT id, username, profilePicture, createdAt, estadisticasPublicas FROM users WHERE id = ?', [userId]);
    return fila
      ? { userId: fila.id, username: fila.username, profilePicture: fila.profilePicture ?? null, createdAt: fila.createdAt, estadisticasPublicas: fila.estadisticasPublicas === 1 }
      : null;
  }

  async nombreDe(userId: string): Promise<{ username: string; profilePicture: string | null } | null> {
    const db = await DatabaseRepository.getInstance();
    return (await db.get<{ username: string; profilePicture: string | null }>('SELECT username, profilePicture FROM users WHERE id = ?', [userId])) ?? null;
  }
}
