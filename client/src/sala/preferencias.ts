import { useCallback, useState } from 'react';
import {
  CALAVERA_DEFECTO,
  esEstiloCalavera,
  esEstiloMano,
  esEstiloSilla,
  esEstiloVoto,
  MANO_DEFECTO,
  SILLA_DEFECTO,
  VOTO_DEFECTO,
  type EstiloVoto,
  type PreferenciaCalavera,
  type PreferenciaMano,
  type PreferenciaSilla,
} from './marcas';
import { SONIDOS, type SonidosActivos } from './sonidos';

/**
 * Preferencias de la sala que solo cambian cómo la ves tú (tamaños, distancias,
 * idiomas, dispositivos). Viven en memoria: con cuenta se guardan en el servidor
 * (configuracion.ts); como invitado no se guarda nada.
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
  /** Qué sonidos suenan, uno a uno (la cuenta atrás, los votos, los de las conversaciones…). Pestaña Sonido. */
  sonidos: SonidosActivos;
  /**
   * Al quedarte sin nadie más en una conversación privada, salir de ella sin
   * pulsar «Salir». Pestaña Comunicaciones; de entrada, no: se sale a mano.
   */
  salirConversacionSinNadie: boolean;
  /** Lo que se ve en la columna de la izquierda (ver ColumnaLateral). */
  panelLateral: PanelLateral;
  /** La columna de la izquierda contraída: solo su barra de iconos. */
  panelLateralContraido: boolean;
  /** Los faroles fijados arriba de la columna, se vea el panel que se vea. */
  farolesFijados: boolean;
  /** Idioma (id del paquete de traducción) de los nombres de los personajes. Pestaña Usuario. */
  idiomaNombres: string;
  /** Idioma de las habilidades y los recordatorios de los personajes. Pestaña Usuario. */
  idiomaDescripciones: string;
  /** Género de los textos, en los idiomas que lo distinguen. Pestaña Usuario. */
  genero: 'masculino' | 'femenino';
  /** Cómo se ve la calavera de las nominaciones (o al azar en cada partida). Pestaña Interfaz. */
  calavera: PreferenciaCalavera;
  /** Cómo se ven las manos levantadas (o al azar en cada partida). Pestaña Interfaz. */
  mano: PreferenciaMano;
  /** Qué silla se ve en los asientos libres (o al azar en cada partida). Pestaña Interfaz. */
  silla: PreferenciaSilla;
  /** Cómo se ve si a un muerto le queda el voto: su vela o un círculo en el sudario. Pestaña Interfaz. */
  voto: EstiloVoto;
  /** Cámara y micrófono elegidos (deviceId); vacío: los del sistema. Pestaña Comunicaciones. */
  idCamara: string;
  idMicrofono: string;
}

type ClaveNumerica = 'tamanoAvatar' | 'tamanoFicha' | 'distanciaFicha';
type ClaveSiNo = 'avatarAuto' | 'fichaAuto' | 'salirConversacionSinNadie' | 'panelLateralContraido' | 'farolesFijados';

/** Los paneles de la columna de la izquierda: uno a la vez, elegido en su barra de iconos. */
export const PANELES_LATERALES = ['mensajes', 'conversaciones', 'npcs', 'faroles'] as const;
export type PanelLateral = (typeof PANELES_LATERALES)[number];
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

/** Valor inicial de las de sí o no. */
const SI_NO: Record<ClaveSiNo, boolean> = {
  avatarAuto: true,
  fichaAuto: true,
  salirConversacionSinNadie: false,
  panelLateralContraido: false,
  farolesFijados: false,
};

/** Lo que guardaba antes la sala en el navegador (para llevarlo a la cuenta la primera vez). */
export const KEY_ANTIGUA = 'sala:preferencias';
/** Cámara y micrófono son de este navegador: con cuenta se recuerdan aquí, no en el servidor. */
const KEY_DISPOSITIVOS = 'sala:dispositivos';

const entre = (n: number, { min, max }: Rango) => Math.min(max, Math.max(min, n));

/** Preferencias válidas a partir de lo que sea (guardado, de un perfil…): lo que falte o no valga, el valor inicial. */
export function normalizarPreferencias(datos: unknown): PreferenciasSala {
  const guardadas = (datos && typeof datos === 'object' ? datos : {}) as Record<string, unknown>;
  const preferencias = {} as PreferenciasSala;
  for (const [clave, rango] of Object.entries(RANGOS) as [ClaveNumerica, Rango][]) {
    const valor = guardadas[clave];
    preferencias[clave] = typeof valor === 'number' && Number.isFinite(valor) ? entre(valor, rango) : rango.defecto;
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
  preferencias.panelLateral = (PANELES_LATERALES as readonly unknown[]).includes(guardadas.panelLateral)
    ? (guardadas.panelLateral as PanelLateral)
    : 'mensajes';
  preferencias.calavera = esEstiloCalavera(guardadas.calavera) ? guardadas.calavera : CALAVERA_DEFECTO;
  preferencias.mano = esEstiloMano(guardadas.mano) ? guardadas.mano : MANO_DEFECTO;
  preferencias.silla = esEstiloSilla(guardadas.silla) ? guardadas.silla : SILLA_DEFECTO;
  preferencias.voto = esEstiloVoto(guardadas.voto) ? guardadas.voto : VOTO_DEFECTO;
  // Los sonidos: uno a uno. Lo de antes (un sí o no para todos) vale para todos
  const sonidos = guardadas.sonidos;
  const deCada = (sonidos && typeof sonidos === 'object' ? sonidos : {}) as Record<string, unknown>;
  preferencias.sonidos = Object.fromEntries(
    SONIDOS.map(({ id }) => {
      const guardado = typeof sonidos === 'boolean' ? sonidos : deCada[id];
      return [id, typeof guardado === 'boolean' ? guardado : true];
    }),
  ) as SonidosActivos;
  // Los dispositivos: un id del navegador, o vacío (el predeterminado del sistema)
  const idDispositivo = (v: unknown) => (typeof v === 'string' && v.length <= 200 ? v : '');
  preferencias.idCamara = idDispositivo(guardadas.idCamara);
  preferencias.idMicrofono = idDispositivo(guardadas.idMicrofono);
  return preferencias;
}

/** Lo que va a la cuenta y a los perfiles: todo menos las comunicaciones. */
export type PreferenciasGuardables = Omit<PreferenciasSala, 'idCamara' | 'idMicrofono'>;

export function sinComunicaciones(preferencias: PreferenciasSala): PreferenciasGuardables {
  const resto: Partial<PreferenciasSala> = { ...preferencias };
  delete resto.idCamara;
  delete resto.idMicrofono;
  return resto as PreferenciasGuardables;
}

function leerDispositivos(): Pick<PreferenciasSala, 'idCamara' | 'idMicrofono'> {
  try {
    const { idCamara, idMicrofono } = normalizarPreferencias(JSON.parse(localStorage.getItem(KEY_DISPOSITIVOS) ?? '{}'));
    return { idCamara, idMicrofono };
  } catch {
    return { idCamara: '', idMicrofono: '' };
  }
}

/** `recordarDispositivos`: con cuenta, la cámara y el micrófono se recuerdan en este navegador. */
export function usePreferencias(recordarDispositivos: boolean) {
  const [preferencias, setPreferencias] = useState(() => ({
    ...normalizarPreferencias({}),
    ...(recordarDispositivos ? leerDispositivos() : {}),
  }));

  const cambiar = useCallback(
    (cambios: Partial<PreferenciasSala>) => {
      setPreferencias((prev) => {
        const nuevas = { ...prev, ...cambios };
        if (recordarDispositivos && ('idCamara' in cambios || 'idMicrofono' in cambios)) {
          try {
            localStorage.setItem(
              KEY_DISPOSITIVOS,
              JSON.stringify({ idCamara: nuevas.idCamara, idMicrofono: nuevas.idMicrofono })
            );
          } catch {
            // Sin almacenamiento: vale mientras la página esté abierta.
          }
        }
        return nuevas;
      });
    },
    [recordarDispositivos]
  );

  /** Pone las de una configuración guardada, sin tocar las comunicaciones. */
  const reemplazar = useCallback((datos: unknown) => {
    setPreferencias((prev) => ({
      ...normalizarPreferencias(datos),
      idCamara: prev.idCamara,
      idMicrofono: prev.idMicrofono,
    }));
  }, []);

  return { preferencias, cambiar, reemplazar };
}
