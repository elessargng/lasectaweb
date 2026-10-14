import { useCallback, useState } from 'react';

/**
 * Preferencias de la sala que solo cambian cómo la ves tú (tamaños, distancias):
 * se guardan en este navegador y no pasan por el servidor.
 */
export interface PreferenciasSala {
  /** Lado, en píxeles, de los cuadros de avatar (narradores, asientos). Pestaña Interfaz. */
  tamanoAvatar: number;
  /** Diámetro, en píxeles, de las fichas redondas. Pestaña Interfaz. */
  tamanoFicha: number;
  /**
   * Dónde va la ficha respecto al cuadro del jugador, sobre la línea hacia el
   * centro de la mesa, en %: 0, centrada en el cuadro; 100, justo fuera de él
   * (igual en todos los asientos, para que las fichas formen un círculo).
   */
  distanciaFicha: number;
  /** El tamaño de los avatares lo decide la sala según la pantalla y los asientos. */
  avatarAuto: boolean;
  /** El tamaño de las fichas va en proporción al de los avatares. */
  fichaAuto: boolean;
  /** Suenan la cuenta atrás y los votos de la partida. */
  sonidos: boolean;
  /** Idioma (id del paquete de traducción) de los nombres de los personajes. Pestaña Usuario. */
  idiomaNombres: string;
  /** Idioma de las habilidades y los recordatorios de los personajes. Pestaña Usuario. */
  idiomaDescripciones: string;
  /** Género de los textos, en los idiomas que lo distinguen. Pestaña Usuario. */
  genero: 'masculino' | 'femenino';
  /** Cámara y micrófono elegidos (deviceId); vacío: los del sistema. Pestaña Comunicaciones. */
  idCamara: string;
  idMicrofono: string;
}

type ClaveNumerica = 'tamanoAvatar' | 'tamanoFicha' | 'distanciaFicha';
type ClaveSiNo = 'avatarAuto' | 'fichaAuto' | 'sonidos';
type ClaveIdioma = 'idiomaNombres' | 'idiomaDescripciones';

/** De entrada, el original (inglés). Si el guardado deja de existir, se ve en el original. */
const IDIOMA_DEFECTO = 'en';
const esIdIdioma = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9_-]{1,40}$/i.test(v);

export interface Rango {
  min: number;
  max: number;
  paso: number;
  defecto: number;
}

/** Límites y valor inicial de cada preferencia numérica. */
export const RANGOS: Record<ClaveNumerica, Rango> = {
  tamanoAvatar: { min: 64, max: 256, paso: 8, defecto: 160 },
  tamanoFicha: { min: 32, max: 160, paso: 4, defecto: 72 },
  distanciaFicha: { min: 0, max: 100, paso: 5, defecto: 75 },
};

/** Valor inicial de las de sí o no: automático, de entrada. */
const SI_NO: Record<ClaveSiNo, boolean> = { avatarAuto: true, fichaAuto: true, sonidos: true };

const KEY = 'sala:preferencias';

const entre = (n: number, { min, max }: Rango) => Math.min(max, Math.max(min, n));

function leer(): PreferenciasSala {
  let guardadas: Record<string, unknown> = {};
  try {
    guardadas = JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    // Sin almacenamiento o con algo roto: valores iniciales.
  }
  const preferencias = {} as PreferenciasSala;
  for (const [clave, rango] of Object.entries(RANGOS) as [ClaveNumerica, Rango][]) {
    const valor = Number(guardadas[clave]);
    preferencias[clave] = Number.isFinite(valor) ? entre(valor, rango) : rango.defecto;
  }
  for (const [clave, defecto] of Object.entries(SI_NO) as [ClaveSiNo, boolean][]) {
    const valor = guardadas[clave];
    preferencias[clave] = typeof valor === 'boolean' ? valor : defecto;
  }
  for (const clave of ['idiomaNombres', 'idiomaDescripciones'] as ClaveIdioma[]) {
    const valor = guardadas[clave];
    preferencias[clave] = esIdIdioma(valor) ? valor : IDIOMA_DEFECTO;
  }
  preferencias.genero = guardadas.genero === 'femenino' ? 'femenino' : 'masculino';
  // Los dispositivos: un id del navegador, o vacío (el predeterminado del sistema)
  const idDispositivo = (v: unknown) => (typeof v === 'string' && v.length <= 200 ? v : '');
  preferencias.idCamara = idDispositivo(guardadas.idCamara);
  preferencias.idMicrofono = idDispositivo(guardadas.idMicrofono);
  return preferencias;
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
