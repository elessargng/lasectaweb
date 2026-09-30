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
  roles: ('editor' | 'narrador' | 'admin')[];
  /** Quiere recibir por correo las incidencias que detecte el vigilante de La Plaza. */
  vigilanteAlerts?: boolean;
  createdAt: Date;
}
