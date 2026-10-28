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
import { esAtajoValido, type Atajo } from './atajos';
import { esTonoLlamada, SONIDOS, TONO_LLAMADA_DEFECTO, type SonidosActivos, type TonoLlamada } from './sonidos';
import { esSalidaAudio, SALIDA_DEFECTO, type SalidaAudio } from './sonidoEnvolvente';
import { esPreferenciaFondo, FONDO_DEFECTO, type PreferenciaFondo } from './fondos';
import { COLORES_CIELO_DEFECTO, esColoresCielo, type ColoresCielo } from './cielo';

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
  /** Cómo suena una llamada entrante (el de botc.app, la campanilla de antes o un teléfono). Pestaña Sonido. */
  tonoLlamada: TonoLlamada;
  /**
   * Al quedarte sin nadie más en una conversación privada, salir de ella sin
   * pulsar «Salir». Pestaña Comunicaciones; de entrada, no: se sale a mano.
   */
  salirConversacionSinNadie: boolean;
  /**
   * Dónde salen las invitaciones y peticiones de llamada entrantes: dentro del
   * panel de Charlas (de entrada) o fuera, encima de la columna lateral y a la
   * vista se vea el panel que se vea (como estaba antes de integrarlas dentro).
   * Pestaña Accesibilidad.
   */
  invitacionesFuera: boolean;
  /**
   * La tecla que lee el reloj del narrador (lo que queda y su mensaje), o null
   * si no hay. Pestaña Accesibilidad (no es un atajo de la pestaña Atajos).
   */
  teclaLeerReloj: Atajo | null;
  /**
   * Cómo se eligen los jugadores en el despertar de noche: en la plaza (la ventana
   * se esconde y se pulsa su ficha; de entrada) o en una lista dentro de la ventana.
   * Pestaña Accesibilidad.
   */
  eleccionDespertar: 'plaza' | 'lista';
  /**
   * Oír cada voz desde el lugar de su asiento en la plaza (ver sonidoEnvolvente.ts).
   * Pestaña Accesibilidad; de entrada, no.
   */
  sonidoEnvolvente: boolean;
  /** Con qué se oye, para el sonido envolvente: cambia cómo se procesa. Pestaña Accesibilidad. */
  salidaAudio: SalidaAudio;
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
  /**
   * La llamada estilo botc.app: llamar y mandar un mensaje no van junto al
   * nombre, sino dentro del cuadro de cada uno, y se ven al pulsar Intro
   * (ver llamadaBotc.ts). Pestaña Interfaz; de entrada, no.
   */
  llamadaBotc: boolean;
  /**
   * El fondo que se ve: el del guion o el que pone el narrador (de entrada; si no
   * hay, el de La Secta), o siempre uno fijo (ver fondos.ts). Pestaña Interfaz.
   */
  fondo: PreferenciaFondo;
  /**
   * La ciudad animada en el centro de la mesa (ver CiudadPlaza): solo al atardecer y al
   * amanecer (de entrada), siempre a la vista o nunca. Pestaña Interfaz.
   */
  ciudad: ModoCiudad;
  /**
   * En esa ciudad, el poblado (las casas y la torre); sin él, solo el cielo. Se llama así
   * porque antes la ciudad iba en la cabecera: el nombre se guarda. Pestaña Interfaz.
   */
  pobladoCabecera: boolean;
  /** El cielo estrellado detrás de la sala de noche (ver CieloEstrellado). Pestaña Interfaz. */
  cieloEstrellado: boolean;
  /** Los colores de sus estrellas (ver cielo.ts). Pestaña Interfaz. */
  coloresCielo: ColoresCielo;
  /** Lo rápido que se mueven sus estrellas, en % de lo de siempre (0: quietas). Pestaña Interfaz. */
  velocidadCielo: number;
  /** Cuántas estrellas hay, en % de lo de siempre. Pestaña Interfaz. */
  densidadCielo: number;
  /** Cuánto brillan, en % de lo de siempre. Pestaña Interfaz. */
  brilloCielo: number;
  /** Cuánto parpadean, en % (0: nada). Pestaña Interfaz. */
  parpadeoCielo: number;
  /** Cámara y micrófono elegidos (deviceId); vacío: los del sistema. Pestaña Comunicaciones. */
  idCamara: string;
  idMicrofono: string;
}

type ClaveNumerica =
  | 'tamanoAvatar'
  | 'tamanoFicha'
  | 'distanciaFicha'
  | 'velocidadCielo'
  | 'densidadCielo'
  | 'brilloCielo'
  | 'parpadeoCielo';
type ClaveSiNo =
  | 'avatarAuto'
  | 'fichaAuto'
  | 'salirConversacionSinNadie'
  | 'invitacionesFuera'
  | 'sonidoEnvolvente'
  | 'panelLateralContraido'
  | 'farolesFijados'
  | 'pobladoCabecera'
  | 'cieloEstrellado'
  | 'llamadaBotc';

/** Cuándo sale la ciudad de la plaza: al cambiar de fase (de entrada), siempre o nunca. */
export const MODOS_CIUDAD = ['cambios', 'siempre', 'nunca'] as const;
export type ModoCiudad = (typeof MODOS_CIUDAD)[number];

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
  // Las del cielo, en % del de siempre (ver cielo.ts)
  velocidadCielo: { min: 0, max: 150, paso: 10, defecto: 100 },
  densidadCielo: { min: 50, max: 200, paso: 10, defecto: 100 },
  brilloCielo: { min: 50, max: 200, paso: 10, defecto: 100 },
  parpadeoCielo: { min: 0, max: 100, paso: 10, defecto: 50 },
};

/** Valor inicial de las de sí o no. */
const SI_NO: Record<ClaveSiNo, boolean> = {
  avatarAuto: true,
  fichaAuto: true,
  salirConversacionSinNadie: false,
  invitacionesFuera: false,
  sonidoEnvolvente: false,
  panelLateralContraido: false,
  farolesFijados: false,
  pobladoCabecera: true,
  cieloEstrellado: true,
  llamadaBotc: false,
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
  preferencias.coloresCielo = esColoresCielo(guardadas.coloresCielo) ? guardadas.coloresCielo : COLORES_CIELO_DEFECTO;
  preferencias.fondo = esPreferenciaFondo(guardadas.fondo) ? guardadas.fondo : FONDO_DEFECTO;
  // La ciudad: lo de antes (un sí o no, ciudadCabecera) apagado sigue apagado; encendido, de entrada
  preferencias.ciudad = (MODOS_CIUDAD as readonly unknown[]).includes(guardadas.ciudad)
    ? (guardadas.ciudad as ModoCiudad)
    : guardadas.ciudadCabecera === false
      ? 'nunca'
      : 'cambios';
  preferencias.tonoLlamada = esTonoLlamada(guardadas.tonoLlamada) ? guardadas.tonoLlamada : TONO_LLAMADA_DEFECTO;
  // Los dispositivos: un id del navegador, o vacío (el predeterminado del sistema)
  const idDispositivo = (v: unknown) => (typeof v === 'string' && v.length <= 200 ? v : '');
  preferencias.eleccionDespertar = guardadas.eleccionDespertar === 'lista' ? 'lista' : 'plaza';
  preferencias.salidaAudio = esSalidaAudio(guardadas.salidaAudio) ? guardadas.salidaAudio : SALIDA_DEFECTO;
  // La tecla de leer el reloj: solo lo que es de un atajo
  const tecla = guardadas.teclaLeerReloj;
  preferencias.teclaLeerReloj = esAtajoValido(tecla)
    ? { code: tecla.code, key: tecla.key, ctrl: tecla.ctrl, alt: tecla.alt, shift: tecla.shift, meta: tecla.meta }
    : null;
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
