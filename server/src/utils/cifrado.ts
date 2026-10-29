import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * Cifrado de secretos guardados en la base de datos (las keys de los modelos que
 * engancha cada usuario): AES-256-GCM con la clave de `JARVIS_CIFRADO_KEY`. Sin
 * ella no se guarda ninguno. Lo cifrado va como `iv.etiqueta.datos` en base64.
 */

const clave = (): Buffer | null => {
  const texto = process.env.JARVIS_CIFRADO_KEY;
  // Cualquier texto vale: su huella SHA-256 da los 32 bytes de la clave
  return texto ? createHash('sha256').update(texto).digest() : null;
};

export const cifradoDisponible = (): boolean => clave() !== null;

export function cifrar(texto: string): string {
  const k = clave();
  if (!k) throw new Error('Falta JARVIS_CIFRADO_KEY para guardar secretos.');
  const iv = randomBytes(12);
  const cifrador = createCipheriv('aes-256-gcm', k, iv);
  const datos = Buffer.concat([cifrador.update(texto, 'utf8'), cifrador.final()]);
  return [iv, cifrador.getAuthTag(), datos].map((b) => b.toString('base64')).join('.');
}

/** Lo descifrado, o null si no se puede (otra clave, o datos rotos). */
export function descifrar(cifrado: string): string | null {
  const k = clave();
  const [iv, etiqueta, datos] = cifrado.split('.').map((p) => Buffer.from(p, 'base64'));
  if (!k || !iv || !etiqueta || !datos) return null;
  try {
    const descifrador = createDecipheriv('aes-256-gcm', k, iv);
    descifrador.setAuthTag(etiqueta);
    return Buffer.concat([descifrador.update(datos), descifrador.final()]).toString('utf8');
  } catch {
    return null;
  }
}
