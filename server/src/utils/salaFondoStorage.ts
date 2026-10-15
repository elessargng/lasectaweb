import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Los fondos de la sala de juego: imágenes que sube el narrador (o que elige de
 * la Biblioteca y se copian aquí), en UPLOAD_DIR/sala/fondos, servidas por /uploads.
 */
const RUTA_PUBLICA = /^\/uploads\/sala\/fondos\/[0-9a-f-]{36}\.(jpg|png|webp)$/;
export const SALA_FONDO_MAX_BYTES = 6 * 1024 * 1024;

function carpeta(): string {
  const base = process.env.UPLOAD_DIR || './uploads';
  const raiz = path.isAbsolute(base) ? base : path.resolve(process.cwd(), base);
  return path.join(raiz, 'sala', 'fondos');
}

/** Si es la ruta de un fondo guardado (y sigue en el disco). */
export function esFondoSalaGuardado(ruta: unknown): ruta is string {
  return typeof ruta === 'string' && RUTA_PUBLICA.test(ruta) && fs.existsSync(path.join(carpeta(), path.basename(ruta)));
}

/** El tipo de imagen por sus primeros bytes (no por lo que diga quien la manda). */
function tipoDeImagen(datos: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (datos.length > 3 && datos[0] === 0xff && datos[1] === 0xd8 && datos[2] === 0xff) return 'jpg';
  if (datos.length > 8 && datos.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (datos.length > 12 && datos.toString('ascii', 0, 4) === 'RIFF' && datos.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

/** Guarda una imagen como fondo (JPEG, PNG o WebP; hasta 6 MB). Devuelve su ruta pública. */
export function guardarFondoSala(datos: Buffer): { ruta: string } | { error: string } {
  const tipo = tipoDeImagen(datos);
  if (!tipo) return { error: 'La imagen no es válida (JPEG, PNG o WebP).' };
  if (datos.length > SALA_FONDO_MAX_BYTES) return { error: 'La imagen es demasiado grande (máximo 6 MB).' };
  fs.mkdirSync(carpeta(), { recursive: true });
  const nombre = `${randomUUID()}.${tipo}`;
  fs.writeFileSync(path.join(carpeta(), nombre), datos);
  return { ruta: `/uploads/sala/fondos/${nombre}` };
}

/** Los bytes de una imagen en data URL (data:image/…;base64,…), o null si no lo es. */
export function datosDeDataUrl(valor: unknown): Buffer | null {
  if (typeof valor !== 'string') return null;
  const partes = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(valor);
  return partes ? Buffer.from(partes[2], 'base64') : null;
}
