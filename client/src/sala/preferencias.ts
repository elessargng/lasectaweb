import { useCallback, useState } from 'react';

/**
 * Preferencias de interfaz de la sala: solo cambian cómo la ves tú, así que se
 * guardan en este navegador y no pasan por el servidor.
 */
export interface PreferenciasSala {
  /** Lado, en píxeles, de los avatares de la sala (ahora, los cuadros de narrador). */
  tamanoAvatar: number;
}

export const TAMANO_AVATAR = { min: 64, max: 256, paso: 8, defecto: 160 };

const KEY = 'sala:preferencias';
const DEFECTO: PreferenciasSala = { tamanoAvatar: TAMANO_AVATAR.defecto };

const entre = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function leer(): PreferenciasSala {
  try {
    const guardadas = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    const tamano = Number(guardadas.tamanoAvatar);
    return {
      ...DEFECTO,
      tamanoAvatar: Number.isFinite(tamano) ? entre(tamano, TAMANO_AVATAR.min, TAMANO_AVATAR.max) : DEFECTO.tamanoAvatar,
    };
  } catch {
    return DEFECTO;
  }
}

export function usePreferencias() {
  const [preferencias, setPreferencias] = useState(leer);

  const cambiar = useCallback((cambios: Partial<PreferenciasSala>) => {
    setPreferencias((prev) => {
      const nuevas = { ...prev, ...cambios };
      try {
        localStorage.setItem(KEY, JSON.stringify(nuevas));
      } catch {
        // Sin almacenamiento: vale mientras la página esté abierta.
      }
      return nuevas;
    });
  }, []);

  return { preferencias, cambiar };
}
