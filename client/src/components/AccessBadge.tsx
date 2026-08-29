import { Lock, Shield } from 'lucide-react';
import type { LibraryAccessLevel } from '../utils/libraryApi';

interface AccessBadgeProps {
  accessLevel?: LibraryAccessLevel;
  allowedRoles?: string[];
  /** Nombre del tipo de elemento, usado en el tooltip (ej: "carpeta") */
  subject?: string;
}

/**
 * Distintivo de restricción de acceso para elementos de La Biblioteca.
 * No renderiza nada cuando el elemento es público.
 */
export default function AccessBadge({ accessLevel, allowedRoles, subject }: AccessBadgeProps) {
  const suffix = subject ? ` Esta ${subject} y todo su contenido quedan ocultos para el resto.` : '';

  if (accessLevel === 'registered') {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30"
        title={`Restringido: Solo usuarios registrados.${suffix}`}
      >
        <Lock className="w-3 h-3" />
        <span>Registrados</span>
      </span>
    );
  }

  if (accessLevel === 'roles') {
    const roles = allowedRoles || [];
    return (
      <span
        className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30"
        title={`Restringido: Solo roles ${roles.join(', ')}.${suffix}`}
      >
        <Shield className="w-3 h-3" />
        <span>{roles.join(', ') || 'Sin roles'}</span>
      </span>
    );
  }

  return null;
}
