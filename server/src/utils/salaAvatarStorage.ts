import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

/**
 * Avatares personalizados de la sala: imágenes que sube cada participante solo
 * para la sala (no tocan su perfil de la web). Se guardan como archivo en
 * <UPLOAD_DIR>/sala y se sirven por /uploads/sala/…, como el resto de subidas.
 */
const SUBCARPETA = 'sala';
const RUTA_PUBLICA = /^\/uploads\/sala\/[0-9a-f-]{36}\.jpg$/;

/** Tamaño máximo de la imagen ya decodificada. El cliente la reduce antes (256 px, JPEG). */
export const SALA_AVATAR_MAX_BYTES = 200 * 1024;

function carpeta(): string {
  const ajuste = process.env.UPLOAD_DIR || './uploads';
  const base = path.isAbsolute(ajuste) ? ajuste : path.resolve(process.cwd(), ajuste);
  return path.join(base, SUBCARPETA);
}

/** Si la ruta es la de un avatar de sala guardado aquí (y existe). */
export function esAvatarSalaGuardado(ruta: string): boolean {
  return RUTA_PUBLICA.test(ruta) && fs.existsSync(path.join(carpeta(), path.basename(ruta)));
}

/**
 * Guarda una imagen JPEG en base64 (data URL) y devuelve su ruta pública, o un
 * error si no es válida.
 */
export function guardarAvatarSala(dataUrl: unknown): { ruta: string } | { error: string } {
  const partes = typeof dataUrl === 'string' ? dataUrl.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/) : null;
  if (!partes) return { error: 'La imagen no es válida.' };
  const datos = Buffer.from(partes[1], 'base64');
  // Cabecera JPEG (FF D8 FF): que el contenido sea de verdad una imagen
  if (datos.length < 3 || datos[0] !== 0xff || datos[1] !== 0xd8 || datos[2] !== 0xff) {
    return { error: 'La imagen no es válida.' };
  }
  if (datos.length > SALA_AVATAR_MAX_BYTES) return { error: 'La imagen es demasiado grande.' };

  fs.mkdirSync(carpeta(), { recursive: true });
  const nombre = `${randomUUID()}.jpg`;
  fs.writeFileSync(path.join(carpeta(), nombre), datos);
  return { ruta: `/uploads/${SUBCARPETA}/${nombre}` };
}
