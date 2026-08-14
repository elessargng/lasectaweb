import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { LibraryRepository } from '../repositories/LibraryRepository';
import { UserRepository } from '../repositories/UserRepository';
import {
  LibrarySection,
  LibraryDocument,
  LibraryLink,
  LibraryItem,
  BaseLibraryItem,
  LibraryDocumentVersion,
  CreateSectionDTO,
  UpdateSectionDTO,
  CreateDocumentDTO,
  UpdateDocumentDTO,
  CreateLinkDTO,
  UpdateLinkDTO
} from '../types/library';

export class LibraryService {
  constructor(
    private libraryRepository: LibraryRepository,
    private userRepository: UserRepository
  ) {}

  private async verifyAdmin(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user || !user.roles || !user.roles.includes('admin')) {
      throw new Error('No tienes permisos de Administrador para realizar esta acción.');
    }
  }

  private parseYoutubeInfo(url: string): { isYoutube: boolean; linkType: 'normal' | 'youtube'; thumbnailUrl?: string } {
    const isYoutube = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(url);
    if (!isYoutube) {
      return { isYoutube: false, linkType: 'normal' };
    }

    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    const videoId = (match && match[2].length === 11) ? match[2] : null;
    const thumbnailUrl = videoId
      ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
      : undefined;

    return {
      isYoutube: true,
      linkType: 'youtube',
      thumbnailUrl
    };
  }

  public async getTree(userId?: string): Promise<LibrarySection[]> {
    const user = userId ? await this.userRepository.findById(userId) : null;
    const isAdmin = user?.roles?.includes('admin') || false;
    const userRoles = user?.roles || [];

    const rawSections = await this.libraryRepository.getAllSections();
    const rawItems = await this.libraryRepository.getAllRawItems();
    const rawLinks = await this.libraryRepository.getAllLinks();
    const rawVersions = await this.libraryRepository.getAllVersions();

    const linkMap = new Map<string, LibraryLink>();
    for (const link of rawLinks) {
      linkMap.set(link.id, link);
    }

    // Filtrar items según control de acceso del usuario
    const allowedRawItems = rawItems.filter(item => {
      if (isAdmin) return true;

      const accessLevel = item.accessLevel || 'all';

      if (accessLevel === 'all') return true;

      if (accessLevel === 'registered') return !!user;

      if (accessLevel === 'roles') {
        const allowed = item.allowedRoles || [];
        return !!user && (allowed.length === 0 || allowed.some(role => userRoles.includes(role as any)));
      }

      return false;
    });

    // Construir objetos polimórficos LibraryItem (LibraryDocument | LibraryLink)
    const polymorphicItems: LibraryItem[] = [];
    for (const raw of allowedRawItems) {
      if (raw.itemType === 'link') {
        const fullLink = linkMap.get(raw.id);
        if (fullLink) {
          polymorphicItems.push(fullLink);
        } else {
          // Si no estuviera en library_links, construir por defecto
          const ytInfo = this.parseYoutubeInfo((raw as any).url || '');
          polymorphicItems.push({
            ...raw,
            itemType: 'link',
            url: (raw as any).url || '',
            linkType: ytInfo.linkType,
            thumbnailUrl: ytInfo.thumbnailUrl
          });
        }
      } else {
        // Documento con archivo físico
        const docVersions = rawVersions.filter(v => v.documentId === raw.id);
        polymorphicItems.push({
          ...raw,
          itemType: 'document',
          versions: docVersions
        });
      }
    }

    // Agrupar items por sección
    const itemsBySection = new Map<string, LibraryItem[]>();
    for (const item of polymorphicItems) {
      if (!itemsBySection.has(item.sectionId)) {
        itemsBySection.set(item.sectionId, []);
      }
      itemsBySection.get(item.sectionId)!.push(item);
    }

    // Mapa de secciones enriquecidas
    const sectionMap = new Map<string, LibrarySection & { hasSubDocuments: boolean }>();
    for (const sec of rawSections) {
      const itemsInSec = itemsBySection.get(sec.id) || [];
      const docsInSec = itemsInSec.filter((i): i is LibraryDocument => i.itemType === 'document');

      sectionMap.set(sec.id, {
        ...sec,
        items: itemsInSec,
        documents: docsInSec, // Para compatibilidad
        subsections: [],
        hasSubDocuments: false
      });
    }

    // Armar árbol jerárquico
    const rootSections: (LibrarySection & { hasSubDocuments: boolean })[] = [];
    for (const sec of sectionMap.values()) {
      if (sec.parentId && sectionMap.has(sec.parentId)) {
        const parent = sectionMap.get(sec.parentId)!;
        parent.subsections!.push(sec);
      } else {
        rootSections.push(sec);
      }
    }

    // Determinar si una sección contiene items
    const checkHasSubDocs = (sec: LibrarySection & { hasSubDocuments: boolean }): boolean => {
      let hasItems = (sec.items && sec.items.length > 0) || false;
      if (sec.subsections) {
        for (const sub of sec.subsections as (LibrarySection & { hasSubDocuments: boolean })[]) {
          if (checkHasSubDocs(sub)) {
            hasItems = true;
          }
        }
      }
      sec.hasSubDocuments = hasItems;
      return hasItems;
    };

    for (const root of rootSections) {
      checkHasSubDocs(root);
    }

    return rootSections;
  }

  // --- GESTIÓN DE SECCIONES ---
  public async createSection(userId: string, dto: CreateSectionDTO): Promise<LibrarySection> {
    await this.verifyAdmin(userId);

    if (!dto.name || dto.name.trim() === '') {
      throw new Error('El nombre de la sección no puede estar vacío.');
    }

    if (dto.parentId) {
      const parent = await this.libraryRepository.getSectionById(dto.parentId);
      if (!parent) {
        throw new Error('La sección padre especificada no existe.');
      }
    }

    const id = crypto.randomUUID();
    const position = dto.position ?? 0;
    return this.libraryRepository.createSection(id, dto.name.trim(), dto.parentId || null, position);
  }

  public async updateSection(userId: string, id: string, dto: UpdateSectionDTO): Promise<LibrarySection> {
    await this.verifyAdmin(userId);

    const section = await this.libraryRepository.getSectionById(id);
    if (!section) {
      throw new Error('La sección especificada no existe.');
    }

    if (dto.parentId === id) {
      throw new Error('Una sección no puede ser su propio padre.');
    }

    const updated = await this.libraryRepository.updateSection(id, dto.name?.trim(), dto.parentId, dto.position);
    if (!updated) {
      throw new Error('No se pudo actualizar la sección.');
    }
    return updated;
  }

  public async deleteSection(userId: string, id: string): Promise<boolean> {
    await this.verifyAdmin(userId);

    const section = await this.libraryRepository.getSectionById(id);
    if (!section) {
      throw new Error('La sección especificada no existe.');
    }

    const subDocCount = await this.libraryRepository.countSubDocuments(id);
    if (subDocCount > 0) {
      throw new Error('No se puede borrar una sección o subtítulo que contenga elementos bajo ella.');
    }

    return this.libraryRepository.deleteSection(id);
  }

  // --- GESTIÓN DE DOCUMENTOS (ARCHIVOS) ---
  public async createDocument(
    userId: string,
    dto: CreateDocumentDTO,
    file?: any
  ): Promise<LibraryDocument> {
    await this.verifyAdmin(userId);

    if (!dto.title || dto.title.trim() === '') {
      throw new Error('El título del documento es obligatorio.');
    }
    if (!dto.sectionId) {
      throw new Error('Debe especificar una sección para el documento.');
    }
    if (!file) {
      throw new Error('Debe subir al menos una versión en archivo para el documento.');
    }
    if (!dto.label || dto.label.trim() === '') {
      throw new Error('Debe especificar una etiqueta para la versión del documento (ej: PDF).');
    }

    const section = await this.libraryRepository.getSectionById(dto.sectionId);
    if (!section) {
      throw new Error('La sección especificada no existe.');
    }

    const docId = crypto.randomUUID();
    const position = dto.position ?? 0;

    await this.libraryRepository.createDocument(
      docId,
      dto.sectionId,
      dto.title.trim(),
      dto.description,
      position,
      dto.accessLevel || 'all',
      dto.allowedRoles || []
    );

    const versionId = crypto.randomUUID();
    await this.libraryRepository.createVersion(
      versionId,
      docId,
      dto.label.trim(),
      file.filename,
      file.originalname,
      file.mimetype,
      file.size
    );

    return (await this.libraryRepository.getDocumentById(docId))!;
  }

  public async updateDocument(userId: string, id: string, dto: UpdateDocumentDTO): Promise<LibraryDocument> {
    await this.verifyAdmin(userId);

    const doc = await this.libraryRepository.getDocumentById(id);
    if (!doc) {
      throw new Error('El documento especificado no existe.');
    }

    if (dto.sectionId) {
      const section = await this.libraryRepository.getSectionById(dto.sectionId);
      if (!section) {
        throw new Error('La sección especificada no existe.');
      }
    }

    const updated = await this.libraryRepository.updateDocument(
      id,
      dto.sectionId,
      dto.title?.trim(),
      dto.description,
      dto.position,
      dto.accessLevel,
      dto.allowedRoles
    );
    if (!updated) {
      throw new Error('No se pudo actualizar el documento.');
    }
    return updated;
  }

  public async deleteDocument(userId: string, id: string): Promise<boolean> {
    await this.verifyAdmin(userId);

    const doc = await this.libraryRepository.getDocumentById(id);
    if (!doc) {
      throw new Error('El documento especificado no existe.');
    }

    for (const v of doc.versions) {
      this.deletePhysicalFile(v.filename);
    }

    return this.libraryRepository.deleteDocument(id);
  }

  // --- GESTIÓN DE ENLACES ---
  public async createLink(userId: string, dto: CreateLinkDTO): Promise<LibraryLink> {
    await this.verifyAdmin(userId);

    if (!dto.title || dto.title.trim() === '') {
      throw new Error('El título del enlace es obligatorio.');
    }
    if (!dto.url || dto.url.trim() === '') {
      throw new Error('La dirección URL del enlace es obligatoria.');
    }
    if (!dto.sectionId) {
      throw new Error('Debe especificar una sección para el enlace.');
    }

    const section = await this.libraryRepository.getSectionById(dto.sectionId);
    if (!section) {
      throw new Error('La sección especificada no existe.');
    }

    const linkId = crypto.randomUUID();
    const position = dto.position ?? 0;
    const url = dto.url.trim();

    const ytInfo = this.parseYoutubeInfo(url);

    return this.libraryRepository.createLink(
      linkId,
      dto.sectionId,
      dto.title.trim(),
      url,
      ytInfo.linkType,
      ytInfo.thumbnailUrl,
      dto.description,
      position,
      dto.accessLevel || 'all',
      dto.allowedRoles || []
    );
  }

  public async updateLink(userId: string, id: string, dto: UpdateLinkDTO): Promise<LibraryLink> {
    await this.verifyAdmin(userId);

    const currentLink = await this.libraryRepository.getLinkById(id);
    if (!currentLink) {
      throw new Error('El enlace especificado no existe.');
    }

    if (dto.sectionId) {
      const section = await this.libraryRepository.getSectionById(dto.sectionId);
      if (!section) {
        throw new Error('La sección especificada no existe.');
      }
    }

    let linkType = currentLink.linkType;
    let thumbnailUrl = currentLink.thumbnailUrl;
    const newUrl = dto.url !== undefined ? dto.url.trim() : currentLink.url;

    if (dto.url !== undefined) {
      const ytInfo = this.parseYoutubeInfo(newUrl);
      linkType = ytInfo.linkType;
      thumbnailUrl = ytInfo.thumbnailUrl;
    }

    const updated = await this.libraryRepository.updateLink(
      id,
      dto.sectionId,
      dto.title?.trim(),
      newUrl,
      linkType,
      thumbnailUrl,
      dto.description,
      dto.position,
      dto.accessLevel,
      dto.allowedRoles
    );

    if (!updated) {
      throw new Error('No se pudo actualizar el enlace.');
    }
    return updated;
  }

  public async deleteLink(userId: string, id: string): Promise<boolean> {
    await this.verifyAdmin(userId);

    const link = await this.libraryRepository.getLinkById(id);
    if (!link) {
      throw new Error('El enlace especificado no existe.');
    }

    return this.libraryRepository.deleteLink(id);
  }

  // --- VERSIONES ---
  public async addVersion(
    userId: string,
    documentId: string,
    label: string,
    file?: any
  ): Promise<LibraryDocumentVersion> {
    await this.verifyAdmin(userId);

    if (!file) {
      throw new Error('Debe adjuntar un archivo para la nueva versión.');
    }
    if (!label || label.trim() === '') {
      throw new Error('Debe especificar una etiqueta para la versión.');
    }

    const doc = await this.libraryRepository.getDocumentById(documentId);
    if (!doc) {
      throw new Error('El documento especificado no existe.');
    }

    const versionId = crypto.randomUUID();
    return this.libraryRepository.createVersion(
      versionId,
      documentId,
      label.trim(),
      file.filename,
      file.originalname,
      file.mimetype,
      file.size
    );
  }

  public async deleteVersion(userId: string, id: string): Promise<boolean> {
    await this.verifyAdmin(userId);

    const version = await this.libraryRepository.getVersionById(id);
    if (!version) {
      throw new Error('La versión especificada no existe.');
    }

    this.deletePhysicalFile(version.filename);
    return this.libraryRepository.deleteVersion(id);
  }

  public async getVersionDownloadInfo(
    versionId: string,
    userId?: string
  ): Promise<{ absolutePath: string; originalFilename: string; mimeType: string }> {
    const version = await this.libraryRepository.getVersionById(versionId);
    if (!version) {
      throw new Error('La versión del documento solicitada no existe.');
    }

    const doc = await this.libraryRepository.getDocumentById(version.documentId);
    if (!doc) {
      throw new Error('El documento solicitado no existe.');
    }

    const accessLevel = doc.accessLevel || 'all';
    if (accessLevel !== 'all') {
      if (!userId) {
        throw new Error('No tienes permisos suficientes para descargar este documento. Debes iniciar sesión.');
      }

      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('Usuario inválido.');
      }

      const isAdmin = user.roles?.includes('admin') || false;
      if (!isAdmin) {
        if (accessLevel === 'roles') {
          const allowed = doc.allowedRoles || [];
          const userRoles = user.roles || [];
          const hasRole = allowed.length === 0 || allowed.some(role => userRoles.includes(role as any));
          if (!hasRole) {
            throw new Error('No tienes permisos suficientes para descargar este documento (rol no autorizado).');
          }
        }
      }
    }

    const libraryDirSetting = process.env.LIBRARY_STORAGE_PATH || './uploads/library';
    const storageDir = path.isAbsolute(libraryDirSetting)
      ? libraryDirSetting
      : path.resolve(process.cwd(), libraryDirSetting);

    const absolutePath = path.join(storageDir, version.filename);
    if (!fs.existsSync(absolutePath)) {
      throw new Error('El archivo físico del documento no se encuentra en el servidor.');
    }

    return {
      absolutePath,
      originalFilename: version.originalFilename,
      mimeType: version.mimeType
    };
  }

  private deletePhysicalFile(filename: string): void {
    try {
      const libraryDirSetting = process.env.LIBRARY_STORAGE_PATH || './uploads/library';
      const storageDir = path.isAbsolute(libraryDirSetting)
        ? libraryDirSetting
        : path.resolve(process.cwd(), libraryDirSetting);
      const filePath = path.join(storageDir, filename);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error(`Error eliminando archivo físico ${filename}:`, err);
    }
  }
}
