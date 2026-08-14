import { DatabaseRepository } from './DatabaseRepository';
import { LibraryDocument, LibraryDocumentVersion } from '../types/library';

export class LibraryDocumentRepository {
  public async getVersionsByDocumentId(documentId: string): Promise<LibraryDocumentVersion[]> {
    const db = await DatabaseRepository.getInstance();
    return db.all<LibraryDocumentVersion[]>(
      'SELECT id, documentId, label, filename, originalFilename, mimeType, fileSize, createdAt FROM library_document_versions WHERE documentId = ? ORDER BY createdAt ASC',
      [documentId]
    );
  }

  public async getAllVersions(): Promise<LibraryDocumentVersion[]> {
    const db = await DatabaseRepository.getInstance();
    return db.all<LibraryDocumentVersion[]>(
      'SELECT id, documentId, label, filename, originalFilename, mimeType, fileSize, createdAt FROM library_document_versions ORDER BY createdAt ASC'
    );
  }

  public async getVersionById(id: string): Promise<LibraryDocumentVersion | undefined> {
    const db = await DatabaseRepository.getInstance();
    return db.get<LibraryDocumentVersion>(
      'SELECT id, documentId, label, filename, originalFilename, mimeType, fileSize, createdAt FROM library_document_versions WHERE id = ?',
      [id]
    );
  }

  public async getDocumentById(id: string): Promise<LibraryDocument | undefined> {
    const db = await DatabaseRepository.getInstance();
    const item = await db.get<any>(
      "SELECT id, sectionId, itemType, title, description, position, accessLevel, allowedRoles, createdAt FROM library_items WHERE id = ? AND itemType = 'document'",
      [id]
    );
    if (!item) return undefined;
    const versions = await this.getVersionsByDocumentId(id);
    return {
      ...item,
      allowedRoles: item.allowedRoles ? JSON.parse(item.allowedRoles) : [],
      versions
    };
  }

  public async createDocument(
    id: string,
    sectionId: string,
    title: string,
    description: string | undefined,
    position: number,
    accessLevel: 'all' | 'registered' | 'roles' = 'all',
    allowedRoles: string[] = []
  ): Promise<LibraryDocument> {
    const db = await DatabaseRepository.getInstance();
    await db.run(
      "INSERT INTO library_items (id, sectionId, itemType, title, description, position, accessLevel, allowedRoles) VALUES (?, ?, 'document', ?, ?, ?, ?, ?)",
      [id, sectionId, title, description || null, position, accessLevel, JSON.stringify(allowedRoles)]
    );
    const created = await this.getDocumentById(id);
    return created!;
  }

  public async updateDocument(
    id: string,
    sectionId?: string,
    title?: string,
    description?: string,
    position?: number,
    accessLevel?: 'all' | 'registered' | 'roles',
    allowedRoles?: string[]
  ): Promise<LibraryDocument | undefined> {
    const db = await DatabaseRepository.getInstance();
    const current = await this.getDocumentById(id);
    if (!current) return undefined;

    const newSectionId = sectionId !== undefined ? sectionId : current.sectionId;
    const newTitle = title !== undefined ? title : current.title;
    const newDesc = description !== undefined ? description : current.description;
    const newPos = position !== undefined ? position : current.position;
    const newAccessLevel = accessLevel !== undefined ? accessLevel : (current.accessLevel || 'all');
    const newAllowedRoles = allowedRoles !== undefined ? allowedRoles : (current.allowedRoles || []);

    await db.run(
      'UPDATE library_items SET sectionId = ?, title = ?, description = ?, position = ?, accessLevel = ?, allowedRoles = ? WHERE id = ? AND itemType = \'document\'',
      [newSectionId, newTitle, newDesc || null, newPos, newAccessLevel, JSON.stringify(newAllowedRoles), id]
    );
    return this.getDocumentById(id);
  }

  public async deleteDocument(id: string): Promise<boolean> {
    const db = await DatabaseRepository.getInstance();
    const result = await db.run("DELETE FROM library_items WHERE id = ? AND itemType = 'document'", [id]);
    return (result.changes ?? 0) > 0;
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
