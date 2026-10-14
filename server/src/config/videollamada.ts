/**
 * Configuración de la videollamada de la sala (servidor LiveKit). Se lee del
 * entorno aquí, una vez, y se inyecta. Si falta algo, la videollamada queda
 * desactivada y la sala funciona igual, sin cámaras ni micrófonos.
 */
export interface ConfigVideollamada {
  /** Dirección pública del servidor de vídeo para los navegadores (wss://…). */
  urlPublica: string;
  /** Dirección de su API para este servidor (http://…); por defecto, la pública con http. */
  urlApi: string;
  apiKey: string;
  apiSecret: string;
}

export function leerConfigVideollamada(env: NodeJS.ProcessEnv = process.env): ConfigVideollamada | null {
  const urlPublica = (env.LIVEKIT_URL || '').trim();
  const apiKey = (env.LIVEKIT_API_KEY || '').trim();
  const apiSecret = (env.LIVEKIT_API_SECRET || '').trim();
  if (!urlPublica || !apiKey || !apiSecret) return null;
  const urlApi = (env.LIVEKIT_API_URL || '').trim() || urlPublica.replace(/^ws(s?):\/\//, 'http$1://');
  return { urlPublica, urlApi, apiKey, apiSecret };
}
