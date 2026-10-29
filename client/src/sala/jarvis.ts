import { useCallback, useEffect, useState } from 'react';
import { parseApiResponse } from '../utils/api';

/**
 * El modelo que guía al narrador virtual Jarvis (JEV, de TypeSafe): cada usuario
 * con cuenta pone el suyo en Preferencias. El servidor guarda la key cifrada y no
 * la devuelve nunca: aquí solo se sabe si la hay y en qué termina.
 */

export interface ConfiguracionJarvis {
  endpoint: string;
  modelo: string;
  tieneKey: boolean;
  ultimos4: string | null;
  /** Cuándo se comprobó que respondía, o null: sin comprobar, Jarvis no se puede añadir. */
  comprobadoEn: string | null;
}

/** Lo que contesta al guardar o comprobar: la configuración y, si no responde, por qué. */
export type ResultadoJarvis = { ok: true; configuracion: ConfiguracionJarvis; error: string | null } | { ok: false; error: string; campo?: string };

const API_URL: string = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';
const RUTA = '/narrador-virtual/jarvis';

async function pedir(token: string, ruta: string, metodo = 'GET', cuerpo?: unknown): Promise<Response> {
  return fetch(`${API_URL}${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
}

/** Lo que dice la respuesta: la configuración (y si responde) o el error, con el campo que falla. */
async function resultado(r: Response): Promise<ResultadoJarvis> {
  const cuerpo = (await r.json().catch(() => null)) as (ConfiguracionJarvis & { error?: string | null; campo?: string }) | null;
  if (!r.ok || !cuerpo) return { ok: false, error: cuerpo?.error ?? 'No se ha podido contactar con el servidor.', campo: cuerpo?.campo };
  const { error = null, ...configuracion } = cuerpo;
  return { ok: true, configuracion, error };
}

/** La configuración de Jarvis de la cuenta (null sin cuenta o mientras carga), con cómo cambiarla. */
export function useJarvis(token: string | null) {
  // La de ese token (al cambiar de cuenta, la otra no vale)
  const [cargada, setCargada] = useState<{ token: string; configuracion: ConfiguracionJarvis } | null>(null);
  const configuracion = token && cargada?.token === token ? cargada.configuracion : null;
  const setConfiguracion = useCallback((c: ConfiguracionJarvis) => token && setCargada({ token, configuracion: c }), [token]);

  useEffect(() => {
    if (!token) return;
    let vigente = true;
    pedir(token, RUTA)
      .then((r) => parseApiResponse<ConfiguracionJarvis>(r))
      .then((c) => vigente && setCargada({ token, configuracion: c }))
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [token]);

  const aplicar = useCallback(
    async (r: Promise<Response>) => {
      const res = await resultado(await r);
      if (res.ok) setConfiguracion(res.configuracion);
      return res;
    },
    [setConfiguracion],
  );

  return {
    configuracion,
    /** Sin key nueva (vacía), se queda la que había. */
    guardar: (datos: { endpoint: string; modelo: string; apiKey: string }) =>
      token ? aplicar(pedir(token, RUTA, 'PUT', datos)) : Promise.resolve<ResultadoJarvis>({ ok: false, error: 'Necesitas una cuenta.' }),
    comprobar: () => (token ? aplicar(pedir(token, `${RUTA}/comprobar`, 'POST')) : Promise.resolve<ResultadoJarvis>({ ok: false, error: 'Necesitas una cuenta.' })),
    borrar: async (): Promise<string | null> => {
      if (!token) return 'Necesitas una cuenta.';
      const r = await pedir(token, RUTA, 'DELETE');
      if (!r.ok) return 'No se ha podido quitar.';
      setConfiguracion({ endpoint: 'https://api.typesafe.ai', modelo: 'jev-latest', tieneKey: false, ultimos4: null, comprobadoEn: null });
      return null;
    },
  };
}

export type ControlJarvis = ReturnType<typeof useJarvis>;
