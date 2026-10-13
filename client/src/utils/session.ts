/**
 * Dónde vive la sesión en el navegador.
 *
 * Con «Recordarme» el token va a localStorage y sobrevive a cerrar el navegador;
 * sin marcarlo va a sessionStorage y se pierde al cerrarlo. Todo el que necesite
 * el token lo lee de aquí, nunca de localStorage directamente.
 */
const TOKEN_KEY = 'token';
const USER_KEY = 'user';

/** Se emite cuando el servidor rechaza el token: la sesión ya no vale. */
export const SESSION_EXPIRED_EVENT = 'lasecta:session-expired';

function storages(): Storage[] {
  try {
    return [localStorage, sessionStorage];
  } catch {
    return [];
  }
}

function read(key: string): string | null {
  for (const storage of storages()) {
    try {
      const value = storage.getItem(key);
      if (value) return value;
    } catch {
      // Almacenamiento bloqueado: se sigue con el siguiente.
    }
  }
  return null;
}

export function getStoredToken(): string | null {
  return read(TOKEN_KEY);
}

export function getStoredUser(): string | null {
  return read(USER_KEY);
}

export function clearStoredSession(): void {
  for (const storage of storages()) {
    try {
      storage.removeItem(TOKEN_KEY);
      storage.removeItem(USER_KEY);
    } catch {
      // Nada que limpiar.
    }
  }
}

export function saveSession(token: string, userJson: string, remember: boolean): void {
  clearStoredSession();
  try {
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(TOKEN_KEY, token);
    storage.setItem(USER_KEY, userJson);
  } catch (e) {
    console.error('No se pudo guardar la sesión', e);
  }
}

/** Actualiza el usuario guardado en el mismo sitio donde está su token. */
export function saveStoredUser(userJson: string): void {
  for (const storage of storages()) {
    try {
      if (storage.getItem(TOKEN_KEY)) {
        storage.setItem(USER_KEY, userJson);
        return;
      }
    } catch {
      // Se prueba el siguiente.
    }
  }
}

/** Momento (ms) en que caduca el token, o null si no se puede leer. */
export function tokenExpiresAt(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const exp = JSON.parse(json).exp;
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const expiresAt = tokenExpiresAt(token);
  return expiresAt === null || expiresAt <= Date.now();
}

export function notifySessionExpired(): void {
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}
