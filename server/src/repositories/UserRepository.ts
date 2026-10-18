import { User } from '../models/User';
import { DatabaseRepository } from './DatabaseRepository';
import { processProfilePicture } from '../utils/imageStorage';

export class UserRepository {
  private async getUserRoles(userId: string): Promise<('editor' | 'narrador' | 'admin')[]> {
    const db = await DatabaseRepository.getInstance();
    const rows = await db.all<{ role: string }[]>('SELECT role FROM user_roles WHERE userId = ?', [userId]);
    return rows.map((r) => r.role as 'editor' | 'narrador' | 'admin');
  }

  private async mapRowToUser(row: any): Promise<User> {
    const roles = await this.getUserRoles(row.id);
    return {
      ...row,
      isConfirmed: row.isConfirmed === 1,
      vigilanteAlerts: row.vigilanteAlerts === 1,
      estadisticasPublicas: row.estadisticasPublicas === 1,
      confirmationTokenExpires: row.confirmationTokenExpires ? new Date(row.confirmationTokenExpires) : undefined,
      passwordResetTokenHash: row.passwordResetTokenHash ?? undefined,
      passwordResetExpires: row.passwordResetExpires ? new Date(row.passwordResetExpires) : undefined,
      roles,
      createdAt: new Date(row.createdAt)
    };
  }

  async findByUsername(username: string): Promise<User | undefined> {
    const db = await DatabaseRepository.getInstance();
    const cleanUsername = (username || '').trim();
    const row = await db.get<any>('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [cleanUsername]);
    if (!row) return undefined;
    return this.mapRowToUser(row);
  }


  async findById(id: string): Promise<User | undefined> {
    const db = await DatabaseRepository.getInstance();
    const row = await db.get<any>('SELECT * FROM users WHERE id = ?', [id]);
    if (!row) return undefined;
    return this.mapRowToUser(row);
  }

  async findByConfirmationToken(token: string): Promise<User | undefined> {
    const db = await DatabaseRepository.getInstance();
    const row = await db.get<any>('SELECT * FROM users WHERE confirmationToken = ?', [token]);
    if (!row) return undefined;
    return this.mapRowToUser(row);
  }

  /** Puede haber varias cuentas con el mismo correo: se devuelven todas. */
  async findAllByEmail(email: string): Promise<User[]> {
    const db = await DatabaseRepository.getInstance();
    const rows = await db.all<any[]>('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [(email || '').trim()]);
    const users: User[] = [];
    for (const row of rows) {
      users.push(await this.mapRowToUser(row));
    }
    return users;
  }

  async findByPasswordResetTokenHash(tokenHash: string): Promise<User | undefined> {
    const db = await DatabaseRepository.getInstance();
    const row = await db.get<any>('SELECT * FROM users WHERE passwordResetTokenHash = ?', [tokenHash]);
    if (!row) return undefined;
    return this.mapRowToUser(row);
  }

  async setPasswordReset(userId: string, tokenHash: string, expires: Date): Promise<void> {
    const db = await DatabaseRepository.getInstance();
    await db.run(
      'UPDATE users SET passwordResetTokenHash = ?, passwordResetExpires = ? WHERE id = ?',
      [tokenHash, expires.toISOString(), userId]
    );
  }

  /**
   * Cambia la contraseña y gasta el enlace de recuperación. Abrir el enlace
   * demuestra que el correo es suyo, así que de paso la cuenta queda confirmada.
   */
  async resetPassword(userId: string, passwordHash: string): Promise<void> {
    const db = await DatabaseRepository.getInstance();
    await db.run(
      `UPDATE users SET
         passwordHash = ?,
         passwordResetTokenHash = NULL,
         passwordResetExpires = NULL,
         isConfirmed = 1,
         confirmationToken = NULL,
         confirmationTokenExpires = NULL
       WHERE id = ?`,
      [passwordHash, userId]
    );
  }

  async listAll(): Promise<User[]> {
    const db = await DatabaseRepository.getInstance();
    const rows = await db.all<any[]>('SELECT * FROM users');
    const users: User[] = [];
    for (const row of rows) {
      users.push(await this.mapRowToUser(row));
    }
    return users;
  }

  async save(user: User): Promise<User> {
    user.profilePicture = processProfilePicture(user.profilePicture, user.id);
    const db = await DatabaseRepository.getInstance();
    await db.run(
      `INSERT INTO users (id, username, realName, botcUsername, email, telegramUsername, passwordHash, profilePicture, isConfirmed, confirmationToken, confirmationTokenExpires, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.username,
        user.realName,
        user.botcUsername,
        user.email,
        user.telegramUsername,
        user.passwordHash,
        user.profilePicture,
        user.isConfirmed ? 1 : 0,
        user.confirmationToken || null,
        user.confirmationTokenExpires ? user.confirmationTokenExpires.toISOString() : null,
        user.createdAt.toISOString()
      ]
    );

    // Guardar roles
    if (user.roles && user.roles.length > 0) {
      for (const role of user.roles) {
        await db.run('INSERT INTO user_roles (userId, role) VALUES (?, ?)', [user.id, role]);
      }
    }
    return user;
  }

  async update(user: User): Promise<User> {
    user.profilePicture = processProfilePicture(user.profilePicture, user.id);
    const db = await DatabaseRepository.getInstance();
    await db.run(
      `UPDATE users SET
         username = ?,
         realName = ?,
         botcUsername = ?,
         email = ?,
         telegramUsername = ?,
         profilePicture = ?,
         isConfirmed = ?,
         confirmationToken = ?,
         confirmationTokenExpires = ?,
         vigilanteAlerts = ?,
         estadisticasPublicas = ?
       WHERE id = ?`,
      [
        user.username,
        user.realName,
        user.botcUsername,
        user.email,
        user.telegramUsername,
        user.profilePicture,
        user.isConfirmed ? 1 : 0,
        user.confirmationToken || null,
        user.confirmationTokenExpires ? user.confirmationTokenExpires.toISOString() : null,
        user.vigilanteAlerts ? 1 : 0,
        user.estadisticasPublicas ? 1 : 0,
        user.id
      ]
    );

    // Actualizar roles (borrar existentes e insertar actuales)
    await db.run('DELETE FROM user_roles WHERE userId = ?', [user.id]);
    if (user.roles && user.roles.length > 0) {
      for (const role of user.roles) {
        await db.run('INSERT INTO user_roles (userId, role) VALUES (?, ?)', [user.id, role]);
      }
    }
    return user;
  }
}
