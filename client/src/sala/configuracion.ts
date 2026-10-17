import { useCallback, useEffect, useRef, useState } from 'react';
import { parseApiResponse } from '../utils/api';
import { KEY_ANTIGUA as KEY_ATAJOS, type AccionAtajo, type Atajo } from './atajos';
import type { GestosAsignados } from './gestos';
import { KEY_ANTIGUA as KEY_AVISOS, type AvisosActivos } from './avisosConfig';
import { KEY_ANTIGUA as KEY_PREFERENCIAS, type PreferenciasGuardables } from './preferencias';

/**
 * La configuración de la sala de cada usuario con cuenta, guardada en el
 * servidor: la que tiene puesta (se guarda sola al cambiarla) y los perfiles con
 * nombre para pasar de una a otra. Los invitados no guardan nada.
 *
 * No incluye las comunicaciones (cámara y micrófono, que son de cada navegador)
 * ni la imagen de perfil.
 */
export interface ConfiguracionSala {
  preferencias: PreferenciasGuardables;
  avisos: AvisosActivos;
  atajos: Record<AccionAtajo, Atajo>;
  /** Los gestos táctiles de los atajos (los que tienen; ver gestos.ts). */
  gestos: GestosAsignados;
}

/** Lo que guarda un perfil: la configuración y, además, el nombre en la sala (vacío: el de la cuenta). */
export interface DatosPerfil extends ConfiguracionSala {
  alias: string;
}

export interface PerfilConfiguracion {
  id: number;
  nombre: string;
  /** Tal cual llega del servidor: quien lo aplica lo valida. */
  datos: Partial<Record<keyof DatosPerfil, unknown>> | null;
  actualizadoEn: string;
}

export const NOMBRE_PERFIL_MAX = 40;

const API_URL: string = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';
/** Lo que se espera desde el último cambio antes de guardarlo (los deslizadores cambian muy seguido). */
const ESPERA_GUARDADO = 800;

const pedir = <T>(token: string, ruta: string, metodo = 'GET', cuerpo?: unknown, keepalive = false) =>
  fetch(`${API_URL}${ruta}`, {
    method: metodo,
    keepalive,
    headers: { Authorization: `Bearer ${token}`, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  }).then((r) => parseApiResponse<T>(r));

/** Lo que guardaba la sala en el navegador antes de guardarse en la cuenta, para no perderlo. */
function leerDelNavegador(): Partial<Record<keyof ConfiguracionSala, unknown>> | null {
  const leer = (key: string) => {
    try {
      const texto = localStorage.getItem(key);
      return texto ? JSON.parse(texto) : undefined;
    } catch {
      return undefined;
    }
  };
  const datos = { preferencias: leer(KEY_PREFERENCIAS), avisos: leer(KEY_AVISOS), atajos: leer(KEY_ATAJOS) };
  return Object.values(datos).some((v) => v !== undefined) ? datos : null;
}

function borrarDelNavegador() {
  for (const key of [KEY_PREFERENCIAS, KEY_AVISOS, KEY_ATAJOS]) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Nada que borrar.
    }
  }
}

type Carga = 'cargando' | 'lista' | 'error';

/**
 * Con `token` (cuenta): al entrar trae la configuración guardada y se la pasa a
 * `aplicar`; desde entonces guarda `actual` cada vez que cambia. Sin token no
 * hace nada. Si no se pudo cargar no guarda, para no pisar la buena con la de
 * por defecto.
 */
export function useConfiguracionCuenta(
  token: string | null,
  actual: ConfiguracionSala,
  aplicar: (datos: Partial<Record<keyof ConfiguracionSala, unknown>>) => void
) {
  const [carga, setCarga] = useState<Carga>(token ? 'cargando' : 'error');
  const [perfiles, setPerfiles] = useState<PerfilConfiguracion[]>([]);
  const aplicarRef = useRef(aplicar);
  useEffect(() => {
    aplicarRef.current = aplicar;
  });

  useEffect(() => {
    if (!token) return;
    let vigente = true;
    pedir<{ actual: Partial<Record<keyof ConfiguracionSala, unknown>> | null; perfiles: PerfilConfiguracion[] }>(
      token,
      '/sala/configuracion'
    )
      .then(({ actual: guardada, perfiles: suyos }) => {
        if (!vigente) return;
        const datos = guardada ?? leerDelNavegador();
        if (datos) aplicarRef.current(datos);
        setPerfiles(suyos);
        setCarga('lista');
      })
      .catch(() => vigente && setCarga('error'));
    return () => {
      vigente = false;
    };
  }, [token]);

  // Guardar lo que se cambia, un momento después del último cambio.
  const json = JSON.stringify(actual);
  const guardadoRef = useRef<string | null>(null);
  const pendienteRef = useRef<string | null>(null);
  const enviar = useCallback(
    (datos: string, keepalive = false) => {
      if (!token) return;
      pedir(token, '/sala/configuracion', 'PUT', { datos: JSON.parse(datos) }, keepalive)
        .then(() => {
          if (guardadoRef.current === null) borrarDelNavegador(); // ya está en la cuenta
          guardadoRef.current = datos;
          if (pendienteRef.current === datos) pendienteRef.current = null;
        })
        .catch(() => {
          // Se reintenta con el siguiente cambio.
        });
    },
    [token]
  );

  useEffect(() => {
    if (carga !== 'lista' || json === guardadoRef.current) return;
    pendienteRef.current = json;
    const t = window.setTimeout(() => enviar(json), ESPERA_GUARDADO);
    return () => window.clearTimeout(t);
  }, [carga, json, enviar]);

  // Si se cierra la página (o se sale de la sala) con un cambio sin guardar, se manda ya.
  useEffect(() => {
    const vaciar = () => pendienteRef.current && enviar(pendienteRef.current, true);
    window.addEventListener('pagehide', vaciar);
    return () => {
      window.removeEventListener('pagehide', vaciar);
      vaciar();
    };
  }, [enviar]);

  /** Guarda un perfil con ese nombre (si ya hay uno, lo sustituye). Devuelve el error, si lo hay. */
  const guardarPerfil = useCallback(
    async (nombre: string, datos: DatosPerfil): Promise<string | null> => {
      if (!token) return 'Inicia sesión para guardar perfiles.';
      try {
        const r = await pedir<{ perfiles: PerfilConfiguracion[] }>(token, '/sala/perfiles', 'POST', { nombre, datos });
        setPerfiles(r.perfiles);
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : 'No se pudo guardar el perfil.';
      }
    },
    [token]
  );

  const borrarPerfil = useCallback(
    async (id: number): Promise<string | null> => {
      if (!token) return 'Inicia sesión para borrar perfiles.';
      try {
        const r = await pedir<{ perfiles: PerfilConfiguracion[] }>(token, `/sala/perfiles/${id}`, 'DELETE');
        setPerfiles(r.perfiles);
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : 'No se pudo borrar el perfil.';
      }
    },
    [token]
  );

  return { carga, perfiles, guardarPerfil, borrarPerfil };
}
