import { notifySessionExpired } from './session';

/**
 * Helper utility to safely parse API fetch responses and handle error statuses cleanly.
 */
export async function parseApiResponse<T = any>(response: Response): Promise<T> {
  let data: any = null;
  const contentType = response.headers.get('content-type') || '';

  try {
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        // Plain text response (or HTML error page)
        data = { message: text };
      }
    }
  } catch {
    data = null;
  }

  if (!response.ok) {
    const authError = data?.error || data?.message;
    const hasAuthMessage = typeof authError === 'string' && authError !== 'Forbidden' && authError !== 'Unauthorized';

    if (response.status === 401) {
      // El servidor no acepta la sesión: se cierra también en la web, para no
      // seguir mostrándote dentro. (Un 401 sin código es un login fallido.)
      if (data?.code === 'SESSION_EXPIRED' || data?.code === 'NO_SESSION') {
        notifySessionExpired();
      }
      throw new Error(hasAuthMessage ? authError : 'Necesitas iniciar sesión para hacer esto.');
    }

    if (response.status === 403) {
      throw new Error(hasAuthMessage ? authError : 'No tienes permisos para realizar esta acción.');
    }

    const errorMessage = data?.error || data?.message || `Error en el servidor (${response.status})`;
    throw new Error(typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage));
  }

  return data as T;
}

/**
 * Helper to get the correct URL for avatar images.
 * Handles server-side uploads (/uploads/...), default frontend assets (/avatars/...), and base64.
 */
export function getAvatarUrl(avatarPath?: string | null): string {
  if (!avatarPath) return '/avatar.png';
  if (avatarPath.startsWith('/uploads/')) {
    const rawApiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';
    const serverBase = rawApiUrl.replace(/\/api\/?$/, '');
    return `${serverBase}${avatarPath}`;
  }
  return avatarPath;
}
