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
