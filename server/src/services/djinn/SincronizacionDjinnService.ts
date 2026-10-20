import { DjinnRepository } from '../../repositories/DjinnRepository';
import { FuenteDjinn } from './FuenteDjinn';

/** Resultado de una sincronización. */
export interface ResultadoSincronizacionDjinn {
  reglas: number;
}

/**
 * Mantiene al día la copia local de las reglas del Djinn con su fuente. Si la
 * fuente falla o no devuelve nada, no se toca la copia; si no, se sustituye
 * entera (las reglas cambian de texto y desaparecen con las erratas).
 *
 * No sabe de cuándo se ejecuta (eso es de TareaProgramada) ni de qué fuente
 * concreta se trata.
 */
export class SincronizacionDjinnService {
  private enCurso = false;

  constructor(
    private fuente: FuenteDjinn,
    private repositorio: DjinnRepository,
  ) {}

  /** Sincroniza si no hay reglas o la última sincronización tiene más de `vigenciaMs`. */
  async sincronizarSiCaducada(vigenciaMs: number): Promise<ResultadoSincronizacionDjinn | null> {
    const ultima = await this.repositorio.ultimaSincronizacion();
    if (ultima && Date.now() - ultima.getTime() <= vigenciaMs) return null;
    return this.sincronizar();
  }

  async sincronizar(): Promise<ResultadoSincronizacionDjinn> {
    if (this.enCurso) return { reglas: 0 };
    this.enCurso = true;
    try {
      const reglas = await this.fuente.obtenerReglas();
      if (reglas.length === 0) throw new Error('la fuente no ha devuelto reglas del Djinn');
      await this.repositorio.reemplazarTodas(reglas, new Date().toISOString());
      return { reglas: reglas.length };
    } finally {
      this.enCurso = false;
    }
  }
}
