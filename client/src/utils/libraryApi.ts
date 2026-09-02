import { parseApiResponse } from './api';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';

export type LibraryItemType = 'document' | 'link' | 'pov_match';

export type LibraryAccessLevel = 'all' | 'registered' | 'roles';

export type CharacterType = 'demonio' | 'esbirro' | 'forastero' | 'aldeano' | 'viajero' | 'narrador';

export type InitialAlignment = 'bueno' | 'malo' | 'na';

/** Roles asignables en las restricciones de acceso de La Biblioteca */
export const LIBRARY_ASSIGNABLE_ROLES = ['narrador', 'editor', 'admin'] as const;

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
  documents?: LibraryDocument[]; // Compatibilidad
  hasSubDocuments?: boolean;
}

function getAuthHeaders(isFormData = false): HeadersInit {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

export async function fetchLibraryTree(): Promise<LibrarySection[]> {
  const res = await fetch(`${API_URL}/library/tree`, {
    headers: getAuthHeaders()
  });
  return parseApiResponse<LibrarySection[]>(res);
}

export async function createLibrarySection(
  name: string,
  parentId?: string | null,
  position?: number,
  accessLevel?: LibraryAccessLevel,
  allowedRoles?: string[],
  icon?: string | null
): Promise<LibrarySection> {
  const res = await fetch(`${API_URL}/library/sections`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ name, parentId: parentId || null, position, accessLevel, allowedRoles, icon })
  });
  return parseApiResponse<LibrarySection>(res);
}

export async function updateLibrarySection(
  id: string,
  name?: string,
  parentId?: string | null,
  position?: number,
  accessLevel?: LibraryAccessLevel,
  allowedRoles?: string[],
  icon?: string | null
): Promise<LibrarySection> {
  const res = await fetch(`${API_URL}/library/sections/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ name, parentId, position, accessLevel, allowedRoles, icon })
  });
  return parseApiResponse<LibrarySection>(res);
}

export async function deleteLibrarySection(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/library/sections/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  await parseApiResponse(res);
}

export async function createLibraryDocument(
  sectionId: string,
  title: string,
  label: string,
  file: File,
  description?: string,
  position?: number,
  accessLevel?: 'all' | 'registered' | 'roles',
  allowedRoles?: string[]
): Promise<LibraryDocument> {
  const formData = new FormData();
  formData.append('sectionId', sectionId);
  formData.append('title', title);
  formData.append('label', label);
  formData.append('file', file);
  if (description) formData.append('description', description);
  if (position !== undefined) formData.append('position', position.toString());
  if (accessLevel) formData.append('accessLevel', accessLevel);
  if (allowedRoles) formData.append('allowedRoles', JSON.stringify(allowedRoles));

  const res = await fetch(`${API_URL}/library/documents`, {
    method: 'POST',
    headers: getAuthHeaders(true),
    body: formData
  });
  return parseApiResponse<LibraryDocument>(res);
}

export async function updateLibraryDocument(
  id: string,
  title?: string,
  sectionId?: string,
  description?: string,
  position?: number,
  accessLevel?: 'all' | 'registered' | 'roles',
  allowedRoles?: string[]
): Promise<LibraryDocument> {
  const res = await fetch(`${API_URL}/library/documents/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ title, sectionId, description, position, accessLevel, allowedRoles })
  });
  return parseApiResponse<LibraryDocument>(res);
}

export async function deleteLibraryDocument(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/library/documents/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  await parseApiResponse(res);
}

export async function createLibraryLink(
  sectionId: string,
  title: string,
  url: string,
  description?: string,
  position?: number,
  accessLevel?: 'all' | 'registered' | 'roles',
  allowedRoles?: string[]
): Promise<LibraryLink> {
  const res = await fetch(`${API_URL}/library/links`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ sectionId, title, url, description, position, accessLevel, allowedRoles })
  });
  return parseApiResponse<LibraryLink>(res);
}

export async function updateLibraryLink(
  id: string,
  title?: string,
  url?: string,
  sectionId?: string,
  description?: string,
  position?: number,
  accessLevel?: 'all' | 'registered' | 'roles',
  allowedRoles?: string[]
): Promise<LibraryLink> {
  const res = await fetch(`${API_URL}/library/links/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ title, url, sectionId, description, position, accessLevel, allowedRoles })
  });
  return parseApiResponse<LibraryLink>(res);
}

export async function deleteLibraryLink(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/library/links/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  await parseApiResponse(res);
}

export async function fetchLibraryPovMatchById(id: string): Promise<LibraryPovMatch> {
  const res = await fetch(`${API_URL}/library/pov-matches/${id}`, {
    headers: getAuthHeaders()
  });
  return parseApiResponse<LibraryPovMatch>(res);
}

export async function createLibraryPovMatch(dto: CreatePovMatchDTO): Promise<LibraryPovMatch> {
  const res = await fetch(`${API_URL}/library/pov-matches`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(dto)
  });
  return parseApiResponse<LibraryPovMatch>(res);
}

export async function updateLibraryPovMatch(id: string, dto: UpdatePovMatchDTO): Promise<LibraryPovMatch> {
  const res = await fetch(`${API_URL}/library/pov-matches/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(dto)
  });
  return parseApiResponse<LibraryPovMatch>(res);
}

export async function deleteLibraryPovMatch(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/library/pov-matches/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  await parseApiResponse(res);
}

export function extractYoutubeVideoId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export async function addLibraryDocumentVersion(documentId: string, label: string, file: File): Promise<LibraryDocumentVersion> {
  const formData = new FormData();
  formData.append('label', label);
  formData.append('file', file);

  const res = await fetch(`${API_URL}/library/documents/${documentId}/versions`, {
    method: 'POST',
    headers: getAuthHeaders(true),
    body: formData
  });
  return parseApiResponse<LibraryDocumentVersion>(res);
}

export async function deleteLibraryDocumentVersion(versionId: string): Promise<void> {
  const res = await fetch(`${API_URL}/library/versions/${versionId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  await parseApiResponse(res);
}

export function getLibraryVersionDownloadUrl(
  versionOrId: string | { id: string; originalFilename?: string },
  inline = false,
  includeToken = true,
  filename?: string
): string {
  let id: string;
  let name: string | undefined = filename;

  if (typeof versionOrId === 'object' && versionOrId !== null) {
    id = versionOrId.id;
    name = name || versionOrId.originalFilename;
  } else {
    id = versionOrId;
  }

  const token = localStorage.getItem('token');
  const queryParams: string[] = [];
  if (includeToken && token) {
    queryParams.push(`token=${encodeURIComponent(token)}`);
  }
  if (inline) {
    queryParams.push('inline=true');
  }
  const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
  const pathFilename = name ? `/${encodeURIComponent(name)}` : '';
  return `${API_URL}/library/versions/${id}/download${pathFilename}${queryString}`;
}

export type ViewableType = 'pdf' | 'html' | 'txt' | 'image' | null;

export function getViewableType(version: LibraryDocumentVersion): ViewableType {
  const mime = (version.mimeType || '').toLowerCase();
  const ext = (version.originalFilename || '').split('.').pop()?.toLowerCase() || '';

  if (mime === 'application/pdf' || ext === 'pdf') {
    return 'pdf';
  }
  if (mime === 'text/html' || mime === 'application/xhtml+xml' || ext === 'html' || ext === 'htm') {
    return 'html';
  }
  if (
    mime.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico'].includes(ext)
  ) {
    return 'image';
  }
  if (
    mime.startsWith('text/') ||
    ['txt', 'text', 'md', 'markdown', 'log', 'json', 'csv', 'xml'].includes(ext)
  ) {
    return 'txt';
  }

  return null;
}
