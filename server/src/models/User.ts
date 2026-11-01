import type { ReglaImagen } from './imagenes';

/**
 * La foto de perfil que se sube: una imagen de verdad (nunca SVG, que puede llevar
 * scripts). El cliente la manda ya reducida (150 px, JPEG), así que sobra margen.
 */
export const FOTO_PERFIL: ReglaImagen = {
  maximos: { jpg: 1024 * 1024, png: 1024 * 1024, webp: 1024 * 1024, gif: 1024 * 1024 },
  noValida: 'La foto de perfil no es válida (JPEG, PNG, WebP o GIF).',
  demasiadoGrande: 'La foto de perfil es demasiado grande (máximo 1 MB).',
};

export interface User {
  id: string;
  username: string;
  realName: string;
  botcUsername: string;
  email: string;
  telegramUsername: string;
  passwordHash: string;
  profilePicture: string;
  isConfirmed: boolean;
  confirmationToken?: string;
  confirmationTokenExpires?: Date;
  /** Huella SHA-256 del token del enlace para restablecer la contraseña. */
  passwordResetTokenHash?: string;
  passwordResetExpires?: Date;
  roles: ('editor' | 'narrador' | 'admin')[];
  /** Quiere recibir por correo las incidencias que detecte el vigilante de La Plaza. */
  vigilanteAlerts?: boolean;
  /** Deja que los demás vean sus estadísticas de la sala (por defecto, privadas). */
  estadisticasPublicas?: boolean;
  createdAt: Date;
}
