export type LibraryItemType = 'document' | 'link' | 'pov_match';

export type LibraryAccessLevel = 'all' | 'registered' | 'roles';

export type CharacterType = 'demonio' | 'esbirro' | 'forastero' | 'aldeano' | 'viajero' | 'narrador';

export type InitialAlignment = 'bueno' | 'malo' | 'na';

export interface BaseLibraryItem {
  id: string;
  sectionId: string;
  itemType: LibraryItemType;
  title: string;
  description?: string;
  position: number;
  accessLevel?: LibraryAccessLevel;
  allowedRoles?: string[];
  createdAt: string;
}

export interface LibraryPov {
  id: string;
  matchId: string;
  name: string;
  sectaUserId?: string | null;
  initialAlignment: InitialAlignment;
  character: string;
  characterType: CharacterType;
  youtubeUrl: string;
  youtubeId?: string | null;
  position: number;
}

export interface LibraryDocument extends BaseLibraryItem {
  itemType: 'document';
  versions: LibraryDocumentVersion[];
}

export interface LibraryLink extends BaseLibraryItem {
  itemType: 'link';
  url: string;
  linkType: 'normal' | 'youtube';
  thumbnailUrl?: string;
}

export interface LibraryPovMatch extends BaseLibraryItem {
  itemType: 'pov_match';
  povs: LibraryPov[];
}

export type LibraryItem = LibraryDocument | LibraryLink | LibraryPovMatch;

export interface LibraryDocumentVersion {
  id: string;
  documentId: string;
  label: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
}

export interface LibrarySection {
  id: string;
  name: string;
  parentId: string | null;
  position: number;
  icon?: string | null;
  accessLevel?: LibraryAccessLevel;
  allowedRoles?: string[];
  createdAt: string;
  subsections?: LibrarySection[];
  items?: LibraryItem[];
  documents?: LibraryDocument[]; // Mantenido para compatibilidad
  hasSubDocuments?: boolean;
}

export interface CreateSectionDTO {
  name: string;
  parentId?: string | null;
  position?: number;
  icon?: string | null;
  accessLevel?: LibraryAccessLevel;
  allowedRoles?: string[];
}

export interface UpdateSectionDTO {
  name?: string;
  parentId?: string | null;
  position?: number;
  icon?: string | null;
  accessLevel?: LibraryAccessLevel;
  allowedRoles?: string[];
}

export interface CreateDocumentDTO {
  sectionId: string;
  title: string;
  description?: string;
  position?: number;
  label: string;
  accessLevel?: 'all' | 'registered' | 'roles';
  allowedRoles?: string[];
}

export interface UpdateDocumentDTO {
  sectionId?: string;
  title?: string;
  description?: string;
  position?: number;
  accessLevel?: 'all' | 'registered' | 'roles';
  allowedRoles?: string[];
}

export interface CreateLinkDTO {
  sectionId: string;
  title: string;
  url: string;
  description?: string;
  position?: number;
  accessLevel?: 'all' | 'registered' | 'roles';
  allowedRoles?: string[];
}

export interface UpdateLinkDTO {
  sectionId?: string;
  title?: string;
  url?: string;
  description?: string;
  position?: number;
  accessLevel?: 'all' | 'registered' | 'roles';
  allowedRoles?: string[];
}

export interface AddVersionDTO {
  documentId: string;
  label: string;
}

export interface PovInputDTO {
  id?: string;
  name: string;
  sectaUserId?: string | null;
  initialAlignment: InitialAlignment;
  character: string;
  characterType: CharacterType;
  youtubeUrl: string;
  position?: number;
}

export interface CreatePovMatchDTO {
  sectionId: string;
  title: string;
  description?: string;
  position?: number;
  accessLevel?: LibraryAccessLevel;
  allowedRoles?: string[];
  povs: PovInputDTO[];
}

export interface UpdatePovMatchDTO {
  sectionId?: string;
  title?: string;
  description?: string;
  position?: number;
  accessLevel?: LibraryAccessLevel;
  allowedRoles?: string[];
  povs?: PovInputDTO[];
}
