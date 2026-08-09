import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { LibraryRepository } from '../repositories/LibraryRepository';
import { UserRepository } from '../repositories/UserRepository';
import { LibrarySection, LibraryDocument, LibraryDocumentVersion, CreateSectionDTO, UpdateSectionDTO, CreateDocumentDTO, UpdateDocumentDTO } from '../types/library';

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

  public async getTree(userId?: string): Promise<LibrarySection[]> {
    const user = userId ? await this.userRepository.findById(userId) : null;
    const isAdmin = user?.roles?.includes('admin') || false;
    const userRoles = user?.roles || [];

    const rawSections = await this.libraryRepository.getAllSections();
    const rawDocs = await this.libraryRepository.getAllDocuments();
    const rawVersions = await this.libraryRepository.getAllVersions();

    // Filtramos documentos según el acceso del usuario
    const allowedDocs = rawDocs.filter(doc => {
      // Si el usuario es administrador, puede ver todo
      if (isAdmin) return true;

      // Determinamos el nivel de acceso del documento (por defecto es 'all')
      const accessLevel = doc.accessLevel || 'all';

      if (accessLevel === 'all') {
        return true;
      }
      
      if (accessLevel === 'registered') {
        // Solo usuarios registrados
        return !!user;
      }

      if (accessLevel === 'roles') {
        // Solo usuarios con alguno de los roles permitidos
        const allowed = doc.allowedRoles || [];
        return !!user && (allowed.length === 0 || allowed.some(role => userRoles.includes(role as any)));
      }

      return false;
    });

    // Asociar versiones a sus documentos correspondientes
    const docMap = new Map<string, LibraryDocument>();
    for (const doc of allowedDocs) {
      const docVersions = rawVersions.filter(v => v.documentId === doc.id);
      docMap.set(doc.id, { ...doc, versions: docVersions });
    }

    // Agrupar documentos por id de sección
    const docsBySection = new Map<string, LibraryDocument[]>();
    for (const doc of docMap.values()) {
      if (!docsBySection.has(doc.sectionId)) {
        docsBySection.set(doc.sectionId, []);
      }
      docsBySection.get(doc.sectionId)!.push(doc);
    }

    // Mapa de secciones enriquecidas
    const sectionMap = new Map<string, LibrarySection & { hasSubDocuments: boolean }>();
    for (const sec of rawSections) {
      const docsInSec = docsBySection.get(sec.id) || [];
      sectionMap.set(sec.id, {
        ...sec,
        documents: docsInSec,
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

    // Determinar recursivamente si tiene documentos visibles
    const checkHasSubDocs = (sec: LibrarySection & { hasSubDocuments: boolean }): boolean => {
      let hasDocs = (sec.documents && sec.documents.length > 0) || false;
      if (sec.subsections) {
        for (const sub of sec.subsections as (LibrarySection & { hasSubDocuments: boolean })[]) {
          if (checkHasSubDocs(sub)) {
            hasDocs = true;
          }
        }
      }
      sec.hasSubDocuments = hasDocs;
      return hasDocs;
    };

    for (const root of rootSections) {
      checkHasSubDocs(root);
    }

    return rootSections;
  }

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

    // REGLA CRÍTICA: No se puede borrar una sección/subtítulo si contiene documentos bajo ella
    const subDocCount = await this.libraryRepository.countSubDocuments(id);
    if (subDocCount > 0) {
      throw new Error('No se puede borrar una sección o subtítulo que contenga documentos bajo ella.');
    }

    return this.libraryRepository.deleteSection(id);
  }

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

    const doc = await this.libraryRepository.createDocument(
      docId,
      dto.sectionId,
      dto.title.trim(),
      dto.description,
      position,
      dto.accessLevel || 'all',
      dto.allowedRoles || []
    );

    // Crear primera versión del documento
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

    // Eliminar archivos físicos en disco
    for (const v of doc.versions) {
      this.deletePhysicalFile(v.filename);
    }

    return this.libraryRepository.deleteDocument(id);
  }

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

    // Borrar archivo del disco
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

    // Comprobar nivel de acceso del documento
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
