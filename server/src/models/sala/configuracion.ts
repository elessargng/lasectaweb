/**
 * La configuración de la sala que cada usuario guarda en su cuenta (la actual y
 * sus perfiles con nombre): qué se guarda y cuánto.
 */

/** Tope de lo que ocupa una configuración (preferencias, avisos y atajos caben de sobra). */
export const CONFIGURACION_MAX_BYTES = 16 * 1024;
export const MAX_PERFILES = 20;
export const NOMBRE_PERFIL_MAX = 40;
/** Las comunicaciones (cámara y micrófono) no se guardan nunca. */
const CLAVES_EXCLUIDAS = ['idCamara', 'idMicrofono'];
/** El avatar de la sala va en la configuración actual (se recuerda al volver), no en los perfiles. */
const CLAVES_EXCLUIDAS_PERFIL = [...CLAVES_EXCLUIDAS, 'avatar'];

/**
 * Los datos como JSON listos para guardar (sin lo que no se guarda), o un error si
 * no valen. Para un perfil (`perfil`), tampoco el avatar.
 */
export function prepararConfiguracion(datos: unknown, { perfil = false } = {}): { json: string } | { error: string } {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return { error: 'La configuración no es válida.' };
  const excluidas = perfil ? CLAVES_EXCLUIDAS_PERFIL : CLAVES_EXCLUIDAS;
  const limpios = JSON.parse(JSON.stringify(datos)) as Record<string, unknown>;
  for (const clave of excluidas) delete limpios[clave];
  if ('avatar' in limpios && typeof limpios.avatar !== 'string') delete limpios.avatar;
  const preferencias = limpios.preferencias as Record<string, unknown> | undefined;
  if (preferencias && typeof preferencias === 'object') {
    for (const clave of excluidas) delete preferencias[clave];
  }
  const json = JSON.stringify(limpios);
  if (Buffer.byteLength(json) > CONFIGURACION_MAX_BYTES) return { error: 'La configuración es demasiado grande.' };
  return { json };
}

/** El nombre de un perfil sin espacios de más, o un error si no vale. */
export function nombreDePerfil(nombre: unknown): { nombre: string } | { error: string } {
  const limpio = typeof nombre === 'string' ? nombre.replace(/\s+/g, ' ').trim() : '';
  if (!limpio || limpio.length > NOMBRE_PERFIL_MAX) return { error: `El nombre del perfil debe tener entre 1 y ${NOMBRE_PERFIL_MAX} caracteres.` };
  return { nombre: limpio };
}
