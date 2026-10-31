import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

/**
 * Avatares personalizados de la sala: imágenes que sube cada participante solo
 * para la sala (no tocan su perfil de la web). Se guardan como archivo en
 * <UPLOAD_DIR>/sala y se sirven por /uploads/sala/…, como el resto de subidas.
 */
const SUBCARPETA = 'sala';
const RUTA_PUBLICA = /^\/uploads\/sala\/[0-9a-f-]{36}\.(jpg|gif)$/;

/** Tamaño máximo de la imagen ya decodificada. El cliente reduce antes las fotos (256 px, JPEG). */
export const SALA_AVATAR_MAX_BYTES = 200 * 1024;
/** Los GIF animados van tal cual (reducirlos los dejaría quietos): pueden pesar más. */
export const SALA_AVATAR_GIF_MAX_BYTES = 1536 * 1024;

/** Cada formato admitido: su cabecera (que sea de verdad esa imagen), su extensión y su tope. */
const FORMATOS = {
  jpeg: { extension: 'jpg', maximo: SALA_AVATAR_MAX_BYTES, esValido: (d: Buffer) => d.length >= 3 && d[0] === 0xff && d[1] === 0xd8 && d[2] === 0xff },
  gif: {
    extension: 'gif',
    maximo: SALA_AVATAR_GIF_MAX_BYTES,
    esValido: (d: Buffer) => ['GIF87a', 'GIF89a'].includes(d.subarray(0, 6).toString('latin1')),
  },
} as const;

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
 * Guarda una imagen JPEG o GIF (animado o no) en base64 (data URL) y devuelve su
 * ruta pública, o un error si no es válida.
 */
export function guardarAvatarSala(dataUrl: unknown): { ruta: string } | { error: string } {
  const partes = typeof dataUrl === 'string' ? dataUrl.match(/^data:image\/(jpeg|gif);base64,([A-Za-z0-9+/=]+)$/) : null;
  if (!partes) return { error: 'La imagen no es válida.' };
  const formato = FORMATOS[partes[1] as keyof typeof FORMATOS];
  const datos = Buffer.from(partes[2], 'base64');
  // Que el contenido sea de verdad una imagen de ese formato
  if (!formato.esValido(datos)) return { error: 'La imagen no es válida.' };
  if (datos.length > formato.maximo) return { error: 'La imagen es demasiado grande.' };

  fs.mkdirSync(carpeta(), { recursive: true });
  const nombre = `${randomUUID()}.${formato.extension}`;
  fs.writeFileSync(path.join(carpeta(), nombre), datos);
  return { ruta: `/uploads/${SUBCARPETA}/${nombre}` };
}
