import { DatabaseRepository } from './DatabaseRepository';
import { Personaje, TipoPersonaje } from '../types/guiones';

/** Lo que se guarda de un personaje además del modelo: de dónde salieron sus iconos y cuándo. */
export interface PersonajeGuardado extends Personaje {
  iconoOrigen: string | null;
  iconoBuenoOrigen: string | null;
  iconoMalvadoOrigen: string | null;
  sincronizadoEn: string;
}

/**
 * El catálogo de personajes (tabla personajes). Solo guarda y lee: no sabe de
 * dónde vienen los datos ni cómo se sincronizan.
 */
export class PersonajeRepository {
  async listar(): Promise<PersonajeGuardado[]> {
    const db = await DatabaseRepository.getInstance();
    const filas = await db.all<any[]>('SELECT * FROM personajes ORDER BY id');
    return filas.map((f) => this.aModelo(f));
  }

  async buscarPorIds(ids: string[]): Promise<PersonajeGuardado[]> {
    if (ids.length === 0) return [];
    const db = await DatabaseRepository.getInstance();
    const marcas = ids.map(() => '?').join(', ');
    const filas = await db.all<any[]>(`SELECT * FROM personajes WHERE id IN (${marcas})`, ids);
    return filas.map((f) => this.aModelo(f));
  }

  async listarPorEdicion(edicion: string, tipos: readonly TipoPersonaje[]): Promise<PersonajeGuardado[]> {
    const db = await DatabaseRepository.getInstance();
    const marcas = tipos.map(() => '?').join(', ');
    const filas = await db.all<any[]>(
      `SELECT * FROM personajes WHERE edicion = ? AND tipo IN (${marcas}) ORDER BY id`,
      [edicion, ...tipos],
    );
    return filas.map((f) => this.aModelo(f));
  }

  /** Cuándo se sincronizó por última vez (el más reciente), o null si no hay ninguno. */
  async ultimaSincronizacion(): Promise<Date | null> {
    const db = await DatabaseRepository.getInstance();
    const fila = await db.get<{ ultima: string | null }>('SELECT MAX(sincronizadoEn) AS ultima FROM personajes');
    return fila?.ultima ? new Date(fila.ultima) : null;
  }

  /** Guarda un personaje (o lo actualiza si ya existe). */
  async guardar(p: PersonajeGuardado): Promise<void> {
    const db = await DatabaseRepository.getInstance();
    await db.run(
      `INSERT INTO personajes (id, nombre, tipo, edicion, habilidad, recordatorios, recordatoriosGlobales,
         primeraNocheOrden, primeraNocheRecordatorio, otrasNochesOrden, otrasNochesRecordatorio,
         preparacion, especial, icono, iconoOrigen, iconoBueno, iconoBuenoOrigen, iconoMalvado, iconoMalvadoOrigen,
         sincronizadoEn)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         nombre = excluded.nombre, tipo = excluded.tipo, edicion = excluded.edicion, habilidad = excluded.habilidad,
         recordatorios = excluded.recordatorios, recordatoriosGlobales = excluded.recordatoriosGlobales,
         primeraNocheOrden = excluded.primeraNocheOrden, primeraNocheRecordatorio = excluded.primeraNocheRecordatorio,
         otrasNochesOrden = excluded.otrasNochesOrden, otrasNochesRecordatorio = excluded.otrasNochesRecordatorio,
         preparacion = excluded.preparacion, especial = excluded.especial,
         icono = excluded.icono, iconoOrigen = excluded.iconoOrigen,
         iconoBueno = excluded.iconoBueno, iconoBuenoOrigen = excluded.iconoBuenoOrigen,
         iconoMalvado = excluded.iconoMalvado, iconoMalvadoOrigen = excluded.iconoMalvadoOrigen,
         sincronizadoEn = excluded.sincronizadoEn`,
      [
        p.id,
        p.nombre,
        p.tipo,
        p.edicion,
        p.habilidad,
        p.recordatorios,
        p.recordatoriosGlobales,
        p.primeraNoche.orden,
        p.primeraNoche.recordatorio,
        p.otrasNoches.orden,
        p.otrasNoches.recordatorio,
        p.preparacion ? 1 : 0,
        p.especial,
        p.icono,
        p.iconoOrigen,
        p.iconoBueno,
        p.iconoBuenoOrigen,
        p.iconoMalvado,
        p.iconoMalvadoOrigen,
        p.sincronizadoEn,
      ],
    );
  }

  private aModelo(f: any): PersonajeGuardado {
    return {
      id: f.id,
      nombre: f.nombre,
      tipo: f.tipo,
      edicion: f.edicion,
      habilidad: f.habilidad,
      recordatorios: f.recordatorios,
      recordatoriosGlobales: f.recordatoriosGlobales,
      primeraNoche: { orden: f.primeraNocheOrden, recordatorio: f.primeraNocheRecordatorio },
      otrasNoches: { orden: f.otrasNochesOrden, recordatorio: f.otrasNochesRecordatorio },
      preparacion: !!f.preparacion,
      especial: f.especial,
      icono: f.icono,
      iconoOrigen: f.iconoOrigen,
      iconoBueno: f.iconoBueno,
      iconoBuenoOrigen: f.iconoBuenoOrigen,
      iconoMalvado: f.iconoMalvado,
      iconoMalvadoOrigen: f.iconoMalvadoOrigen,
      sincronizadoEn: f.sincronizadoEn,
    };
  }
}
