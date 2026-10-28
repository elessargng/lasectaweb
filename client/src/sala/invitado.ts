/**
 * Quien entra en la sala sin cuenta lo hace con un nombre. Ese nombre vale
 * mientras dure la pestaña (sessionStorage); además se recuerda el último
 * usado (localStorage) para proponerlo la próxima vez.
 *
 * También aquí el perfil: el nombre y el avatar que cada uno prefiere mostrar en la sala.
 */
const ACTUAL_KEY = 'sala:invitado';
const ULTIMO_KEY = 'sala:ultimoNombre';
/** Lo que cada uno elige mostrar en la sala (nombre, avatar), por cuenta o por pestaña. */
type CampoPerfil = 'alias' | 'avatar';
const perfilInvitadoKey = (campo: CampoPerfil) => `sala:${campo}Invitado`;
const perfilCuentaKey = (campo: CampoPerfil, cuentaId: string) => `sala:${campo}:${cuentaId}`;

export const NOMBRE_MAX = 24;

function leer(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

function escribir(storage: () => Storage, key: string, value: string | null): void {
  try {
    if (value === null) storage().removeItem(key);
    else storage().setItem(key, value);
  } catch {
    // Almacenamiento bloqueado: el nombre dura solo mientras la página esté abierta.
  }
}

export function getInvitado(): string | null {
  return leer(() => sessionStorage, ACTUAL_KEY);
}

export function getUltimoNombre(): string {
  return leer(() => localStorage, ULTIMO_KEY) ?? '';
}

export function setInvitado(nombre: string): void {
  escribir(() => sessionStorage, ACTUAL_KEY, nombre);
  escribir(() => localStorage, ULTIMO_KEY, nombre);
}

export function clearInvitado(): void {
  escribir(() => sessionStorage, ACTUAL_KEY, null);
  escribir(() => sessionStorage, perfilInvitadoKey('alias'), null);
}

/**
 * Lo que alguien prefiere mostrar en la sala: `alias` (nombre en lugar del suyo)
 * o `avatar` (uno de los predefinidos o una imagen subida). Con cuenta se
 * recuerda en este navegador (`cuentaId`; el avatar, además, en la cuenta). Como
 * invitado, el nombre dura lo que la pestaña y el avatar se recuerda en el
 * navegador para la próxima vez. Vacío: lo de siempre.
 */
export function getPerfil(campo: CampoPerfil, cuentaId: string | null): string {
  const valor = cuentaId
    ? leer(() => localStorage, perfilCuentaKey(campo, cuentaId))
    : leer(almacenInvitado(campo), perfilInvitadoKey(campo));
  return valor ?? '';
}

export function setPerfil(campo: CampoPerfil, cuentaId: string | null, valor: string): void {
  if (cuentaId) escribir(() => localStorage, perfilCuentaKey(campo, cuentaId), valor || null);
  else escribir(almacenInvitado(campo), perfilInvitadoKey(campo), valor || null);
}

const almacenInvitado = (campo: CampoPerfil) => (campo === 'avatar' ? () => localStorage : () => sessionStorage);

/** Quita espacios de sobra; devuelve cadena vacía si no queda nombre. */
export function limpiarNombre(nombre: string): string {
  return nombre.replace(/\s+/g, ' ').trim().slice(0, NOMBRE_MAX);
}
