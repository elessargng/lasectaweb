import { LibraryAccessLevel } from '../types/library';

/**
 * Cualquier elemento de La Biblioteca (sección, documento o enlace) sobre el que
 * se puede evaluar el control de acceso.
 */
export interface AccessControlled {
  accessLevel?: LibraryAccessLevel;
  allowedRoles?: string[];
}

export interface AccessContext {
  isAuthenticated: boolean;
  isAdmin: boolean;
  roles: string[];
}

/**
 * Regla única de visibilidad para La Biblioteca. Los administradores siempre ven
 * todo; el resto depende del nivel de acceso del elemento.
 */
export function canAccess(target: AccessControlled, ctx: AccessContext): boolean {
  if (ctx.isAdmin) return true;

  const accessLevel = target.accessLevel || 'all';

  if (accessLevel === 'all') return true;

  if (accessLevel === 'registered') return ctx.isAuthenticated;

  if (accessLevel === 'roles') {
    if (!ctx.isAuthenticated) return false;
    const allowed = target.allowedRoles || [];
    return allowed.length === 0 || allowed.some(role => ctx.roles.includes(role));
  }

  return false;
}

/**
 * Normaliza los roles recibidos por la API: llegan como array (JSON) o como
 * cadena (multipart/form-data), y solo tienen sentido con accessLevel 'roles'.
 */
export function parseAllowedRoles(raw: unknown): string[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (Array.isArray(raw)) return raw.map(r => String(r).trim()).filter(Boolean);

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(r => String(r).trim()).filter(Boolean);
    } catch {
      // No era JSON: interpretarlo como lista separada por comas
    }
    return raw.split(',').map(r => r.trim()).filter(Boolean);
  }

  return undefined;
}
