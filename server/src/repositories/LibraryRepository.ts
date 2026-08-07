import { DatabaseRepository } from './DatabaseRepository';
import { LibrarySection, LibraryDocument, LibraryDocumentVersion } from '../types/library';

export class LibraryRepository {

  // --- SECCIONES (TÍTULOS / SUBTÍTULOS) ---

  public async getAllSections(): Promise<LibrarySection[]> {
    const db = await DatabaseRepository.getInstance();
    return db.all<LibrarySection[]>(
      'SELECT id, name, parentId, position, createdAt FROM library_sections ORDER BY position ASC, createdAt ASC'
    );
  }

  public async getSectionById(id: string): Promise<LibrarySection | undefined> {
    const db = await DatabaseRepository.getInstance();
    return db.get<LibrarySection>(
      'SELECT id, name, parentId, position, createdAt FROM library_sections WHERE id = ?',
      [id]
    );
  }

  public async createSection(id: string, name: string, parentId: string | null, position: number): Promise<LibrarySection> {
    const db = await DatabaseRepository.getInstance();
    await db.run(
      'INSERT INTO library_sections (id, name, parentId, position) VALUES (?, ?, ?, ?)',
      [id, name, parentId, position]
    );
    const created = await this.getSectionById(id);
    return created!;
  }

  public async updateSection(id: string, name?: string, parentId?: string | null, position?: number): Promise<LibrarySection | undefined> {
    const db = await DatabaseRepository.getInstance();
    const current = await this.getSectionById(id);
    if (!current) return undefined;

    const newName = name !== undefined ? name : current.name;
    const newParentId = parentId !== undefined ? parentId : current.parentId;
    const newPosition = position !== undefined ? position : current.position;

    await db.run(
      'UPDATE library_sections SET name = ?, parentId = ?, position = ? WHERE id = ?',
      [newName, newParentId, newPosition, id]
    );
    return this.getSectionById(id);
  }

  public async deleteSection(id: string): Promise<boolean> {
    const db = await DatabaseRepository.getInstance();
    const result = await db.run('DELETE FROM library_sections WHERE id = ?', [id]);
    return (result.changes ?? 0) > 0;
  }

  /**
   * Comprueba recursivamente cuántos documentos existen bajo una sección o cualquiera de sus subtítulos
   */
  public async countSubDocuments(sectionId: string): Promise<number> {
    const db = await DatabaseRepository.getInstance();
    
    // Consulta recursiva CTE en SQLite
    const query = `
      WITH RECURSIVE section_tree(id) AS (
        SELECT id FROM library_sections WHERE id = ?
        UNION ALL
        SELECT s.id FROM library_sections s
        JOIN section_tree st ON s.parentId = st.id
      )
      SELECT COUNT(*) as count
      FROM library_documents
      WHERE sectionId IN (SELECT id FROM section_tree)
    `;

    const row = await db.get<{ count: number }>(query, [sectionId]);
    return row ? row.count : 0;
  }

  // --- DOCUMENTOS ---

  public async getAllDocuments(): Promise<LibraryDocument[]> {
    const db = await DatabaseRepository.getInstance();
    const docs = await db.all<any[]>(
      'SELECT id, sectionId, title, description, position, createdAt FROM library_documents ORDER BY position ASC, createdAt ASC'
    );
    return docs.map(d => ({ ...d, versions: [] }));
  }

  public async getDocumentById(id: string): Promise<LibraryDocument | undefined> {
    const db = await DatabaseRepository.getInstance();
    const doc = await db.get<any>(
      'SELECT id, sectionId, title, description, position, createdAt FROM library_documents WHERE id = ?',
      [id]
    );
    if (!doc) return undefined;
    const versions = await this.getVersionsByDocumentId(id);
    return { ...doc, versions };
  }

  public async createDocument(id: string, sectionId: string, title: string, description: string | undefined, position: number): Promise<LibraryDocument> {
    const db = await DatabaseRepository.getInstance();
    await db.run(
      'INSERT INTO library_documents (id, sectionId, title, description, position) VALUES (?, ?, ?, ?, ?)',
      [id, sectionId, title, description || null, position]
    );
    const created = await this.getDocumentById(id);
    return created!;
  }

  public async updateDocument(id: string, sectionId?: string, title?: string, description?: string, position?: number): Promise<LibraryDocument | undefined> {
    const db = await DatabaseRepository.getInstance();
    const current = await this.getDocumentById(id);
    if (!current) return undefined;

    const newSectionId = sectionId !== undefined ? sectionId : current.sectionId;
    const newTitle = title !== undefined ? title : current.title;
    const newDesc = description !== undefined ? description : current.description;
    const newPos = position !== undefined ? position : current.position;

    await db.run(
      'UPDATE library_documents SET sectionId = ?, title = ?, description = ?, position = ? WHERE id = ?',
      [newSectionId, newTitle, newDesc || null, newPos, id]
    );
    return this.getDocumentById(id);
  }

  public async deleteDocument(id: string): Promise<boolean> {
    const db = await DatabaseRepository.getInstance();
    const result = await db.run('DELETE FROM library_documents WHERE id = ?', [id]);
    return (result.changes ?? 0) > 0;
  }

  // --- VERSIONES DE DOCUMENTO ---

  public async getAllVersions(): Promise<LibraryDocumentVersion[]> {
    const db = await DatabaseRepository.getInstance();
    return db.all<LibraryDocumentVersion[]>(
      'SELECT id, documentId, label, filename, originalFilename, mimeType, fileSize, createdAt FROM library_document_versions ORDER BY createdAt ASC'
    );
  }

  public async getVersionsByDocumentId(documentId: string): Promise<LibraryDocumentVersion[]> {
    const db = await DatabaseRepository.getInstance();
    return db.all<LibraryDocumentVersion[]>(
      'SELECT id, documentId, label, filename, originalFilename, mimeType, fileSize, createdAt FROM library_document_versions WHERE documentId = ? ORDER BY createdAt ASC',
      [documentId]
    );
  }

  public async getVersionById(id: string): Promise<LibraryDocumentVersion | undefined> {
    const db = await DatabaseRepository.getInstance();
    return db.get<LibraryDocumentVersion>(
      'SELECT id, documentId, label, filename, originalFilename, mimeType, fileSize, createdAt FROM library_document_versions WHERE id = ?',
      [id]
    );
  }

  public async createVersion(
    id: string,
    documentId: string,
    label: string,
    filename: string,
    originalFilename: string,
    mimeType: string,
    fileSize: number
  ): Promise<LibraryDocumentVersion> {
    const db = await DatabaseRepository.getInstance();
    await db.run(
      'INSERT INTO library_document_versions (id, documentId, label, filename, originalFilename, mimeType, fileSize) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, documentId, label, filename, originalFilename, mimeType, fileSize]
    );
    const version = await this.getVersionById(id);
    return version!;
  }

  public async deleteVersion(id: string): Promise<boolean> {
    const db = await DatabaseRepository.getInstance();
    const result = await db.run('DELETE FROM library_document_versions WHERE id = ?', [id]);
    return (result.changes ?? 0) > 0;
  }
}
