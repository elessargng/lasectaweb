import { useEffect, useState } from 'react';

/**
 * Guiones de la sala, en el cliente: solo presentación. El servidor
 * (GuionService) interpreta los JSON, arma los guiones por defecto y los
 * resuelve con el catálogo de personajes y el orden de noche; aquí se pintan.
 */

/** Un personaje de un guion, como lo manda el servidor. */
export interface PersonajeDeGuion {
  id: string;
  nombre: string;
  /** Tipo de personaje, o 'desconocido' si no está en el catálogo. */
  tipo: string;
  habilidad: string;
  /** Ruta del icono (en nuestro servidor, /uploads/…, o https si es propio del guion). */
  icono: string | null;
  /**
   * El icono cuando es bueno o malvado (null si no lo hay). El de por defecto es
   * el de su alineamiento o, en los viajeros, neutral.
   */
  iconoBueno: string | null;
  iconoMalvado: string | null;
  recordatorioPrimeraNoche: string | null;
  recordatorioOtrasNoches: string | null;
  /** Los textos de sus fichas recordatorio (los suyos y, detrás, los globales), en el original. */
  recordatorios: string[];
  /** Altera la preparación de la partida (p. ej. el Barón). */
  preparacion: boolean;
  conocido: boolean;
}

/** El guion de la sala, ya resuelto por el servidor. */
export interface GuionResuelto {
  nombre: string;
  autor: string | null;
  /** La edición oficial si es uno de los guiones por defecto; null si se ha importado. */
  edicion: string | null;
  /** En el orden del guion. */
  personajes: PersonajeDeGuion[];
  /** Ids de los que se despiertan cada noche, en orden. */
  primeraNoche: string[];
  otrasNoches: string[];
  /** Los legendarios y lóricos del catálogo que no trae el guion (para ponerlos como NPCs). */
  npcs?: PersonajeDeGuion[];
  /** Los viajeros del catálogo que no trae el guion (se ponen en fichas o en la bolsa). */
  viajeros?: PersonajeDeGuion[];
  /** Las reglas propias del guion (las del Bootlegger), una por línea. */
  bootlegger?: string[];
}

/** Un guion por defecto que se puede elegir. */
export interface GuionPredeterminado {
  id: string;
  nombre: string;
  autor: string;
}

/**
 * El logo de una edición oficial: copia local de los de
 * https://release.botc.app/resources/editions/ (public/ediciones).
 */
const LOGOS_EDICIONES = ['troublebrewing', 'badmoonrising', 'sectsviolets'];
export const logoDeGuion = (g: { edicion: string | null }) =>
  g.edicion && LOGOS_EDICIONES.includes(g.edicion) ? `/ediciones/${g.edicion}.webp` : null;

/** «Trouble Brewing by Steven Medway». */
export const tituloDeGuion = (g: { nombre: string; autor: string | null }) =>
  g.autor ? `${g.nombre} by ${g.autor}` : g.nombre;

/** Los tipos, en el orden en que salen en la hoja, con su nombre. */
const TIPOS: { tipo: string; titulo: string }[] = [
  { tipo: 'townsfolk', titulo: 'Aldeanos' },
  { tipo: 'outsider', titulo: 'Forasteros' },
  { tipo: 'minion', titulo: 'Esbirros' },
  { tipo: 'demon', titulo: 'Demonios' },
  { tipo: 'traveller', titulo: 'Viajeros' },
  { tipo: 'fabled', titulo: 'Legendarios' },
  { tipo: 'loric', titulo: 'Lóricos' },
];

/** Los personajes agrupados por tipo para pintarlos (aldeanos, forasteros…); los desconocidos al final. */
export function porTipos<P extends { tipo: string }>(personajes: P[]): { titulo: string; personajes: P[] }[] {
  const grupos = TIPOS.map(({ tipo, titulo }) => ({ titulo, personajes: personajes.filter((p) => p.tipo === tipo) }));
  const otros = personajes.filter((p) => !TIPOS.some((t) => t.tipo === p.tipo));
  return [...grupos, { titulo: 'Sin identificar', personajes: otros }].filter((g) => g.personajes.length > 0);
}

/** Los personajes de una noche, en su orden (el servidor manda los ids). */
export function personajesDeNoche<P extends { id: string }>(
  guion: GuionResuelto,
  personajes: P[],
  noche: 'primera' | 'otras',
): P[] {
  const porId = new Map(personajes.map((p) => [p.id, p]));
  const ids = noche === 'primera' ? guion.primeraNoche : guion.otrasNoches;
  return ids.map((id) => porId.get(id)).filter((p): p is P => !!p);
}

/** Un idioma en el que se pueden ver los personajes (un paquete de traducción). */
export interface Idioma {
  id: string;
  nombre: string;
  /** Código para `lang` («es», «ca»…). */
  codigo: string;
  /** Tiene los textos en masculino y en femenino («jugadores» o «jugadoras»). */
  tieneGeneros: boolean;
}

/** Género de los textos, en los idiomas que lo distinguen. */
export type Genero = 'masculino' | 'femenino';
export const GENEROS: { id: Genero; nombre: string }[] = [
  { id: 'masculino', nombre: 'Masculino' },
  { id: 'femenino', nombre: 'Femenino' },
];

/** Lo que cambia de un personaje en otro idioma; null lo que no está traducido. */
export interface TraduccionPersonaje {
  personajeId: string;
  nombre: string | null;
  habilidad: string | null;
  recordatorios: string | null;
  recordatoriosGlobales: string | null;
  recordatorioPrimeraNoche: string | null;
  recordatorioOtrasNoches: string | null;
}

/** Las traducciones de un idioma, por personaje. */
export interface TraduccionesDeIdioma {
  idioma: Idioma;
  porPersonaje: Map<string, TraduccionPersonaje>;
}

/** El original de los personajes, en inglés: no hace falta pedirlo. */
export const IDIOMA_ORIGINAL: Idioma = { id: 'en', nombre: 'English', codigo: 'en', tieneGeneros: false };

/** Un texto con el idioma en que está (para su `lang`). */
export interface Texto {
  texto: string;
  lang: string;
}

/** Un personaje listo para pintar: el nombre en un idioma y las descripciones en otro (o el mismo). */
export interface PersonajeMostrado {
  id: string;
  tipo: string;
  icono: string | null;
  /** El icono cuando es bueno o malvado (null si no lo hay). */
  iconoBueno: string | null;
  iconoMalvado: string | null;
  /** Altera la preparación de la partida. */
  preparacion: boolean;
  nombre: Texto;
  habilidad: Texto;
  primeraNoche: Texto | null;
  otrasNoches: Texto | null;
  /** Los textos de sus fichas recordatorio, en el idioma de los nombres (en el orden del guion). */
  recordatorios: Texto[];
}

/** El catálogo y las traducciones dan los recordatorios separados por comas. */
const listaRecordatorios = (texto: string | null) =>
  (texto ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

/**
 * Los recordatorios de un personaje en un idioma: los traducidos si los hay y
 * cuadran con el original (los mismos), uno a uno; si no, el original.
 */
function recordatoriosEn(p: PersonajeDeGuion, traducciones: TraduccionesDeIdioma | null): Texto[] {
  const t = traducciones?.porPersonaje.get(p.id);
  const traducidos = t ? [...listaRecordatorios(t.recordatorios), ...listaRecordatorios(t.recordatoriosGlobales)] : [];
  // (?? []: por si el servidor aún no los manda)
  const originales = p.recordatorios ?? [];
  const usar = traducciones && traducidos.length === originales.length;
  return originales.map((original, i) =>
    usar ? { texto: traducidos[i], lang: traducciones.idioma.codigo } : { texto: original, lang: IDIOMA_ORIGINAL.codigo },
  );
}

/**
 * Los personajes del guion con los nombres en un idioma y las descripciones
 * en otro. Lo que no esté traducido (o los personajes propios del guion) se
 * queda en el original.
 */
export function mostrarPersonajes(
  personajes: PersonajeDeGuion[],
  nombres: TraduccionesDeIdioma | null,
  descripciones: TraduccionesDeIdioma | null,
): PersonajeMostrado[] {
  const elegir = (
    id: string,
    original: string | null,
    traducciones: TraduccionesDeIdioma | null,
    campo: 'nombre' | 'habilidad' | 'recordatorioPrimeraNoche' | 'recordatorioOtrasNoches',
  ): Texto | null => {
    const traducido = traducciones?.porPersonaje.get(id)?.[campo];
    if (traducciones && traducido) return { texto: traducido, lang: traducciones.idioma.codigo };
    return original ? { texto: original, lang: IDIOMA_ORIGINAL.codigo } : null;
  };
  return personajes.map((p) => ({
    id: p.id,
    tipo: p.tipo,
    icono: p.icono,
    iconoBueno: p.iconoBueno,
    iconoMalvado: p.iconoMalvado,
    preparacion: !!p.preparacion,
    nombre: elegir(p.id, p.nombre, nombres, 'nombre') ?? { texto: p.id, lang: IDIOMA_ORIGINAL.codigo },
    habilidad: elegir(p.id, p.habilidad, descripciones, 'habilidad') ?? { texto: '', lang: IDIOMA_ORIGINAL.codigo },
    primeraNoche: elegir(p.id, p.recordatorioPrimeraNoche, descripciones, 'recordatorioPrimeraNoche'),
    otrasNoches: elegir(p.id, p.recordatorioOtrasNoches, descripciones, 'recordatorioOtrasNoches'),
    // Los recordatorios son rótulos, como los nombres: en su idioma
    recordatorios: recordatoriosEn(p, nombres),
  }));
}

/** Nombre de un idioma para las listas: «Castelgard (español)»; English es el original. */
export function etiquetaIdioma(idioma: Idioma): string {
  if (idioma.id === IDIOMA_ORIGINAL.id) return 'English (original)';
  let lengua = '';
  try {
    lengua = new Intl.DisplayNames(['es'], { type: 'language' }).of(idioma.codigo) ?? '';
  } catch {
    // Código que el navegador no conoce: solo el nombre.
  }
  return lengua && lengua.toLocaleLowerCase('es') !== idioma.nombre.toLocaleLowerCase('es')
    ? `${idioma.nombre} (${lengua})`
    : idioma.nombre;
}

const API_URL: string = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';
let predeterminadosCache: Promise<GuionPredeterminado[]> | null = null;

/** Los guiones por defecto (se piden una vez por página). */
export function usePredeterminados(): GuionPredeterminado[] | null {
  const [lista, setLista] = useState<GuionPredeterminado[] | null>(null);
  useEffect(() => {
    predeterminadosCache ??= fetch(`${API_URL}/guiones/predeterminados`)
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => {
        predeterminadosCache = null; // se reintentará la próxima vez
        return [];
      });
    let vigente = true;
    predeterminadosCache.then((l) => vigente && setLista(l));
    return () => {
      vigente = false;
    };
  }, []);
  return lista;
}

let idiomasCache: Promise<Idioma[]> | null = null;

/** Los idiomas disponibles (se piden una vez por página); mientras, o si fallan, solo el original. */
export function useIdiomas(): Idioma[] {
  const [lista, setLista] = useState<Idioma[]>([IDIOMA_ORIGINAL]);
  useEffect(() => {
    idiomasCache ??= fetch(`${API_URL}/idiomas`)
      .then((r) => (r.ok ? (r.json() as Promise<Idioma[]>) : Promise.reject(new Error(String(r.status)))))
      .catch(() => {
        idiomasCache = null; // se reintentará la próxima vez
        return [IDIOMA_ORIGINAL];
      });
    let vigente = true;
    idiomasCache.then((l) => vigente && setLista(l));
    return () => {
      vigente = false;
    };
  }, []);
  return lista;
}

/** Traducciones ya cargadas y peticiones en curso, por idioma y género (una vez por página cada una). */
const traduccionesCargadas = new Map<string, TraduccionesDeIdioma>();
const traduccionesPedidas = new Map<string, Promise<void>>();
const claveTraducciones = (id: string, genero: Genero) => `${id}:${genero}`;

function pedirTraducciones(id: string, genero: Genero): Promise<void> {
  const clave = claveTraducciones(id, genero);
  let peticion = traduccionesPedidas.get(clave);
  if (!peticion) {
    peticion = fetch(`${API_URL}/idiomas/${encodeURIComponent(id)}/traducciones?genero=${genero}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { idioma: Idioma; traducciones: TraduccionPersonaje[] }) => {
        traduccionesCargadas.set(clave, {
          idioma: d.idioma,
          porPersonaje: new Map(d.traducciones.map((t) => [t.personajeId, t])),
        });
      })
      .catch(() => {
        traduccionesPedidas.delete(clave); // se reintentará la próxima vez
      });
    traduccionesPedidas.set(clave, peticion);
  }
  return peticion;
}

/**
 * Las traducciones de un idioma (en ese género, si los distingue); null para
 * el original, mientras se cargan o si no existe.
 */
export function useTraducciones(id: string, genero: Genero): TraduccionesDeIdioma | null {
  const [, setCargadas] = useState(0);
  const clave = claveTraducciones(id, genero);
  useEffect(() => {
    if (id === IDIOMA_ORIGINAL.id || traduccionesCargadas.has(clave)) return;
    let vigente = true;
    pedirTraducciones(id, genero).then(() => vigente && setCargadas((n) => n + 1));
    return () => {
      vigente = false;
    };
  }, [id, genero, clave]);
  return traduccionesCargadas.get(clave) ?? null;
}
