import { parseApiResponse } from './api';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';

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

export type LibraryItem = LibraryDocument | LibraryLink;

export interface LibrarySection {
  id: string;
  name: string;
  parentId: string | null;
  position: number;
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

export async function createLibrarySection(name: string, parentId?: string | null, position?: number): Promise<LibrarySection> {
  const res = await fetch(`${API_URL}/library/sections`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ name, parentId: parentId || null, position })
  });
  return parseApiResponse<LibrarySection>(res);
}

export async function updateLibrarySection(id: string, name?: string, parentId?: string | null, position?: number): Promise<LibrarySection> {
  const res = await fetch(`${API_URL}/library/sections/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ name, parentId, position })
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

export function getLibraryVersionDownloadUrl(versionId: string, inline = false): string {
  const token = localStorage.getItem('token');
  const queryParams: string[] = [];
  if (token) {
    queryParams.push(`token=${encodeURIComponent(token)}`);
  }
  if (inline) {
    queryParams.push('inline=true');
  }
  const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
  return `${API_URL}/library/versions/${versionId}/download${queryString}`;
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
