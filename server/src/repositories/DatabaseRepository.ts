import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';

export class DatabaseRepository {
  private static instance: Database | null = null;

  private static getDatabasePath(): string {
    if (process.env.DATABASE_FILE) {
      return path.isAbsolute(process.env.DATABASE_FILE)
        ? process.env.DATABASE_FILE
        : path.resolve(process.cwd(), process.env.DATABASE_FILE);
    }
    // Comprobar si existe la BBDD principal en la raíz del proyecto
    const rootDbPath = path.resolve(process.cwd(), '../database.sqlite');
    if (fs.existsSync(rootDbPath)) {
      return rootDbPath;
    }
    const localDbPath = path.resolve(process.cwd(), 'database.sqlite');
    if (fs.existsSync(localDbPath)) {
      return localDbPath;
    }
    return rootDbPath;
  }

  public static async getInstance(): Promise<Database> {
    if (!this.instance) {
      const dbPath = this.getDatabasePath();
      console.log(`[BBDD] Conectando a la base de datos en: ${dbPath}`);
      
      // Realizar copia de seguridad de la base de datos antes de ejecutar migraciones
      this.backupDatabase(dbPath);

      this.instance = await open({
        filename: dbPath,
        driver: sqlite3.Database
      });

      // Habilitar Foreign Keys en SQLite
      await this.instance.exec('PRAGMA foreign_keys = ON;');

      await this.runMigrations();
    }
    return this.instance;
  }


  private static backupDatabase(dbPath: string): void {
    try {
      if (fs.existsSync(dbPath)) {
        const backupsDir = path.resolve(process.cwd(), 'backups');
        if (!fs.existsSync(backupsDir)) {
          fs.mkdirSync(backupsDir, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(backupsDir, `database_${timestamp}.sqlite`);
        fs.copyFileSync(dbPath, backupPath);
        console.log(`[BBDD BACKUP] Copia de seguridad guardada con éxito en: ${backupPath}`);
      }
    } catch (error) {
      console.error('[BBDD BACKUP WARNING] No se pudo crear la copia de seguridad:', error);
    }
  }

  private static async runMigrations(): Promise<void> {
    if (!this.instance) return;

    // Crear tabla de tracking de migraciones
    await this.instance.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        appliedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migración 001: Tablas iniciales (Usuarios, Roles, Solicitudes)
    await this.applyMigration('001_initial_tables', async (db) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          realName TEXT,
          botcUsername TEXT,
          email TEXT UNIQUE,
          telegramUsername TEXT,
          passwordHash TEXT NOT NULL,
          profilePicture TEXT,
          isConfirmed INTEGER DEFAULT 0,
          confirmationToken TEXT,
          confirmationTokenExpires DATETIME,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS user_roles (
          userId TEXT NOT NULL,
          role TEXT NOT NULL,
          PRIMARY KEY (userId, role),
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS role_requests (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          requestedRole TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(userId, requestedRole, status)
        );
      `);
    });

    // Migración 002: Tablas e Índices para La Biblioteca
    await this.applyMigration('002_add_library_tables_and_indexes', async (db) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS library_sections (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          parentId TEXT,
          position INTEGER DEFAULT 0,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (parentId) REFERENCES library_sections(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS library_documents (
          id TEXT PRIMARY KEY,
          sectionId TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          position INTEGER DEFAULT 0,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (sectionId) REFERENCES library_sections(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS library_document_versions (
          id TEXT PRIMARY KEY,
          documentId TEXT NOT NULL,
          label TEXT NOT NULL,
          filename TEXT NOT NULL,
          originalFilename TEXT NOT NULL,
          mimeType TEXT NOT NULL,
          fileSize INTEGER NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (documentId) REFERENCES library_documents(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_library_sections_parentId ON library_sections(parentId);
        CREATE INDEX IF NOT EXISTS idx_library_documents_sectionId ON library_documents(sectionId);
        CREATE INDEX IF NOT EXISTS idx_library_document_versions_documentId ON library_document_versions(documentId);
      `);
    });

    // Migración 003: Restricciones de acceso para documentos en La Biblioteca
    await this.applyMigration('003_add_document_access_control', async (db) => {
      await db.exec(`
        ALTER TABLE library_documents ADD COLUMN accessLevel TEXT DEFAULT 'all';
        ALTER TABLE library_documents ADD COLUMN allowedRoles TEXT;
      `);
    });

    // Migración 004: Modelo polimórfico library_items y enlaces
    await this.applyMigration('004_refactor_library_items_and_links', async (db) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS library_items (
          id TEXT PRIMARY KEY,
          sectionId TEXT NOT NULL,
          itemType TEXT NOT NULL DEFAULT 'document',
          title TEXT NOT NULL,
          description TEXT,
          position INTEGER DEFAULT 0,
          accessLevel TEXT DEFAULT 'all',
          allowedRoles TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (sectionId) REFERENCES library_sections(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS library_links (
          itemId TEXT PRIMARY KEY,
          url TEXT NOT NULL,
          linkType TEXT NOT NULL,
          thumbnailUrl TEXT,
          FOREIGN KEY (itemId) REFERENCES library_items(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_library_items_sectionId ON library_items(sectionId);
      `);

      const tableExists = await db.get<{ count: number }>(
        "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='library_documents'"
      );

      if (tableExists && tableExists.count > 0) {
        await db.exec(`
          INSERT OR IGNORE INTO library_items (id, sectionId, itemType, title, description, position, accessLevel, allowedRoles, createdAt)
          SELECT id, sectionId, 'document', title, description, position,
                 COALESCE(accessLevel, 'all'), allowedRoles, createdAt
          FROM library_documents;
        `);
      }
    });
  }

  private static async applyMigration(name: string, migrationFn: (db: Database) => Promise<void>): Promise<void> {
    if (!this.instance) return;

    const row = await this.instance.get('SELECT name FROM schema_migrations WHERE name = ?', [name]);
    if (!row) {
      console.log(`[MIGRATION] Aplicando migración: ${name}`);
      await this.instance.exec('BEGIN TRANSACTION;');
      try {
        await migrationFn(this.instance);
        await this.instance.run('INSERT INTO schema_migrations (name) VALUES (?)', [name]);
        await this.instance.exec('COMMIT;');
        console.log(`[MIGRATION] Migración ${name} aplicada con éxito.`);
      } catch (err) {
        await this.instance.exec('ROLLBACK;');
        console.error(`[MIGRATION ERROR] Error aplicando migración ${name}. Se realizó ROLLBACK.`, err);
        throw err;
      }
    }
  }
}

