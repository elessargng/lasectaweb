import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';
import { computeVersionHash, GENESIS_HASH } from '../utils/ledger';

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

    // Migración 005: Corregir clave foránea de library_document_versions para apuntar a library_items
    await this.applyMigration('005_fix_library_document_versions_fk', async (db) => {
      await db.exec(`
        CREATE TABLE library_document_versions_new (
          id TEXT PRIMARY KEY,
          documentId TEXT NOT NULL,
          label TEXT NOT NULL,
          filename TEXT NOT NULL,
          originalFilename TEXT NOT NULL,
          mimeType TEXT NOT NULL,
          fileSize INTEGER NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (documentId) REFERENCES library_items(id) ON DELETE CASCADE
        );

        INSERT INTO library_document_versions_new (id, documentId, label, filename, originalFilename, mimeType, fileSize, createdAt)
        SELECT id, documentId, label, filename, originalFilename, mimeType, fileSize, createdAt
        FROM library_document_versions
        WHERE documentId IN (SELECT id FROM library_items);

        DROP TABLE library_document_versions;

        ALTER TABLE library_document_versions_new RENAME TO library_document_versions;

        CREATE INDEX IF NOT EXISTS idx_library_document_versions_documentId ON library_document_versions(documentId);
      `);
    });

    // Migración 006: Restricciones de acceso para secciones (carpetas) de La Biblioteca
    await this.applyMigration('006_add_section_access_control', async (db) => {
      await db.exec(`
        ALTER TABLE library_sections ADD COLUMN accessLevel TEXT DEFAULT 'all';
        ALTER TABLE library_sections ADD COLUMN allowedRoles TEXT;
      `);
    });

    // Migración 007: Icono asociado a las carpetas de La Biblioteca
    await this.applyMigration('007_add_section_icon', async (db) => {
      await db.exec(`
        ALTER TABLE library_sections ADD COLUMN icon TEXT;
      `);
    });

    // Migración 008: Partidas POV y cámaras/perspectivas de La Biblioteca
    await this.applyMigration('008_add_pov_matches_and_povs', async (db) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS library_pov_matches (
          itemId TEXT PRIMARY KEY,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (itemId) REFERENCES library_items(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS library_povs (
          id TEXT PRIMARY KEY,
          matchId TEXT NOT NULL,
          name TEXT NOT NULL,
          sectaUserId TEXT,
          initialAlignment TEXT NOT NULL,
          character TEXT NOT NULL,
          characterType TEXT NOT NULL,
          youtubeUrl TEXT NOT NULL,
          youtubeId TEXT,
          position INTEGER DEFAULT 0,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (matchId) REFERENCES library_items(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_library_povs_matchId ON library_povs(matchId);
      `);
    });

    // Migración 009: La Plaza — propuestas, registro sellado y votación
    //
    // DOS INVARIANTES QUE NO SE DEBEN ROMPER AL TOCAR ESTE ESQUEMA:
    //
    // 1. plaza_ledger y plaza_participation no tienen ninguna columna en común
    //    ni relación entre sí. El registro no sabe de quién es cada voto, y la
    //    participación no sabe qué se votó. Añadir una FK, un índice conjunto o
    //    una vista que las cruce destruiría el secreto del voto.
    //
    // 2. El sello nunca se almacena. Lo genera el navegador de quien vota y de
    //    él se derivan dos tokens independientes:
    //
    //        T_urna  = HMAC(sello, "urna")   -> localiza el voto
    //        T_censo = HMAC(sello, "censo")  -> localiza la participacion
    //
    //    De cada uno se guarda solo su SHA-256, y en tablas distintas. Así
    //    anular un voto (urna) y recuperar el turno para volver a votar (censo)
    //    son operaciones que el servidor no puede relacionar entre sí: quien
    //    consiga un sello ajeno podrá destruir ese voto, pero el turno seguirá
    //    siendo de su propietario.
    await this.applyMigration('009_add_plaza_tables', async (db) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS plaza_proposals (
          id TEXT PRIMARY KEY,
          authorId TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          kind TEXT NOT NULL DEFAULT 'acuerdo',
          mode TEXT NOT NULL DEFAULT 'normal',
          status TEXT NOT NULL DEFAULT 'abierta',
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          deadlineAt DATETIME NOT NULL,
          closedAt DATETIME,
          closeReason TEXT,
          finalHash TEXT,
          fastTrackBlocked INTEGER NOT NULL DEFAULT 0,
          -- Qué cambia esta propuesta en el Códice. Vacío en los acuerdos
          -- puntuales, que no tocan las normas.
          targetRuleId TEXT,
          targetAction TEXT,
          proposedBody TEXT,
          proposedBullets TEXT,
          proposedSectionId TEXT,
          appliedAt DATETIME,
          FOREIGN KEY (authorId) REFERENCES users(id) ON DELETE CASCADE
        );

        -- LA URNA. Registro sellado, sin identidades.
        CREATE TABLE IF NOT EXISTS plaza_ledger (
          id TEXT PRIMARY KEY,
          proposalId TEXT NOT NULL,
          sequence INTEGER NOT NULL,
          kind TEXT NOT NULL,
          choice TEXT,
          refId TEXT,
          closeReason TEXT,
          isRevote INTEGER NOT NULL DEFAULT 0,
          -- Huella del token de urna. Lo único que se guarda del sello.
          urnaTokenHash TEXT,
          -- Solo en la apertura: huella del contenido que se somete a votación
          -- (título, descripción y texto propuesto). Ancla el enunciado a la
          -- cadena, así que editarlo después la rompe desde el primer eslabón.
          contentHash TEXT,
          createdAt DATETIME NOT NULL,
          prevHash TEXT NOT NULL,
          hash TEXT NOT NULL,
          FOREIGN KEY (proposalId) REFERENCES plaza_proposals(id) ON DELETE CASCADE,
          UNIQUE(proposalId, sequence),
          UNIQUE(proposalId, urnaTokenHash)
        );

        -- EL CENSO. Quién participó, para evitar duplicados y publicar la lista.
        CREATE TABLE IF NOT EXISTS plaza_participation (
          proposalId TEXT NOT NULL,
          userId TEXT NOT NULL,
          votedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          -- Huella del token de censo. Sin relación con la de la urna.
          censoTokenHash TEXT,
          -- Su voto fue anulado y puede emitir uno nuevo.
          voteAnnulled INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (proposalId, userId),
          FOREIGN KEY (proposalId) REFERENCES plaza_proposals(id) ON DELETE CASCADE,
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS plaza_comments (
          id TEXT PRIMARY KEY,
          proposalId TEXT NOT NULL,
          userId TEXT NOT NULL,
          body TEXT NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (proposalId) REFERENCES plaza_proposals(id) ON DELETE CASCADE,
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_plaza_proposals_status ON plaza_proposals(status);
        CREATE INDEX IF NOT EXISTS idx_plaza_ledger_proposalId ON plaza_ledger(proposalId, sequence);
        CREATE INDEX IF NOT EXISTS idx_plaza_ledger_urnaToken ON plaza_ledger(proposalId, urnaTokenHash);
        CREATE INDEX IF NOT EXISTS idx_plaza_participation_censoToken ON plaza_participation(proposalId, censoTokenHash);
        CREATE INDEX IF NOT EXISTS idx_plaza_comments_proposalId ON plaza_comments(proposalId, createdAt);
      `);
    });

    // Migración 010: El Códice en base de datos (normas versionadas)
    //
    // Cada norma tiene una cadena de versiones: la vigente y todas las
    // anteriores, cada una con la votación que la aprobó. Las normas que ya
    // existían antes de La Plaza no tienen votación y su primera versión queda
    // marcada como fundacional: la votación solo es obligatoria para las
    // modificaciones y las normas nuevas.
    await this.applyMigration('010_add_codice_tables', async (db) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS codice_sections (
          id TEXT PRIMARY KEY,
          number INTEGER NOT NULL,
          title TEXT NOT NULL,
          icon TEXT,
          position INTEGER DEFAULT 0,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(number)
        );

        -- Una norma. Su contenido vive en codice_versions; aquí solo la
        -- identidad estable y qué versión está vigente.
        CREATE TABLE IF NOT EXISTS codice_rules (
          id TEXT PRIMARY KEY,
          sectionId TEXT NOT NULL,
          -- Numeración visible, por ejemplo 1.4. Se mantiene entre versiones.
          reference TEXT NOT NULL,
          kind TEXT NOT NULL DEFAULT 'edicto',
          position INTEGER DEFAULT 0,
          currentVersionId TEXT,
          -- Una norma derogada conserva su histórico pero deja de estar vigente.
          repealedAt DATETIME,
          repealedByProposalId TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (sectionId) REFERENCES codice_sections(id) ON DELETE CASCADE,
          FOREIGN KEY (repealedByProposalId) REFERENCES plaza_proposals(id) ON DELETE SET NULL,
          UNIQUE(reference)
        );

        -- El contenido, versionado. Nunca se actualiza una versión existente:
        -- modificar una norma añade una versión nueva y mueve currentVersionId.
        CREATE TABLE IF NOT EXISTS codice_versions (
          id TEXT PRIMARY KEY,
          ruleId TEXT NOT NULL,
          version INTEGER NOT NULL,
          body TEXT NOT NULL,
          -- Condiciones enumeradas, como JSON.
          bullets TEXT,
          -- Votación que aprobó esta versión. NULL en las fundacionales.
          proposalId TEXT,
          origin TEXT NOT NULL DEFAULT 'votacion',
          changeNote TEXT,
          createdAt DATETIME NOT NULL,
          -- Cada versión se encadena con la anterior de la misma norma, igual
          -- que las entradas de una votación: sin esto, un UPDATE sobre el
          -- texto de una ley la cambiaría sin dejar rastro.
          prevHash TEXT NOT NULL DEFAULT '',
          hash TEXT NOT NULL DEFAULT '',
          -- Huella final de la votación que aprobó esta versión. Permite
          -- comprobar que el texto en vigor es el que se votó.
          proposalFinalHash TEXT,
          FOREIGN KEY (ruleId) REFERENCES codice_rules(id) ON DELETE CASCADE,
          FOREIGN KEY (proposalId) REFERENCES plaza_proposals(id) ON DELETE SET NULL,
          UNIQUE(ruleId, version)
        );

        CREATE INDEX IF NOT EXISTS idx_codice_rules_sectionId ON codice_rules(sectionId, position);
        CREATE INDEX IF NOT EXISTS idx_codice_versions_ruleId ON codice_versions(ruleId, version);
      `);
    });

    // Migración 011: anuncio del resultado de cada votación a la comunidad
    //
    // announcedAt marca que el correo con el resultado y la huella final ya
    // salió. Sirve para no repetirlo y para que el vigilante reintente los que
    // fallaron: ese correo es una copia del resultado fuera del servidor, así
    // que no puede quedarse sin enviar.
    await this.applyMigration('011_add_plaza_announcements', async (db) => {
      await db.exec(`
        ALTER TABLE plaza_proposals ADD COLUMN announcedAt DATETIME;
      `);
    });

    // Migración 012: reparar las huellas de La Plaza y el Códice
    //
    // Las migraciones 009 y 010 se ampliaron con las columnas de huellas después
    // de haberse aplicado en algunas bases de datos, que se quedaron sin ellas:
    // una migración ya aplicada no se vuelve a ejecutar. Esta las añade donde
    // falten (en una base de datos nueva no hace nada) y sella las versiones del
    // Códice que nunca tuvieron huella.
    //
    // Lección para el futuro: una migración aplicada no se edita; se añade otra.
    await this.applyMigration('012_repair_plaza_codice_hashes', async (db) => {
      const hasColumn = async (table: string, column: string) =>
        ((await db.all<any[]>(`PRAGMA table_info(${table})`)) ?? []).some((c) => c.name === column);

      if (!(await hasColumn('plaza_ledger', 'contentHash'))) {
        // Las aperturas que ya existieran se quedan sin enunciado sellado: no
        // se puede sellar a posteriori sin cambiar su huella, y la verificación
        // lo señalará.
        await db.exec('ALTER TABLE plaza_ledger ADD COLUMN contentHash TEXT;');
      }
      if (!(await hasColumn('codice_versions', 'prevHash'))) {
        await db.exec(`ALTER TABLE codice_versions ADD COLUMN prevHash TEXT NOT NULL DEFAULT '';`);
      }
      if (!(await hasColumn('codice_versions', 'hash'))) {
        await db.exec(`ALTER TABLE codice_versions ADD COLUMN hash TEXT NOT NULL DEFAULT '';`);
      }
      if (!(await hasColumn('codice_versions', 'proposalFinalHash'))) {
        await db.exec('ALTER TABLE codice_versions ADD COLUMN proposalFinalHash TEXT;');
      }

      // Sellar las normas cuyas versiones no tienen ninguna huella. Las que
      // tengan alguna ya se sellaron en su día y no se tocan: recalcularlas
      // daría por bueno cualquier cambio posterior.
      const unsealed = await db.all<any[]>(
        `SELECT ruleId FROM codice_versions GROUP BY ruleId HAVING MAX(hash) = ''`
      );
      for (const { ruleId } of unsealed) {
        const versions = await db.all<any[]>(
          `SELECT v.*, p.finalHash AS currentProposalHash
             FROM codice_versions v
             LEFT JOIN plaza_proposals p ON v.proposalId = p.id
            WHERE v.ruleId = ?
            ORDER BY v.version ASC`,
          [ruleId]
        );

        let prevHash = GENESIS_HASH;
        for (const v of versions) {
          const proposalFinalHash = v.proposalFinalHash ?? v.currentProposalHash ?? undefined;
          let bullets: string[] = [];
          try {
            const parsed = JSON.parse(v.bullets ?? '[]');
            bullets = Array.isArray(parsed) ? parsed : [];
          } catch {
            bullets = [];
          }
          const hash = computeVersionHash({
            ruleId,
            version: v.version,
            body: v.body,
            bullets,
            origin: v.origin,
            proposalId: v.proposalId ?? undefined,
            proposalFinalHash,
            createdAt: v.createdAt,
            prevHash
          });
          await db.run(
            'UPDATE codice_versions SET prevHash = ?, hash = ?, proposalFinalHash = ? WHERE id = ?',
            [prevHash, hash, proposalFinalHash ?? null, v.id]
          );
          prevHash = hash;
        }
      }
    });

    // Migración 013: avisos del vigilante, a elección de cada persona
    //
    // Por defecto desactivados: quien quiera recibir por correo las incidencias
    // que detecte el vigilante lo activa desde su perfil.
    await this.applyMigration('013_add_user_vigilante_alerts', async (db) => {
      await db.exec(`
        ALTER TABLE users ADD COLUMN vigilanteAlerts INTEGER NOT NULL DEFAULT 0;
      `);
    });

    // Migración 014: Rituales — la agenda de eventos de La Secta
    //
    // Un ritual es cualquier cosa que se apunta en la agenda: una partida online
    // en botc.app (llevada por La Secta o por Villacuervos), una partida
    // presencial o unas jornadas. Las columnas comunes viven aquí; lo propio de
    // cada tipo se irá añadiendo con migraciones nuevas según se defina.
    await this.applyMigration('014_add_rituals_table', async (db) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS rituals (
          id TEXT PRIMARY KEY,
          -- partida_online | partida_presencial | jornada
          type TEXT NOT NULL,
          -- Solo en las partidas online: secta | villacuervos
          managedBy TEXT,
          title TEXT NOT NULL,
          description TEXT,
          startsAt DATETIME NOT NULL,
          -- Opcional: las jornadas pueden durar varios días.
          endsAt DATETIME,
          -- Dirección, para lo presencial.
          location TEXT,
          -- Sala de botc.app o página de la partida en Villacuervos.
          link TEXT,
          scriptName TEXT,
          maxPlayers INTEGER,
          storytellerId TEXT,
          -- programado | cancelado
          status TEXT NOT NULL DEFAULT 'programado',
          createdBy TEXT NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME,
          FOREIGN KEY (storytellerId) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_rituals_startsAt ON rituals(startsAt);
      `);
    });

    // Migración 015: periodicidad de las partidas presenciales y vínculo con Villacuervos
    //
    // Las partidas de Villacuervos no se convocan aquí: se leen de su API. Una
    // partida online de La Secta puede publicarse también allí, y entonces se
    // guarda qué partida le corresponde para no mostrarla dos veces.
    //
    // Las partidas (online y presenciales) solo tienen hora de convocatoria; la
    // fecha de fin queda para las jornadas.
    await this.applyMigration('015_add_ritual_recurrence_and_villacuervos_link', async (db) => {
      await db.exec(`
        -- Cada cuántos días se repite. Solo en las partidas presenciales.
        ALTER TABLE rituals ADD COLUMN recurrenceDays INTEGER;
        -- Último día en que puede repetirse. Vacío: sin final.
        ALTER TABLE rituals ADD COLUMN recurrenceUntil DATETIME;
        ALTER TABLE rituals ADD COLUMN villacuervosPlayId INTEGER;
        ALTER TABLE rituals ADD COLUMN villacuervosSlug TEXT;

        UPDATE rituals SET managedBy = 'secta' WHERE type = 'partida_online';
        UPDATE rituals SET endsAt = NULL WHERE type <> 'jornada';
      `);
    });

    // Migración 016: periodicidad mensual de las partidas presenciales
    //
    // "Cada mes" no son 30 días: es el mismo día de la semana en la misma
    // posición del mes (el segundo jueves, el último sábado...), tenga el mes
    // 28, 30 o 31 días. Por eso va en su propia columna y no en recurrenceDays.
    // Una serie usa una de las dos, nunca ambas.
    await this.applyMigration('016_add_ritual_monthly_recurrence', async (db) => {
      await db.exec(`
        ALTER TABLE rituals ADD COLUMN recurrenceMonths INTEGER;
      `);
    });

    // Migración 017: inscripción en las partidas de La Secta
    //
    // El orden de inscripción importa, así que lo fija el id autoincremental y
    // no la fecha (dos personas pueden apuntarse en el mismo segundo). Las
    // plazas no limitan: puede haber más gente apuntada que plazas.
    //
    // occurrence distingue las repeticiones de una serie periódica, que son
    // partidas distintas con su propia lista: es la fecha de inicio de esa
    // repetición, en ISO. En una partida suelta va vacío.
    await this.applyMigration('017_add_ritual_signups', async (db) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS ritual_signups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ritualId TEXT NOT NULL,
          occurrence TEXT NOT NULL DEFAULT '',
          userId TEXT NOT NULL,
          createdAt DATETIME NOT NULL,
          FOREIGN KEY (ritualId) REFERENCES rituals(id) ON DELETE CASCADE,
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(ritualId, occurrence, userId)
        );

        CREATE INDEX IF NOT EXISTS idx_ritual_signups_ritual ON ritual_signups(ritualId, occurrence, id);
      `);
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

