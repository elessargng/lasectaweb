export interface LibrarySection {
  id: string;
  name: string;
  parentId: string | null;
  position: number;
  createdAt: string;
  subsections?: LibrarySection[];
  documents?: LibraryDocument[];
}

export interface LibraryDocument {
  id: string;
  sectionId: string;
  title: string;
  description?: string;
  position: number;
  createdAt: string;
  versions: LibraryDocumentVersion[];
}

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
}

export interface UpdateDocumentDTO {
  sectionId?: string;
  title?: string;
  description?: string;
  position?: number;
}

export interface AddVersionDTO {
  documentId: string;
  label: string;
}
