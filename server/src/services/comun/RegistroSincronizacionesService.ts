import { SincronizacionRepository } from '../../repositories/SincronizacionRepository';

/** Las sincronizaciones que se vigilan, con el nombre que se enseña. */
export const SINCRONIZACIONES = {
  personajes: 'Personajes',
  traducciones: 'Traducciones de los personajes',
  djinn: 'Reglas del Djinn',
} as const;
export type IdSincronizacion = keyof typeof SINCRONIZACIONES;

/** El estado de una sincronización para enseñarlo (fechas en ISO; null si nunca). */
export interface EstadoSincronizacionVisible {
  id: IdSincronizacion;
  nombre: string;
  ultimoIntento: string | null;
  ultimoExito: string | null;
  error: string | null;
}

/** Mensaje de un error, con la causa de red si la hay («fetch failed (ENOTFOUND)»). */
function mensajeDe(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const causa = (e as { cause?: { code?: string; message?: string } }).cause;
  const detalle = causa?.code || causa?.message;
  return (detalle ? `${e.message} (${detalle})` : e.message).slice(0, 500);
}

/**
 * Apunta cómo va cada sincronización (cuándo se intentó, cuándo salió bien y
 * por qué falló), para avisar en la gestión. Envuelve la tarea sin saber qué
 * hace: la sincronización no sabe que se la vigila.
 */
export class RegistroSincronizacionesService {
  constructor(private repositorio: SincronizacionRepository) {}

  /**
   * Ejecuta la tarea y apunta el resultado. Si no se ejecuta (devuelve null, p.
   * ej. porque la copia no ha caducado) no se apunta nada. `problema` dice si un
   * resultado, aun sin error, cuenta como fallo (p. ej. idiomas sin actualizar).
   */
  async registrar<T>(
    id: IdSincronizacion,
    tarea: () => Promise<T | null>,
    problema: (resultado: T) => string | null = () => null,
  ): Promise<T | null> {
    let resultado: T | null;
    try {
      resultado = await tarea();
    } catch (e) {
      await this.apuntar(id, mensajeDe(e));
      throw e;
    }
    if (resultado !== null) await this.apuntar(id, problema(resultado));
    return resultado;
  }

  /** Todas las sincronizaciones vigiladas, también las que aún no se han hecho nunca. */
  async estado(): Promise<EstadoSincronizacionVisible[]> {
    const guardados = new Map((await this.repositorio.listar()).map((e) => [e.id, e]));
    return (Object.keys(SINCRONIZACIONES) as IdSincronizacion[]).map((id) => ({
      id,
      nombre: SINCRONIZACIONES[id],
      ultimoIntento: guardados.get(id)?.ultimoIntento ?? null,
      ultimoExito: guardados.get(id)?.ultimoExito ?? null,
      error: guardados.get(id)?.error ?? null,
    }));
  }

  private async apuntar(id: IdSincronizacion, error: string | null): Promise<void> {
    const ahora = new Date().toISOString();
    try {
      if (error) await this.repositorio.registrarFallo(id, ahora, error);
      else await this.repositorio.registrarExito(id, ahora);
    } catch (e) {
      console.error(`[RegistroSincronizaciones] No se ha podido apuntar «${id}»:`, e);
    }
  }
}
