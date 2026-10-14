import fs from 'fs';
import path from 'path';

/** Dónde se guardan las copias de los iconos. Se inyecta: el resto no sabe si es disco u otra cosa. */
export interface AlmacenIconos {
  /** Si ya hay un icono con ese nombre de archivo. */
  existe(archivo: string): boolean;
  /** Guarda el icono y devuelve su ruta pública. */
  guardar(archivo: string, datos: Buffer): string;
  /** La ruta pública de un icono por su nombre de archivo. */
  rutaPublica(archivo: string): string;
}

/** Iconos en una carpeta del disco, servidos con una ruta pública (/uploads/…). */
export class AlmacenIconosDisco implements AlmacenIconos {
  constructor(
    private carpeta: string,
    private rutaBase: string,
  ) {}

  existe(archivo: string): boolean {
    return fs.existsSync(path.join(this.carpeta, archivo));
  }

  guardar(archivo: string, datos: Buffer): string {
    fs.mkdirSync(this.carpeta, { recursive: true });
    fs.writeFileSync(path.join(this.carpeta, archivo), datos);
    return this.rutaPublica(archivo);
  }

  rutaPublica(archivo: string): string {
    return `${this.rutaBase}/${archivo}`;
  }
}
