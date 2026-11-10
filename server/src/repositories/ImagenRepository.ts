import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

/**
 * Dónde se guardan las imágenes que se suben (avatares, fondos…), por colecciones
 * («sala», «sala/fondos»…). Se inyecta: el resto no sabe si es disco u otra cosa.
 */
export interface ImagenRepository {
  /** Guarda la imagen con un nombre nuevo y devuelve su ruta pública. */
  guardar(coleccion: string, extension: string, datos: Buffer): string;
  /** Si la ruta pública es la de una imagen guardada aquí, en esa colección. */
  existe(coleccion: string, ruta: string): boolean;
  /** Borra la imagen de esa ruta pública, si es de esa colección (si no, nada). */
  borrar(coleccion: string, ruta: string): void;
}

/** El nombre que se le da a cada imagen guardada: un UUID con su extensión. */
const NOMBRE = /^[0-9a-f-]{36}\.[a-z0-9]+$/;

/** El nombre de archivo de una ruta pública de esa colección, o null si no es de ella. */
function nombreEn(rutaBase: string, coleccion: string, ruta: string): string | null {
  const prefijo = `${rutaBase}/${coleccion}/`;
  if (!ruta.startsWith(prefijo)) return null;
  const nombre = ruta.slice(prefijo.length);
  return NOMBRE.test(nombre) ? nombre : null;
}

/** Imágenes en una carpeta del disco (UPLOAD_DIR), servidas con una ruta pública (/uploads/…). */
export class ImagenDiscoRepository implements ImagenRepository {
  constructor(
    private readonly carpeta: string,
    private readonly rutaBase: string,
  ) {}

  guardar(coleccion: string, extension: string, datos: Buffer): string {
    const destino = path.join(this.carpeta, coleccion);
    fs.mkdirSync(destino, { recursive: true });
    const nombre = `${randomUUID()}.${extension}`;
    fs.writeFileSync(path.join(destino, nombre), datos);
    return `${this.rutaBase}/${coleccion}/${nombre}`;
  }

  existe(coleccion: string, ruta: string): boolean {
    const nombre = nombreEn(this.rutaBase, coleccion, ruta);
    return !!nombre && fs.existsSync(path.join(this.carpeta, coleccion, nombre));
  }

  borrar(coleccion: string, ruta: string): void {
    const nombre = nombreEn(this.rutaBase, coleccion, ruta);
    if (nombre) fs.rmSync(path.join(this.carpeta, coleccion, nombre), { force: true });
  }
}

/** Imágenes en memoria (para los tests): solo se apunta su ruta. */
export class MemoriaImagenRepository implements ImagenRepository {
  private readonly guardadas = new Set<string>();

  constructor(private readonly rutaBase = '/uploads') {}

  guardar(coleccion: string, extension: string): string {
    const ruta = `${this.rutaBase}/${coleccion}/${randomUUID()}.${extension}`;
    this.guardadas.add(ruta);
    return ruta;
  }

  existe(coleccion: string, ruta: string): boolean {
    return nombreEn(this.rutaBase, coleccion, ruta) !== null && this.guardadas.has(ruta);
  }

  borrar(coleccion: string, ruta: string): void {
    if (nombreEn(this.rutaBase, coleccion, ruta) !== null) this.guardadas.delete(ruta);
  }
}
