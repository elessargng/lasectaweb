/**
 * Configuración del modelo JEV de TypeSafe con el que decide Jarvis. Se lee del
 * entorno aquí, una vez, y se inyecta: la key de `JEV_API_KEY` y, si se quieren
 * otros, `JEV_ENDPOINT` y `JEV_MODELO`. Sin key, Jarvis no está disponible.
 */
export interface ConfigJev {
  /** La base de la API (sin /v1/…). */
  endpoint: string;
  modelo: string;
  apiKey: string;
}

export const ENDPOINT_JEV = 'https://api.typesafe.ai';
export const MODELO_JEV = 'jev-latest';

/**
 * La base de la API a partir de lo que se haya puesto: vale la base
 * (`https://api.typesafe.ai`) o la dirección entera de una ruta (`…/v1/systemone`).
 */
export const baseJev = (endpoint: string) =>
  endpoint
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/v1(\/(systemone|models))?$/, '');

export function leerConfigJev(env: NodeJS.ProcessEnv = process.env): ConfigJev | null {
  const apiKey = env.JEV_API_KEY?.trim();
  if (!apiKey) return null;
  return { endpoint: baseJev(env.JEV_ENDPOINT?.trim() || ENDPOINT_JEV), modelo: env.JEV_MODELO?.trim() || MODELO_JEV, apiKey };
}
