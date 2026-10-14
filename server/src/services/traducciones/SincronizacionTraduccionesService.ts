import { IdiomaRepository } from '../../repositories/IdiomaRepository';
import { TraduccionRepository, VarianteTraducciones } from '../../repositories/TraduccionRepository';
import { GENEROS, Genero, Idioma } from '../../types/guiones';
import { FuenteTraducciones } from './FuenteTraducciones';

/** Resultado de una sincronización. */
export interface ResultadoSincronizacionTraducciones {
  idiomas: number;
  traducciones: number;
  /** Idiomas que no se han podido actualizar (se quedan como estaban). */
  fallidos: string[];
}

const esperar = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms));

/**
 * Mantiene al día los idiomas y las traducciones de los personajes con su fuente.
 *
 * - Pide los idiomas de uno en uno (y, los que distinguen género, una vez por
 *   género), con una pausa entre peticiones, para cargar la fuente lo menos posible.
 * - Si falla un idioma, se queda con lo que tenía y sigue con los demás; si
 *   falla la lista de idiomas, no se toca nada.
 * - Los idiomas que desaparezcan de la fuente no se borran.
 *
 * No sabe de cuándo se ejecuta (eso es de TareaProgramada) ni de qué fuente
 * concreta se trata.
 */
export class SincronizacionTraduccionesService {
  private enCurso = false;

  constructor(
    private fuente: FuenteTraducciones,
    private idiomas: IdiomaRepository,
    private traducciones: TraduccionRepository,
    private pausaEntrePeticionesMs: number,
  ) {}

  /** Sincroniza si no hay idiomas o la última sincronización tiene más de `vigenciaMs`. */
  async sincronizarSiCaducada(vigenciaMs: number): Promise<ResultadoSincronizacionTraducciones | null> {
    const ultima = await this.idiomas.ultimaSincronizacion();
    if (ultima && Date.now() - ultima.getTime() <= vigenciaMs) return null;
    return this.sincronizar();
  }

  async sincronizar(): Promise<ResultadoSincronizacionTraducciones> {
    if (this.enCurso) return { idiomas: 0, traducciones: 0, fallidos: [] };
    this.enCurso = true;
    try {
      const idiomas = await this.fuente.obtenerIdiomas();
      if (idiomas.length === 0) throw new Error('la fuente no ha devuelto idiomas');
      const resultado: ResultadoSincronizacionTraducciones = { idiomas: 0, traducciones: 0, fallidos: [] };
      for (const idioma of idiomas) {
        try {
          const variantes = await this.variantes(idioma);
          await this.idiomas.guardar(idioma, new Date().toISOString());
          await this.traducciones.reemplazarDeIdioma(idioma.id, variantes);
          resultado.idiomas++;
          resultado.traducciones += variantes.reduce((n, v) => n + v.traducciones.length, 0);
        } catch (e) {
          console.error(`[SincronizacionTraducciones] No se ha podido actualizar «${idioma.id}»:`, e);
          resultado.fallidos.push(idioma.id);
        }
      }
      return resultado;
    } finally {
      this.enCurso = false;
    }
  }

  /** Las traducciones de un idioma: una por género si los distingue, o una sola. */
  private async variantes(idioma: Idioma): Promise<VarianteTraducciones[]> {
    const generos: (Genero | null)[] = idioma.tieneGeneros ? [...GENEROS] : [null];
    const variantes: VarianteTraducciones[] = [];
    for (const genero of generos) {
      await esperar(this.pausaEntrePeticionesMs);
      const traducciones = await this.fuente.obtenerTraducciones(idioma.id, genero);
      if (traducciones.length === 0) throw new Error(`sin traducciones${genero ? ` (${genero})` : ''}`);
      variantes.push({ genero, traducciones });
    }
    return variantes;
  }
}
