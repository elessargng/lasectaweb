import { parseApiResponse } from './api';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';

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

export interface LibraryDocument {
  id: string;
  sectionId: string;
  title: string;
  description?: string;
  position: number;
  createdAt: string;
  versions: LibraryDocumentVersion[];
}

export interface LibrarySection {
  id: string;
  name: string;
  parentId: string | null;
  position: number;
  createdAt: string;
  subsections?: LibrarySection[];
  documents?: LibraryDocument[];
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
  const res = await fetch(`${API_URL}/library/tree`);
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
  position?: number
): Promise<LibraryDocument> {
  const formData = new FormData();
  formData.append('sectionId', sectionId);
  formData.append('title', title);
  formData.append('label', label);
  formData.append('file', file);
  if (description) formData.append('description', description);
  if (position !== undefined) formData.append('position', position.toString());

  const res = await fetch(`${API_URL}/library/documents`, {
    method: 'POST',
    headers: getAuthHeaders(true),
    body: formData
  });
  return parseApiResponse<LibraryDocument>(res);
}

export async function updateLibraryDocument(id: string, title?: string, sectionId?: string, description?: string, position?: number): Promise<LibraryDocument> {
  const res = await fetch(`${API_URL}/library/documents/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ title, sectionId, description, position })
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

export function getLibraryVersionDownloadUrl(versionId: string): string {
  return `${API_URL}/library/versions/${versionId}/download`;
}
