import path from 'path';
import { AlmacenIconos } from '../../repositories/AlmacenIconos';
import { PersonajeGuardado, PersonajeRepository } from '../../repositories/PersonajeRepository';
import { PersonajeDeFuente } from '../../types/guiones';
import { FuentePersonajes } from './FuentePersonajes';

/** Resultado de una sincronización. */
export interface ResultadoSincronizacion {
  personajes: number;
  iconosDescargados: number;
}

/**
 * Mantiene el catálogo de personajes al día con su fuente: guarda cada
 * personaje y copia sus iconos (por defecto, bueno y malvado).
 *
 * - Un icono solo se vuelve a descargar si cambia su dirección en la fuente o
 *   falta el archivo; si el bueno o el malvado es el mismo que el de por
 *   defecto, se usa esa copia.
 * - Si la fuente falla o no devuelve nada, no se toca el catálogo.
 * - Los personajes que desaparezcan de la fuente no se borran (podría haber
 *   guiones que los usen).
 *
 * No sabe de cuándo se ejecuta (eso es de TareaProgramada) ni de qué fuente
 * concreta se trata.
 */
export class SincronizacionPersonajesService {
  private enCurso = false;

  constructor(
    private fuente: FuentePersonajes,
    private repositorio: PersonajeRepository,
    private iconos: AlmacenIconos,
  ) {}

  /** Sincroniza si no hay catálogo o la última sincronización tiene más de `vigenciaMs`. */
  async sincronizarSiCaducada(vigenciaMs: number): Promise<ResultadoSincronizacion | null> {
    const ultima = await this.repositorio.ultimaSincronizacion();
    if (ultima && Date.now() - ultima.getTime() <= vigenciaMs) return null;
    return this.sincronizar();
  }

  async sincronizar(): Promise<ResultadoSincronizacion> {
    if (this.enCurso) return { personajes: 0, iconosDescargados: 0 };
    this.enCurso = true;
    try {
      const deLaFuente = await this.fuente.obtenerPersonajes();
      if (deLaFuente.length === 0) throw new Error('la fuente no ha devuelto personajes');
      const actuales = new Map((await this.repositorio.listar()).map((p) => [p.id, p]));
      const ahora = new Date().toISOString();
      let iconosDescargados = 0;
      for (const p of deLaFuente) {
        const previo = actuales.get(p.id);
        const icono = await this.copiarIcono(p.id, p.iconoOrigen, previo?.iconoOrigen, previo?.icono, '');
        const variante = (origen: string | null, origenPrevio?: string | null, rutaPrevia?: string | null, sufijo = '') =>
          origen && origen === p.iconoOrigen
            ? Promise.resolve({ ruta: icono.ruta, descargado: false })
            : this.copiarIcono(p.id, origen, origenPrevio, rutaPrevia, sufijo);
        const bueno = await variante(p.iconoBuenoOrigen, previo?.iconoBuenoOrigen, previo?.iconoBueno, '-bueno');
        const malvado = await variante(p.iconoMalvadoOrigen, previo?.iconoMalvadoOrigen, previo?.iconoMalvado, '-malvado');
        iconosDescargados += [icono, bueno, malvado].filter((i) => i.descargado).length;
        await this.repositorio.guardar(this.aGuardar(p, { icono: icono.ruta, bueno: bueno.ruta, malvado: malvado.ruta }, ahora));
      }
      return { personajes: deLaFuente.length, iconosDescargados };
    } finally {
      this.enCurso = false;
    }
  }

  private aGuardar(
    p: PersonajeDeFuente,
    rutas: { icono: string | null; bueno: string | null; malvado: string | null },
    ahora: string,
  ): PersonajeGuardado {
    return {
      ...p,
      icono: rutas.icono,
      iconoBueno: rutas.bueno,
      iconoMalvado: rutas.malvado,
      sincronizadoEn: ahora,
    };
  }

  /**
   * Copia un icono si hace falta y devuelve su ruta pública. Si la fuente no lo
   * tiene o falla, se queda el que hubiera (o ninguno).
   */
  private async copiarIcono(
    id: string,
    origen: string | null,
    origenPrevio: string | null | undefined,
    rutaPrevia: string | null | undefined,
    sufijo: string,
  ): Promise<{ ruta: string | null; descargado: boolean }> {
    if (!origen) return { ruta: null, descargado: false };
    const ext = path.extname(new URL(origen).pathname).toLowerCase();
    const archivo = `${id}${sufijo}${['.png', '.webp', '.jpg', '.jpeg', '.gif'].includes(ext) ? ext : '.png'}`;
    // La copia que ya hay vale si es del mismo origen y sigue ahí (aunque se llame distinto)
    if (origenPrevio === origen && rutaPrevia && this.iconos.existe(path.basename(rutaPrevia))) {
      return { ruta: rutaPrevia, descargado: false };
    }
    const datos = await this.fuente.descargarIcono(origen).catch(() => null);
    if (!datos) return { ruta: rutaPrevia ?? null, descargado: false };
    return { ruta: this.iconos.guardar(archivo, datos), descargado: true };
  }
}
