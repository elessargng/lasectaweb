export type LibraryItemType = 'document' | 'link';

export interface BaseLibraryItem {
  id: string;
  sectionId: string;
  itemType: LibraryItemType;
  title: string;
  description?: string;
  position: number;
  accessLevel?: 'all' | 'registered' | 'roles';
  allowedRoles?: string[];
  createdAt: string;
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

export type LibraryItem = LibraryDocument | LibraryLink;

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
}

export interface UpdateSectionDTO {
  name?: string;
  parentId?: string | null;
  position?: number;
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
