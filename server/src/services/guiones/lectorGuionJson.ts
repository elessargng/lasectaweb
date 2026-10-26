import { normalizarIdPersonaje } from '../personajes/idPersonaje';
import { GuionInvalidoError } from './errores';
import { Despertar, GuionImportado, PersonajePropio, TIPOS_PERSONAJE, TipoPersonaje } from '../../types/guiones';


const MAX_TEXTO = 300 * 1024;
const MAX_ENTRADAS = 300;

const texto = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max ? v.trim() : null;
const orden = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 10000 ? v : null);
const despertar = (o: unknown, r: unknown): Despertar => ({ orden: orden(o), recordatorio: texto(r, 600) });
/** Una lista de textos cortos (los recordatorios): lo que no sea texto se ignora. */
const textos = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => texto(x, 60)).filter((x): x is string => !!x).slice(0, 20) : [];

/**
 * Una dirección de imagen que viene de fuera: solo https y sin lo que rompería
 * el CSS donde se pone (comillas, paréntesis, espacios); si no, null.
 */
const imagenHttps = (v: unknown): string | null => {
  const url = texto(v, 400);
  return url && /^https:\/\/[^\s"'()\\<>]+$/.test(url) ? url : null;
};

/**
 * Los iconos de un personaje propio según «image» (una dirección o una lista): con
 * lista, la primera es la de su alineamiento de siempre y la segunda la del otro;
 * en los viajeros, la primera es la neutral, la segunda la buena y la tercera la
 * malvada (como en el editor de guiones de Blood on the Clocktower).
 */
function iconos(image: unknown, tipo: TipoPersonaje): Pick<PersonajePropio, 'icono' | 'iconoBueno' | 'iconoMalvado'> {
  const lista = (Array.isArray(image) ? image : [image]).slice(0, 3).map(imagenHttps);
  const [primera = null, segunda = null, tercera = null] = lista;
  if (tipo === 'traveller') return { icono: primera, iconoBueno: segunda, iconoMalvado: tercera };
  if (tipo === 'minion' || tipo === 'demon') return { icono: primera, iconoBueno: segunda, iconoMalvado: null };
  if (tipo === 'townsfolk' || tipo === 'outsider') return { icono: primera, iconoBueno: null, iconoMalvado: segunda };
  return { icono: primera, iconoBueno: null, iconoMalvado: null };
}

/** Un personaje propio del guion (con nombre, equipo y habilidad), o null si le falta algo. */
function personajePropio(e: Record<string, unknown>): PersonajePropio | null {
  const nombre = texto(e.name, 60);
  const habilidad = texto(e.ability, 600);
  const tipo = typeof e.team === 'string' && TIPOS_PERSONAJE.includes(e.team as TipoPersonaje) ? (e.team as TipoPersonaje) : null;
  const id = typeof e.id === 'string' ? normalizarIdPersonaje(e.id).slice(0, 60) : '';
  if (!id || !nombre || !habilidad || !tipo) return null;
  return {
    id,
    nombre,
    tipo,
    habilidad,
    // Solo imágenes https: el JSON viene de fuera
    ...iconos(e.image, tipo),
    primeraNoche: despertar(e.firstNight, e.firstNightReminder),
    otrasNoches: despertar(e.otherNight, e.otherNightReminder),
    preparacion: e.setup === true,
    recordatorios: [...textos(e.reminders), ...textos(e.remindersGlobal)],
  };
}

/**
 * Lee un guion en el formato del editor de guiones de Blood on the Clocktower:
 * una lista con un primer elemento {"id": "_meta", "name", "author"} y los
 * personajes, como texto ("washerwoman") o como objeto ({"id": "washerwoman"}).
 * Un objeto con nombre, equipo y habilidad es un personaje propio del guion.
 *
 * Solo interpreta y valida el formato; no consulta el catálogo.
 */
export function leerGuionJson(contenido: unknown, nombrePorDefecto = 'Guion'): GuionImportado {
  if (typeof contenido !== 'string' || contenido.length === 0) throw new GuionInvalidoError('El guion está vacío.');
  if (contenido.length > MAX_TEXTO) throw new GuionInvalidoError('El archivo del guion es demasiado grande.');
  let datos: unknown;
  try {
    datos = JSON.parse(contenido);
  } catch {
    throw new GuionInvalidoError('El archivo no es un JSON válido.');
  }
  if (!Array.isArray(datos)) throw new GuionInvalidoError('El guion tiene que ser una lista de personajes.');

  let nombre = texto(nombrePorDefecto, 100) ?? 'Guion';
  let autor: string | null = null;
  let bootlegger: string[] = [];
  let fondo: string | null = null;
  const entradas: GuionImportado['entradas'] = [];
  for (const elemento of datos) {
    if (typeof elemento === 'string') {
      const id = normalizarIdPersonaje(elemento);
      if (id) entradas.push(id);
      continue;
    }
    const e = elemento as Record<string, unknown>;
    if (!e || typeof e.id !== 'string') continue;
    if (e.id === '_meta') {
      nombre = texto(e.name, 100) ?? nombre;
      autor = texto(e.author, 100);
      // Las reglas del Bootlegger: una lista de textos (o uno solo)
      const reglas = Array.isArray(e.bootlegger) ? e.bootlegger : [e.bootlegger];
      bootlegger = reglas.map((r) => texto(r, 600)).filter((r): r is string => !!r).slice(0, 20);
      fondo = imagenHttps(e.background);
      continue;
    }
    if (e.name !== undefined || e.ability !== undefined) {
      const propio = personajePropio(e);
      if (!propio) throw new GuionInvalidoError(`El personaje propio «${String(e.id).slice(0, 30)}» está incompleto.`);
      entradas.push(propio);
    } else {
      const id = normalizarIdPersonaje(e.id);
      if (id) entradas.push(id);
    }
  }
  if (entradas.length === 0) throw new GuionInvalidoError('El guion no tiene personajes.');
  if (entradas.length > MAX_ENTRADAS) throw new GuionInvalidoError(`Un guion no puede tener más de ${MAX_ENTRADAS} personajes.`);
  return { nombre, autor, entradas, bootlegger, fondo };
}
