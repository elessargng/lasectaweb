import { DatabaseRepository } from './DatabaseRepository';

/**
 * Dónde se guarda la partida en curso de la sala para recuperarla tras un reinicio
 * (ver SalaService.recuperar): lo que sea (en JSON), con la versión de su forma.
 */
export interface PartidaEnCurso {
  leer(): Promise<{ version: number; datos: unknown } | null>;
  guardar(version: number, datos: unknown): Promise<void>;
}

/** La partida en curso en la base de datos (tabla sala_en_curso, una sola fila). Solo guarda y lee. */
export class PartidaEnCursoRepository implements PartidaEnCurso {
  async leer(): Promise<{ version: number; datos: unknown } | null> {
    const db = await DatabaseRepository.getInstance();
    const fila = await db.get<{ version: number; datos: string }>('SELECT version, datos FROM sala_en_curso WHERE id = 1');
    return fila ? { version: fila.version, datos: JSON.parse(fila.datos) } : null;
  }

  async guardar(version: number, datos: unknown): Promise<void> {
    const db = await DatabaseRepository.getInstance();
    await db.run(
      `INSERT INTO sala_en_curso (id, version, datos, actualizada) VALUES (1, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET version = excluded.version, datos = excluded.datos, actualizada = excluded.actualizada`,
      [version, JSON.stringify(datos), new Date().toISOString()],
    );
  }
}

/** En memoria (los tests): como si la base de datos sobreviviera al reinicio. */
export class MemoriaPartidaEnCurso implements PartidaEnCurso {
  private guardada: { version: number; datos: string } | null = null;

  async leer(): Promise<{ version: number; datos: unknown } | null> {
    return this.guardada && { version: this.guardada.version, datos: JSON.parse(this.guardada.datos) };
  }

  async guardar(version: number, datos: unknown): Promise<void> {
    this.guardada = { version, datos: JSON.stringify(datos) };
  }
}
