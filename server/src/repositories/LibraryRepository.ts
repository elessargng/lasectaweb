import { LibraryItemRepository } from './LibraryItemRepository';
import { LibraryDocumentRepository } from './LibraryDocumentRepository';
import { LibraryLinkRepository } from './LibraryLinkRepository';
import { LibrarySection, LibraryDocument, LibraryLink, LibraryDocumentVersion, BaseLibraryItem, LibraryAccessLevel } from '../types/library';

export class LibraryRepository {
  public itemRepo: LibraryItemRepository;
  public documentRepo: LibraryDocumentRepository;
  public linkRepo: LibraryLinkRepository;

  constructor() {
    this.itemRepo = new LibraryItemRepository();
    this.documentRepo = new LibraryDocumentRepository();
    this.linkRepo = new LibraryLinkRepository();
  }

  // --- SECCIONES ---
  public async getAllSections(): Promise<LibrarySection[]> {
    return this.itemRepo.getAllSections();
  }

  public async getSectionById(id: string): Promise<LibrarySection | undefined> {
    return this.itemRepo.getSectionById(id);
  }

  public async createSection(
    id: string,
    name: string,
    parentId: string | null,
    position: number,
    accessLevel: LibraryAccessLevel = 'all',
    allowedRoles: string[] = [],
    icon: string | null = null
  ): Promise<LibrarySection> {
    return this.itemRepo.createSection(id, name, parentId, position, accessLevel, allowedRoles, icon);
  }

  public async updateSection(
    id: string,
    name?: string,
    parentId?: string | null,
    position?: number,
    accessLevel?: LibraryAccessLevel,
    allowedRoles?: string[],
    icon?: string | null
  ): Promise<LibrarySection | undefined> {
    return this.itemRepo.updateSection(id, name, parentId, position, accessLevel, allowedRoles, icon);
  }

  public async deleteSection(id: string): Promise<boolean> {
    return this.itemRepo.deleteSection(id);
  }

  public async countSubDocuments(sectionId: string): Promise<number> {
    return this.itemRepo.countSubItems(sectionId);
  }

  // --- ITEMS BASE ---
  public async getAllRawItems(): Promise<BaseLibraryItem[]> {
    return this.itemRepo.getAllRawItems();
  }

  public async getItemById(id: string): Promise<BaseLibraryItem | undefined> {
    return this.itemRepo.getItemById(id);
  }

  // --- DOCUMENTOS ---
  public async getDocumentById(id: string): Promise<LibraryDocument | undefined> {
    return this.documentRepo.getDocumentById(id);
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
    return this.documentRepo.createDocument(id, sectionId, title, description, position, accessLevel, allowedRoles);
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
    return this.documentRepo.updateDocument(id, sectionId, title, description, position, accessLevel, allowedRoles);
  }

  public async deleteDocument(id: string): Promise<boolean> {
    return this.documentRepo.deleteDocument(id);
  }

  // --- VERSIONES DE DOCUMENTO ---
  public async getAllVersions(): Promise<LibraryDocumentVersion[]> {
    return this.documentRepo.getAllVersions();
  }

  public async getVersionsByDocumentId(documentId: string): Promise<LibraryDocumentVersion[]> {
    return this.documentRepo.getVersionsByDocumentId(documentId);
  }

  public async getVersionById(id: string): Promise<LibraryDocumentVersion | undefined> {
    return this.documentRepo.getVersionById(id);
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
    return this.documentRepo.createVersion(id, documentId, label, filename, originalFilename, mimeType, fileSize);
  }

  public async deleteVersion(id: string): Promise<boolean> {
    return this.documentRepo.deleteVersion(id);
  }

  // --- ENLACES ---
  public async getLinkById(id: string): Promise<LibraryLink | undefined> {
    return this.linkRepo.getLinkById(id);
  }

  public async getAllLinks(): Promise<LibraryLink[]> {
    return this.linkRepo.getAllLinks();
  }

  public async createLink(
    id: string,
    sectionId: string,
    title: string,
    url: string,
    linkType: 'normal' | 'youtube',
    thumbnailUrl?: string,
    description?: string,
    position: number = 0,
    accessLevel: 'all' | 'registered' | 'roles' = 'all',
    allowedRoles: string[] = []
  ): Promise<LibraryLink> {
    return this.linkRepo.createLink(id, sectionId, title, url, linkType, thumbnailUrl, description, position, accessLevel, allowedRoles);
  }

  public async updateLink(
    id: string,
    sectionId?: string,
    title?: string,
    url?: string,
    linkType?: 'normal' | 'youtube',
    thumbnailUrl?: string,
    description?: string,
    position?: number,
    accessLevel?: 'all' | 'registered' | 'roles',
    allowedRoles?: string[]
  ): Promise<LibraryLink | undefined> {
    return this.linkRepo.updateLink(id, sectionId, title, url, linkType, thumbnailUrl, description, position, accessLevel, allowedRoles);
  }

  public async deleteLink(id: string): Promise<boolean> {
    return this.linkRepo.deleteLink(id);
  }
}
