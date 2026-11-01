/** Los formatos de imagen que se reconocen por su contenido. */
export type FormatoImagen = 'jpg' | 'png' | 'webp' | 'gif';

/** Una imagen en data URL (data:image/…;base64,…): el tipo que dice ser y sus bytes; o null si no lo es. */
export function leerDataUrl(valor: unknown): { tipo: string; datos: Buffer } | null {
  if (typeof valor !== 'string') return null;
  const partes = /^data:image\/([a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=]+)$/.exec(valor);
  return partes ? { tipo: partes[1].toLowerCase(), datos: Buffer.from(partes[2], 'base64') } : null;
}

/** El formato de una imagen por sus primeros bytes (no por lo que diga quien la manda). */
export function formatoDeImagen(datos: Buffer): FormatoImagen | null {
  if (datos.length >= 3 && datos[0] === 0xff && datos[1] === 0xd8 && datos[2] === 0xff) return 'jpg';
  if (datos.length > 8 && datos.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (datos.length > 12 && datos.toString('ascii', 0, 4) === 'RIFF' && datos.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (['GIF87a', 'GIF89a'].includes(datos.subarray(0, 6).toString('latin1'))) return 'gif';
  return null;
}

/** Qué imágenes se admiten para algo: los formatos y el tamaño máximo de cada uno, y qué se dice si no vale. */
export interface ReglaImagen {
  maximos: Partial<Record<FormatoImagen, number>>;
  noValida: string;
  demasiadoGrande: string;
}

/** Si la imagen cumple la regla: su formato, o por qué no vale. */
export function comprobarImagen(datos: Buffer, regla: ReglaImagen): { formato: FormatoImagen } | { error: string } {
  const formato = formatoDeImagen(datos);
  const maximo = formato ? regla.maximos[formato] : undefined;
  if (!formato || maximo === undefined) return { error: regla.noValida };
  if (datos.length > maximo) return { error: regla.demasiadoGrande };
  return { formato };
}
