import path from 'path';

/**
 * Configuración del catálogo de personajes y sus traducciones: se lee del
 * entorno aquí, una vez, y se inyecta en quien la necesite (los servicios no
 * leen process.env).
 */
export interface ConfigPersonajes {
  /** Expresión cron de la sincronización (semanal); null si está deshabilitada. */
  cronSincronizacion: string | null;
  /** Tiempo tras el que una sincronización se considera caducada (al arrancar se rehace). */
  vigenciaMs: number;
  /** Pausa entre peticiones a la fuente al sincronizar traducciones (para no cargarla). */
  pausaEntrePeticionesMs: number;
  /** Carpeta donde se guardan las copias de los iconos. */
  carpetaIconos: string;
  /** Ruta pública con la que se sirven esos iconos. */
  rutaPublicaIconos: string;
}

const DESHABILITADO = ['off', 'none', 'false', 'disabled', 'never', '0'];
const UNA_SEMANA_MS = 7 * 24 * 60 * 60 * 1000;

export function leerConfigPersonajes(env: NodeJS.ProcessEnv = process.env): ConfigPersonajes {
  // Una vez por semana (los lunes a las 4:30): los datos apenas cambian y así se molesta poco a la fuente
  const cron = (env.PERSONAJES_SYNC_CRON || '30 4 * * 1').trim();
  const subidas = env.UPLOAD_DIR || './uploads';
  const base = path.isAbsolute(subidas) ? subidas : path.resolve(process.cwd(), subidas);
  return {
    cronSincronizacion: DESHABILITADO.includes(cron.toLowerCase()) ? null : cron,
    vigenciaMs: UNA_SEMANA_MS,
    pausaEntrePeticionesMs: 1000,
    carpetaIconos: path.join(base, 'personajes'),
    rutaPublicaIconos: '/uploads/personajes',
  };
}
