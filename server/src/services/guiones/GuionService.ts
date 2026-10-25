import { DjinnRepository } from '../../repositories/DjinnRepository';
import { PersonajeGuardado, PersonajeRepository } from '../../repositories/PersonajeRepository';
import {
  GuionImportado,
  GuionPredeterminado,
  GuionResuelto,
  Personaje,
  PersonajeDeGuion,
  PersonajePropio,
  TIPOS_NPC,
} from '../../types/guiones';
import { GuionInvalidoError } from './errores';
import { leerGuionJson } from './lectorGuionJson';

/** Los guiones por defecto: las tres ediciones base, con sus aldeanos, forasteros, esbirros y demonios. */
const PREDETERMINADOS: GuionPredeterminado[] = [
  { id: 'troublebrewing', nombre: 'Trouble Brewing', autor: 'Steven Medway' },
  { id: 'badmoonrising', nombre: 'Bad Moon Rising', autor: 'Steven Medway' },
  { id: 'sectsviolets', nombre: 'Sects & Violets', autor: 'Steven Medway' },
];
const TIPOS_BASE = ['townsfolk', 'outsider', 'minion', 'demon'] as const;

/**
 * Todo lo de los guiones: el catálogo de personajes, los guiones por defecto,
 * importar un guion (JSON) y resolverlo a sus personajes y su orden de noche.
 * Lee el catálogo y las reglas del Djinn de la copia local, nunca de fuera.
 */
export class GuionService {
  constructor(
    private personajes: PersonajeRepository,
    private djinn: DjinnRepository,
  ) {}

  async catalogo(): Promise<Personaje[]> {
    return (await this.personajes.listar()).map(sinDatosDeSincronizacion);
  }

  predeterminados(): GuionPredeterminado[] {
    return PREDETERMINADOS.map((g) => ({ ...g }));
  }

  /** Uno de los guiones por defecto, ya resuelto. */
  async guionPredeterminado(id: string): Promise<GuionResuelto> {
    const guion = PREDETERMINADOS.find((g) => g.id === id);
    if (!guion) throw new GuionInvalidoError('Ese guion no existe.');
    const personajes = await this.personajes.listarPorEdicion(guion.id, TIPOS_BASE);
    if (personajes.length === 0) throw new GuionInvalidoError('Todavía no se han cargado los personajes. Prueba en un rato.');
    return this.resolver(
      { nombre: guion.nombre, autor: guion.autor, entradas: personajes.map((p) => p.id), bootlegger: [], fondo: null },
      guion.id,
    );
  }

  /** Un guion importado de un JSON (formato del editor de guiones de BotC), ya resuelto. */
  async importar(contenido: unknown, nombreArchivo?: string): Promise<GuionResuelto> {
    const nombre = typeof nombreArchivo === 'string' ? nombreArchivo.replace(/\.json$/i, '') : undefined;
    return this.resolver(leerGuionJson(contenido, nombre));
  }

  /** Los personajes del guion con sus datos (catálogo o propios) y el orden de cada noche. */
  private async resolver(guion: GuionImportado, edicion: string | null = null): Promise<GuionResuelto> {
    const ids = guion.entradas.filter((e): e is string => typeof e === 'string');
    const delCatalogo = new Map((await this.personajes.buscarPorIds(ids)).map((p) => [p.id, p]));
    const conOrden = guion.entradas.map((e) =>
      typeof e === 'string' ? deCatalogo(e, delCatalogo.get(e)) : propio(e),
    );
    const noche = (cual: 'primera' | 'otras') =>
      conOrden
        .filter((p) => p.orden[cual] !== null)
        .sort((a, b) => a.orden[cual]! - b.orden[cual]!)
        .map((p) => p.personaje.id);
    const personajes = conOrden.map((p) => p.personaje);
    // Los legendarios y lóricos del catálogo que no trae el guion (por tipo y nombre)
    const enGuion = new Set(personajes.map((p) => p.id));
    const catalogo = (await this.personajes.listar()).filter((p) => !enGuion.has(p.id));
    const npcs = catalogo
      .filter((p) => TIPOS_NPC.includes(p.tipo))
      .sort((a, b) => TIPOS_NPC.indexOf(a.tipo) - TIPOS_NPC.indexOf(b.tipo) || a.nombre.localeCompare(b.nombre))
      .map((p) => deCatalogo(p.id, p).personaje);
    // Y los viajeros que no trae (por nombre)
    const viajeros = catalogo
      .filter((p) => p.tipo === 'traveller')
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((p) => deCatalogo(p.id, p).personaje);
    return {
      nombre: guion.nombre,
      autor: guion.autor,
      edicion,
      personajes,
      primeraNoche: noche('primera'),
      otrasNoches: noche('otras'),
      npcs,
      viajeros,
      bootlegger: guion.bootlegger,
      fondo: guion.fondo,
      // Las del Djinn: las de los pares de personajes que trae el guion
      djinn: await this.djinn.entrePersonajes([...enGuion]),
    };
  }
}

type ConOrden = { personaje: PersonajeDeGuion; orden: { primera: number | null; otras: number | null } };

function sinDatosDeSincronizacion(p: PersonajeGuardado): Personaje {
  const { iconoOrigen: _, iconoBuenoOrigen: __, iconoMalvadoOrigen: ___, sincronizadoEn: ____, ...personaje } = p;
  return personaje;
}

/** El catálogo guarda los recordatorios separados por comas («Townsfolk,Wrong»). */
export const listaRecordatorios = (texto: string | null): string[] =>
  (texto ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

function deCatalogo(id: string, p: Personaje | undefined): ConOrden {
  if (!p) {
    return {
      personaje: {
        id,
        nombre: id,
        tipo: 'desconocido',
        habilidad: 'No se ha encontrado este personaje.',
        icono: null,
        iconoBueno: null,
        iconoMalvado: null,
        recordatorioPrimeraNoche: null,
        recordatorioOtrasNoches: null,
        recordatorios: [],
        preparacion: false,
        conocido: false,
      },
      orden: { primera: null, otras: null },
    };
  }
  return {
    personaje: {
      id: p.id,
      nombre: p.nombre,
      tipo: p.tipo,
      habilidad: p.habilidad,
      icono: p.icono,
      iconoBueno: p.iconoBueno,
      iconoMalvado: p.iconoMalvado,
      recordatorioPrimeraNoche: p.primeraNoche.recordatorio,
      recordatorioOtrasNoches: p.otrasNoches.recordatorio,
      recordatorios: [...listaRecordatorios(p.recordatorios), ...listaRecordatorios(p.recordatoriosGlobales)],
      preparacion: p.preparacion,
      conocido: true,
    },
    orden: { primera: p.primeraNoche.orden, otras: p.otrasNoches.orden },
  };
}

function propio(p: PersonajePropio): ConOrden {
  return {
    personaje: {
      id: p.id,
      nombre: p.nombre,
      tipo: p.tipo,
      habilidad: p.habilidad,
      icono: p.icono,
      iconoBueno: p.iconoBueno,
      iconoMalvado: p.iconoMalvado,
      recordatorioPrimeraNoche: p.primeraNoche.recordatorio,
      recordatorioOtrasNoches: p.otrasNoches.recordatorio,
      recordatorios: p.recordatorios,
      preparacion: p.preparacion,
      conocido: true,
    },
    orden: { primera: p.primeraNoche.orden, otras: p.otrasNoches.orden },
  };
}
