import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { LibraryRepository } from '../repositories/LibraryRepository';
import { UserRepository } from '../repositories/UserRepository';
import {
  LibrarySection,
  LibraryDocument,
  LibraryLink,
  LibraryPovMatch,
  LibraryPov,
  LibraryItem,
  BaseLibraryItem,
  LibraryDocumentVersion,
  CreateSectionDTO,
  UpdateSectionDTO,
  CreateDocumentDTO,
  UpdateDocumentDTO,
  CreateLinkDTO,
  UpdateLinkDTO,
  CreatePovMatchDTO,
  UpdatePovMatchDTO,
  PovInputDTO
} from '../types/library';
import { AccessContext, canAccess } from '../utils/libraryAccess';

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

  public extractYoutubeVideoId(url: string): string | null {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  }

  private parseYoutubeInfo(url: string): { isYoutube: boolean; linkType: 'normal' | 'youtube'; thumbnailUrl?: string } {
    const isYoutube = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(url);
    if (!isYoutube) {
      return { isYoutube: false, linkType: 'normal' };
    }

    const videoId = this.extractYoutubeVideoId(url);
    const thumbnailUrl = videoId
      ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
      : undefined;

    return {
      isYoutube: true,
      linkType: 'youtube',
      thumbnailUrl
    };
  }

  private async buildAccessContext(userId?: string): Promise<AccessContext> {
    const user = userId ? await this.userRepository.findById(userId) : null;
    return {
      isAuthenticated: !!user,
      isAdmin: user?.roles?.includes('admin') || false,
      roles: user?.roles || []
    };
  }

  /**
   * Devuelve el conjunto de secciones visibles aplicando cascada restrictiva:
   * una sección solo es visible si ella y todos sus ancestros lo son.
   */
  private getVisibleSectionIds(sections: LibrarySection[], ctx: AccessContext): Set<string> {
    const sectionById = new Map(sections.map(s => [s.id, s]));
    const visible = new Set<string>();
    const resolved = new Map<string, boolean>();

    const isVisible = (id: string, seen: Set<string>): boolean => {
      if (resolved.has(id)) return resolved.get(id)!;
      // Protección frente a ciclos de parentId en datos corruptos
      if (seen.has(id)) return false;
      seen.add(id);

      const section = sectionById.get(id);
      if (!section) return false;

      let result = canAccess(section, ctx);
      if (result && section.parentId && sectionById.has(section.parentId)) {
        result = isVisible(section.parentId, seen);
      }

      resolved.set(id, result);
      return result;
    };

    for (const sec of sections) {
      if (isVisible(sec.id, new Set())) {
        visible.add(sec.id);
      }
    }

    return visible;
  }

  public async getTree(userId?: string): Promise<LibrarySection[]> {
    const ctx = await this.buildAccessContext(userId);

    const allRawSections = await this.libraryRepository.getAllSections();
    const rawItems = await this.libraryRepository.getAllRawItems();
    const rawLinks = await this.libraryRepository.getAllLinks();
    const rawPovMatches = await this.libraryRepository.getAllPovMatches();
    const rawVersions = await this.libraryRepository.getAllVersions();

    const linkMap = new Map<string, LibraryLink>();
    for (const link of rawLinks) {
      linkMap.set(link.id, link);
    }

    const povMatchMap = new Map<string, LibraryPovMatch>();
    for (const match of rawPovMatches) {
      povMatchMap.set(match.id, match);
    }

    // Filtrar secciones (carpetas) en cascada: si no ves la carpeta, no ves nada debajo
    const visibleSectionIds = this.getVisibleSectionIds(allRawSections, ctx);
    const rawSections = allRawSections.filter(s => visibleSectionIds.has(s.id));

    // Filtrar items según control de acceso del usuario y de su carpeta contenedora
    const allowedRawItems = rawItems.filter(
      item => visibleSectionIds.has(item.sectionId) && canAccess(item, ctx)
    );

    // Construir objetos polimórficos LibraryItem (LibraryDocument | LibraryLink | LibraryPovMatch)
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
      } else if (raw.itemType === 'pov_match') {
        const fullMatch = povMatchMap.get(raw.id);
        if (fullMatch) {
          polymorphicItems.push(fullMatch);
        } else {
          polymorphicItems.push({
            ...raw,
            itemType: 'pov_match',
            povs: []
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
    const accessLevel = dto.accessLevel || 'all';
    const allowedRoles = accessLevel === 'roles' ? (dto.allowedRoles || []) : [];

    return this.libraryRepository.createSection(
      id,
      dto.name.trim(),
      dto.parentId || null,
      position,
      accessLevel,
      allowedRoles,
      dto.icon ? dto.icon.trim() : null
    );
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

    // Si se pasa a un nivel distinto de 'roles', los roles dejan de tener sentido
    const allowedRoles = dto.accessLevel !== undefined && dto.accessLevel !== 'roles'
      ? []
      : dto.allowedRoles;

    const updated = await this.libraryRepository.updateSection(
      id,
      dto.name?.trim(),
      dto.parentId,
      dto.position,
      dto.accessLevel,
      allowedRoles,
      dto.icon === undefined ? undefined : (dto.icon ? dto.icon.trim() : null)
    );
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

  // --- GESTIÓN DE PARTIDAS POV ---
  public async getPovMatchById(id: string, userId?: string): Promise<LibraryPovMatch> {
    const match = await this.libraryRepository.getPovMatchById(id);
    if (!match) {
      throw new Error('La partida POV especificada no existe.');
    }

    const ctx = await this.buildAccessContext(userId);
    if (!canAccess(match, ctx)) {
      throw new Error(
        ctx.isAuthenticated
          ? 'No tienes permisos suficientes para acceder a esta partida POV.'
          : 'No tienes permisos suficientes para acceder a esta partida POV. Debes iniciar sesión.'
      );
    }

    const allSections = await this.libraryRepository.getAllSections();
    const visibleSectionIds = this.getVisibleSectionIds(allSections, ctx);
    if (!visibleSectionIds.has(match.sectionId)) {
      throw new Error(
        ctx.isAuthenticated
          ? 'No tienes permisos suficientes para acceder a la carpeta que contiene esta partida.'
          : 'No tienes permisos suficientes para acceder a esta partida. Debes iniciar sesión.'
      );
    }

    return match;
  }

  public async createPovMatch(userId: string, dto: CreatePovMatchDTO): Promise<LibraryPovMatch> {
    await this.verifyAdmin(userId);

    if (!dto.title || dto.title.trim() === '') {
      throw new Error('El título de la partida POV es obligatorio.');
    }
    if (!dto.sectionId) {
      throw new Error('Debe especificar una sección para la partida POV.');
    }

    const section = await this.libraryRepository.getSectionById(dto.sectionId);
    if (!section) {
      throw new Error('La sección especificada no existe.');
    }

    const matchId = crypto.randomUUID();
    const position = dto.position ?? 0;

    const formattedPovs = (dto.povs || []).map((p, index) => {
      if (!p.name || p.name.trim() === '') {
        throw new Error(`El nombre del jugador en el POV #${index + 1} es obligatorio.`);
      }
      if (!p.character || p.character.trim() === '') {
        throw new Error(`El personaje en el POV #${index + 1} es obligatorio.`);
      }
      if (!p.youtubeUrl || p.youtubeUrl.trim() === '') {
        throw new Error(`El enlace de YouTube en el POV #${index + 1} es obligatorio.`);
      }

      return {
        id: p.id || crypto.randomUUID(),
        name: p.name.trim(),
        sectaUserId: p.sectaUserId || null,
        initialAlignment: p.initialAlignment || 'bueno',
        character: p.character.trim(),
        characterType: p.characterType || 'aldeano',
        youtubeUrl: p.youtubeUrl.trim(),
        youtubeId: this.extractYoutubeVideoId(p.youtubeUrl.trim()),
        position: p.position !== undefined ? p.position : index
      };
    });

    return this.libraryRepository.createPovMatch(
      matchId,
      dto.sectionId,
      dto.title.trim(),
      dto.description,
      position,
      dto.accessLevel || 'all',
      dto.allowedRoles || [],
      formattedPovs
    );
  }

  public async updatePovMatch(userId: string, id: string, dto: UpdatePovMatchDTO): Promise<LibraryPovMatch> {
    await this.verifyAdmin(userId);

    const currentMatch = await this.libraryRepository.getPovMatchById(id);
    if (!currentMatch) {
      throw new Error('La partida POV especificada no existe.');
    }

    if (dto.sectionId) {
      const section = await this.libraryRepository.getSectionById(dto.sectionId);
      if (!section) {
        throw new Error('La sección especificada no existe.');
      }
    }

    let formattedPovs: Array<{
      id: string;
      name: string;
      sectaUserId?: string | null;
      initialAlignment: any;
      character: string;
      characterType: any;
      youtubeUrl: string;
      youtubeId?: string | null;
      position: number;
    }> | undefined = undefined;

    if (dto.povs !== undefined) {
      formattedPovs = dto.povs.map((p, index) => {
        if (!p.name || p.name.trim() === '') {
          throw new Error(`El nombre del jugador en el POV #${index + 1} es obligatorio.`);
        }
        if (!p.character || p.character.trim() === '') {
          throw new Error(`El personaje en el POV #${index + 1} es obligatorio.`);
        }
        if (!p.youtubeUrl || p.youtubeUrl.trim() === '') {
          throw new Error(`El enlace de YouTube en el POV #${index + 1} es obligatorio.`);
        }

        return {
          id: p.id || crypto.randomUUID(),
          name: p.name.trim(),
          sectaUserId: p.sectaUserId || null,
          initialAlignment: p.initialAlignment || 'bueno',
          character: p.character.trim(),
          characterType: p.characterType || 'aldeano',
          youtubeUrl: p.youtubeUrl.trim(),
          youtubeId: this.extractYoutubeVideoId(p.youtubeUrl.trim()),
          position: p.position !== undefined ? p.position : index
        };
      });
    }

    const updated = await this.libraryRepository.updatePovMatch(
      id,
      dto.sectionId,
      dto.title?.trim(),
      dto.description,
      dto.position,
      dto.accessLevel,
      dto.allowedRoles,
      formattedPovs
    );

    if (!updated) {
      throw new Error('No se pudo actualizar la partida POV.');
    }
    return updated;
  }

  public async deletePovMatch(userId: string, id: string): Promise<boolean> {
    await this.verifyAdmin(userId);

    const match = await this.libraryRepository.getPovMatchById(id);
    if (!match) {
      throw new Error('La partida POV especificada no existe.');
    }

    return this.libraryRepository.deletePovMatch(id);
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

    const ctx = await this.buildAccessContext(userId);

    if (!canAccess(doc, ctx)) {
      throw new Error(
        ctx.isAuthenticated
          ? 'No tienes permisos suficientes para descargar este documento.'
          : 'No tienes permisos suficientes para descargar este documento. Debes iniciar sesión.'
      );
    }

    // Cascada restrictiva: la carpeta contenedora y sus ancestros también deben ser visibles
    const allSections = await this.libraryRepository.getAllSections();
    const visibleSectionIds = this.getVisibleSectionIds(allSections, ctx);
    if (!visibleSectionIds.has(doc.sectionId)) {
      throw new Error(
        ctx.isAuthenticated
          ? 'No tienes permisos suficientes para acceder a la carpeta que contiene este documento.'
          : 'No tienes permisos suficientes para acceder a este documento. Debes iniciar sesión.'
      );
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
