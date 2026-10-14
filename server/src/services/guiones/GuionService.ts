import { PersonajeGuardado, PersonajeRepository } from '../../repositories/PersonajeRepository';
import {
  GuionImportado,
  GuionPredeterminado,
  GuionResuelto,
  Personaje,
  PersonajeDeGuion,
  PersonajePropio,
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
 * Lee el catálogo de la copia local (PersonajeRepository), nunca de fuera.
 */
export class GuionService {
  constructor(private personajes: PersonajeRepository) {}

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
      { nombre: guion.nombre, autor: guion.autor, entradas: personajes.map((p) => p.id) },
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
    return {
      nombre: guion.nombre,
      autor: guion.autor,
      edicion,
      personajes: conOrden.map((p) => p.personaje),
      primeraNoche: noche('primera'),
      otrasNoches: noche('otras'),
    };
  }
}

type ConOrden = { personaje: PersonajeDeGuion; orden: { primera: number | null; otras: number | null } };

function sinDatosDeSincronizacion(p: PersonajeGuardado): Personaje {
  const { iconoOrigen: _, iconoBuenoOrigen: __, iconoMalvadoOrigen: ___, sincronizadoEn: ____, ...personaje } = p;
  return personaje;
}

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
      iconoBueno: null,
      iconoMalvado: null,
      recordatorioPrimeraNoche: p.primeraNoche.recordatorio,
      recordatorioOtrasNoches: p.otrasNoches.recordatorio,
      preparacion: p.preparacion,
      conocido: true,
    },
    orden: { primera: p.primeraNoche.orden, otras: p.otrasNoches.orden },
  };
}
