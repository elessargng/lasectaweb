import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  fetchLibraryTree,
  createLibrarySection,
  updateLibrarySection,
  deleteLibrarySection,
  createLibraryDocument,
  updateLibraryDocument,
  deleteLibraryDocument,
  createLibraryLink,
  updateLibraryLink,
  deleteLibraryLink,
  addLibraryDocumentVersion,
  deleteLibraryDocumentVersion,
  getLibraryVersionDownloadUrl,
  getViewableType,
  type LibrarySection,
  type LibraryDocument,
  type LibraryLink,
  type LibraryItem,
  type LibraryDocumentVersion
} from '../utils/libraryApi';
import {
  BookOpen,
  Folder,
  FolderPlus,
  FileText,
  FilePlus,
  Pencil,
  Trash2,
  Download,
  ChevronRight,
  ChevronDown,
  Plus,
  Move,
  X,
  AlertCircle,
  CheckCircle,
  Loader2,
  Tag,
  Lock,
  Globe,
  Shield,
  Eye,
  FileCode,
  FileImage,
  ExternalLink,
  Link as LinkIcon
} from 'lucide-react';

import Button from '../components/Button';
import PageHeader from '../components/PageHeader';
import Cita from '../components/Cita';

const Youtube = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

export default function Biblioteca() {
  const { user } = useAuth();
  const isAdmin = !!user?.roles?.includes('admin');

  const [tree, setTree] = useState<LibrarySection[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Secciones expandidas
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Modales
  const [sectionModal, setSectionModal] = useState<{
    isOpen: boolean;
    mode: 'create_title' | 'create_subtitle' | 'edit';
    sectionId?: string;
    parentId?: string | null;
    currentName?: string;
  }>({ isOpen: false, mode: 'create_title' });

  const [documentModal, setDocumentModal] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    sectionId?: string;
    documentId?: string;
    currentTitle?: string;
    currentDesc?: string;
    currentAccessLevel?: 'all' | 'registered' | 'roles';
    currentAllowedRoles?: string[];
  }>({ isOpen: false, mode: 'create' });

  const [linkModal, setLinkModal] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    sectionId?: string;
    linkId?: string;
    currentTitle?: string;
    currentUrl?: string;
    currentDesc?: string;
    currentAccessLevel?: 'all' | 'registered' | 'roles';
    currentAllowedRoles?: string[];
  }>({ isOpen: false, mode: 'create' });

  const [addVersionModal, setAddVersionModal] = useState<{
    isOpen: boolean;
    documentId: string;
    documentTitle: string;
  }>({ isOpen: false, documentId: '', documentTitle: '' });

  const [moveModal, setMoveModal] = useState<{
    isOpen: boolean;
    type: 'section' | 'document';
    id: string;
    name: string;
    currentTargetId?: string | null;
  }>({ isOpen: false, type: 'section', id: '', name: '' });

  // State del Visor de Documentos
  const [viewerModal, setViewerModal] = useState<{
    isOpen: boolean;
    version?: LibraryDocumentVersion;
    documentTitle?: string;
  }>({ isOpen: false });

  const [txtContent, setTxtContent] = useState<string | null>(null);
  const [loadingTxt, setLoadingTxt] = useState<boolean>(false);
  const [txtError, setTxtError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(
        window.innerWidth < 768 || 
        /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      );
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (viewerModal.isOpen && viewerModal.version) {
      const type = getViewableType(viewerModal.version);
      if (type === 'txt') {
        setLoadingTxt(true);
        setTxtError(null);
        setTxtContent(null);
        const url = getLibraryVersionDownloadUrl(viewerModal.version.id, true);
        fetch(url)
          .then(res => {
            if (!res.ok) throw new Error('Error al cargar el contenido de texto.');
            return res.text();
          })
          .then(text => setTxtContent(text))
          .catch(err => setTxtError(err.message || 'Error al obtener el contenido del archivo.'))
          .finally(() => setLoadingTxt(false));
      }
    }
  }, [viewerModal.isOpen, viewerModal.version]);

  const handleVersionClick = (version: LibraryDocumentVersion, docTitle: string, e: React.MouseEvent) => {
    const viewType = getViewableType(version);
    if (viewType) {
      e.preventDefault();
      setViewerModal({
        isOpen: true,
        version,
        documentTitle: docTitle
      });
    }
  };

  const formatBytes = (bytes: number, decimals = 1): string => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Form State para Sección
  const [sectionNameInput, setSectionNameInput] = useState('');
  const [sectionParentIdInput, setSectionParentIdInput] = useState<string>('');
  
  // Form State para Documento
  const [docTitleInput, setDocTitleInput] = useState('');
  const [docDescInput, setDocDescInput] = useState('');
  const [docSectionIdInput, setDocSectionIdInput] = useState('');
  const [docVersionLabelInput, setDocVersionLabelInput] = useState('PDF');
  const [docFileInput, setDocFileInput] = useState<File | null>(null);
  const [docAccessLevelInput, setDocAccessLevelInput] = useState<'all' | 'registered' | 'roles'>('all');
  const [docAllowedRolesInput, setDocAllowedRolesInput] = useState<string[]>([]);

  // Form State para Enlace
  const [linkTitleInput, setLinkTitleInput] = useState('');
  const [linkUrlInput, setLinkUrlInput] = useState('');
  const [linkDescInput, setLinkDescInput] = useState('');
  const [linkSectionIdInput, setLinkSectionIdInput] = useState('');
  const [linkAccessLevelInput, setLinkAccessLevelInput] = useState<'all' | 'registered' | 'roles'>('all');
  const [linkAllowedRolesInput, setLinkAllowedRolesInput] = useState<string[]>([]);

  // Form State para Versión & Mover
  const [versionLabelInput, setVersionLabelInput] = useState('');
  const [versionFileInput, setVersionFileInput] = useState<File | null>(null);

  const [moveTargetIdInput, setMoveTargetIdInput] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadTree();
  }, []);

  const loadTree = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchLibraryTree();
      setTree(data);

      const initialExpanded: Record<string, boolean> = {};
      data.forEach(sec => {
        initialExpanded[sec.id] = true;
        if (sec.subsections) {
          sec.subsections.forEach(sub => {
            initialExpanded[sub.id] = true;
          });
        }
      });
      setExpandedSections(prev => ({ ...initialExpanded, ...prev }));
    } catch (err: any) {
      setError(err.message || 'Error al cargar los documentos de La Biblioteca.');
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const toggleSection = (id: string) => {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getAllSectionsFlat = (sections: LibrarySection[], depth = 0): { id: string; name: string; depth: number }[] => {
    let result: { id: string; name: string; depth: number }[] = [];
    for (const sec of sections) {
      result.push({ id: sec.id, name: sec.name, depth });
      if (sec.subsections && sec.subsections.length > 0) {
        result = result.concat(getAllSectionsFlat(sec.subsections, depth + 1));
      }
    }
    return result;
  };

  const flatSectionsList = getAllSectionsFlat(tree);

  // --- SECCIÓN HANDLERS ---
  const handleOpenCreateTitle = () => {
    setSectionNameInput('');
    setSectionParentIdInput('');
    setSectionModal({ isOpen: true, mode: 'create_title' });
  };

  const handleOpenCreateSubtitle = (parentId: string) => {
    setSectionNameInput('');
    setSectionParentIdInput(parentId);
    setSectionModal({ isOpen: true, mode: 'create_subtitle', parentId });
  };

  const handleOpenEditSection = (section: LibrarySection) => {
    setSectionNameInput(section.name);
    setSectionParentIdInput(section.parentId || '');
    setSectionModal({ isOpen: true, mode: 'edit', sectionId: section.id, currentName: section.name, parentId: section.parentId });
  };

  const handleSaveSection = async (e: FormEvent) => {
    e.preventDefault();
    if (!sectionNameInput.trim()) return;

    try {
      setSubmitting(true);
      if (sectionModal.mode === 'create_title' || sectionModal.mode === 'create_subtitle') {
        const parentId = sectionModal.mode === 'create_subtitle' ? sectionModal.parentId : (sectionParentIdInput || null);
        await createLibrarySection(sectionNameInput.trim(), parentId);
        showSuccess('Sección creada con éxito.');
      } else if (sectionModal.mode === 'edit' && sectionModal.sectionId) {
        await updateLibrarySection(sectionModal.sectionId, sectionNameInput.trim());
        showSuccess('Sección actualizada con éxito.');
      }
      setSectionModal({ isOpen: false, mode: 'create_title' });
      await loadTree();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSection = async (section: LibrarySection) => {
    if (section.hasSubDocuments) {
      alert('No se puede eliminar una sección que contenga elementos colgados bajo ella en cualquier nivel.');
      return;
    }

    if (!confirm(`¿Estás seguro de que deseas eliminar la sección "${section.name}"?`)) {
      return;
    }

    try {
      setLoading(true);
      await deleteLibrarySection(section.id);
      showSuccess(`La sección "${section.name}" ha sido eliminada.`);
      await loadTree();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- DOCUMENTO HANDLERS ---
  const handleOpenCreateDocument = (sectionId: string) => {
    setDocTitleInput('');
    setDocDescInput('');
    setDocSectionIdInput(sectionId);
    setDocVersionLabelInput('PDF');
    setDocFileInput(null);
    setDocAccessLevelInput('all');
    setDocAllowedRolesInput([]);
    setDocumentModal({ isOpen: true, mode: 'create', sectionId });
  };

  const handleOpenEditDocument = (doc: LibraryDocument) => {
    setDocTitleInput(doc.title);
    setDocDescInput(doc.description || '');
    setDocSectionIdInput(doc.sectionId);
    setDocAccessLevelInput(doc.accessLevel || 'all');
    setDocAllowedRolesInput(doc.allowedRoles || []);
    setDocumentModal({
      isOpen: true,
      mode: 'edit',
      documentId: doc.id,
      sectionId: doc.sectionId,
      currentTitle: doc.title,
      currentDesc: doc.description,
      currentAccessLevel: doc.accessLevel || 'all',
      currentAllowedRoles: doc.allowedRoles || []
    });
  };

  const handleSaveDocument = async (e: FormEvent) => {
    e.preventDefault();
    if (!docTitleInput.trim()) return;

    try {
      setSubmitting(true);
      if (documentModal.mode === 'create') {
        if (!docFileInput) {
          setError('Debes seleccionar un archivo para el documento.');
          setSubmitting(false);
          return;
        }
        await createLibraryDocument(
          documentModal.sectionId!,
          docTitleInput.trim(),
          docVersionLabelInput.trim() || 'PDF',
          docFileInput,
          docDescInput.trim() || undefined,
          undefined,
          docAccessLevelInput,
          docAccessLevelInput === 'roles' ? docAllowedRolesInput : []
        );
        showSuccess('Documento y versión subidos correctamente.');
      } else if (documentModal.mode === 'edit' && documentModal.documentId) {
        await updateLibraryDocument(
          documentModal.documentId,
          docTitleInput.trim(),
          docSectionIdInput,
          docDescInput.trim() || undefined,
          undefined,
          docAccessLevelInput,
          docAccessLevelInput === 'roles' ? docAllowedRolesInput : []
        );
        showSuccess('Documento actualizado correctamente.');
      }
      setDocumentModal({ isOpen: false, mode: 'create' });
      await loadTree();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDocument = async (doc: LibraryDocument) => {
    if (!confirm(`¿Estás seguro de eliminar el documento "${doc.title}" y todas sus versiones asociadas?`)) {
      return;
    }

    try {
      setLoading(true);
      await deleteLibraryDocument(doc.id);
      showSuccess(`El documento "${doc.title}" ha sido eliminado.`);
      await loadTree();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- ENLACE HANDLERS ---
  const handleOpenCreateLink = (sectionId: string) => {
    setLinkTitleInput('');
    setLinkUrlInput('');
    setLinkDescInput('');
    setLinkSectionIdInput(sectionId);
    setLinkAccessLevelInput('all');
    setLinkAllowedRolesInput([]);
    setLinkModal({ isOpen: true, mode: 'create', sectionId });
  };

  const handleOpenEditLink = (link: LibraryLink) => {
    setLinkTitleInput(link.title);
    setLinkUrlInput(link.url);
    setLinkDescInput(link.description || '');
    setLinkSectionIdInput(link.sectionId);
    setLinkAccessLevelInput(link.accessLevel || 'all');
    setLinkAllowedRolesInput(link.allowedRoles || []);
    setLinkModal({
      isOpen: true,
      mode: 'edit',
      linkId: link.id,
      sectionId: link.sectionId,
      currentTitle: link.title,
      currentUrl: link.url,
      currentDesc: link.description,
      currentAccessLevel: link.accessLevel || 'all',
      currentAllowedRoles: link.allowedRoles || []
    });
  };

  const handleSaveLink = async (e: FormEvent) => {
    e.preventDefault();
    if (!linkTitleInput.trim() || !linkUrlInput.trim()) return;

    try {
      setSubmitting(true);
      if (linkModal.mode === 'create') {
        await createLibraryLink(
          linkModal.sectionId!,
          linkTitleInput.trim(),
          linkUrlInput.trim(),
          linkDescInput.trim() || undefined,
          undefined,
          linkAccessLevelInput,
          linkAccessLevelInput === 'roles' ? linkAllowedRolesInput : []
        );
        showSuccess('Enlace creado correctamente.');
      } else if (linkModal.mode === 'edit' && linkModal.linkId) {
        await updateLibraryLink(
          linkModal.linkId,
          linkTitleInput.trim(),
          linkUrlInput.trim(),
          linkSectionIdInput,
          linkDescInput.trim() || undefined,
          undefined,
          linkAccessLevelInput,
          linkAccessLevelInput === 'roles' ? linkAllowedRolesInput : []
        );
        showSuccess('Enlace actualizado correctamente.');
      }
      setLinkModal({ isOpen: false, mode: 'create' });
      await loadTree();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLink = async (link: LibraryLink) => {
    if (!confirm(`¿Estás seguro de eliminar el enlace "${link.title}"?`)) {
      return;
    }

    try {
      setLoading(true);
      await deleteLibraryLink(link.id);
      showSuccess(`El enlace "${link.title}" ha sido eliminado.`);
      await loadTree();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- VERSIÓN HANDLERS ---
  const handleOpenAddVersion = (doc: LibraryDocument) => {
    setVersionLabelInput('');
    setVersionFileInput(null);
    setAddVersionModal({ isOpen: true, documentId: doc.id, documentTitle: doc.title });
  };

  const handleSaveVersion = async (e: FormEvent) => {
    e.preventDefault();
    if (!versionLabelInput.trim() || !versionFileInput) {
      setError('Debes especificar una etiqueta (ej: PDF, DOCX) y seleccionar un archivo.');
      return;
    }

    try {
      setSubmitting(true);
      await addLibraryDocumentVersion(addVersionModal.documentId, versionLabelInput.trim(), versionFileInput);
      showSuccess(`Nueva versión (${versionLabelInput.trim()}) añadida correctamente.`);
      setAddVersionModal({ isOpen: false, documentId: '', documentTitle: '' });
      await loadTree();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteVersion = async (versionId: string, label: string, docTitle: string) => {
    if (!confirm(`¿Eliminar la versión [${label}] del documento "${docTitle}"?`)) {
      return;
    }

    try {
      setLoading(true);
      await deleteLibraryDocumentVersion(versionId);
      showSuccess(`Versión ${label} eliminada.`);
      await loadTree();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- MOVER HANDLERS ---
  const handleOpenMoveModal = (type: 'section' | 'document', id: string, name: string, currentTargetId?: string | null) => {
    setMoveTargetIdInput(currentTargetId || '');
    setMoveModal({ isOpen: true, type, id, name, currentTargetId });
  };

  const handleExecuteMove = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (moveModal.type === 'section') {
        const targetParent = moveTargetIdInput === '' ? null : moveTargetIdInput;
        await updateLibrarySection(moveModal.id, undefined, targetParent);
        showSuccess(`Sección "${moveModal.name}" movida correctamente.`);
      } else {
        if (!moveTargetIdInput) {
          setError('Debes seleccionar una sección de destino.');
          setSubmitting(false);
          return;
        }
        await updateLibraryDocument(moveModal.id, undefined, moveTargetIdInput);
        showSuccess(`Documento "${moveModal.name}" movido correctamente.`);
      }
      setMoveModal({ isOpen: false, type: 'section', id: '', name: '' });
      await loadTree();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // RENDERIZAR ARBOL RECURSIVO
  const renderSectionNode = (section: LibrarySection, depth: number = 0) => {
    const isExpanded = !!expandedSections[section.id];
    const hasSubsections = section.subsections && section.subsections.length > 0;
    const itemsList: LibraryItem[] = section.items || (section.documents as any[]) || [];
    const hasItems = itemsList.length > 0;
    const isDeletable = !section.hasSubDocuments;

    return (
      <div key={section.id} className="w-full my-1.5 transition-all">
        {/* Fila de Sección */}
        <div
          className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
            depth === 0
              ? 'bg-surface-container/80 border-outline-ghost hover:border-theme-main/40 shadow-md'
              : 'bg-surface-container-low/50 border-outline-ghost/60 hover:border-theme-main/30 ml-4 md:ml-6'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <button
              onClick={() => toggleSection(section.id)}
              className="p-1 text-on-surface-muted hover:text-theme-main transition-colors shrink-0"
              title={isExpanded ? 'Colapsar' : 'Expandir'}
              aria-label="Expandir o colapsar sección"
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            <Folder className={`w-5 h-5 shrink-0 ${depth === 0 ? 'text-theme-main' : 'text-amber-400/90'}`} />

            <span
              onClick={() => toggleSection(section.id)}
              className={`cursor-pointer truncate font-display tracking-wide ${
                depth === 0 ? 'text-lg font-semibold text-on-surface' : 'text-base font-medium text-on-surface/90'
              }`}
            >
              {section.name}
            </span>
          </div>

          {/* Acciones de Admin en Sección */}
          {isAdmin && (
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <button
                onClick={() => handleOpenCreateSubtitle(section.id)}
                className="p-1.5 text-xs text-amber-300/80 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg transition-all flex items-center gap-1"
                title="Añadir subtítulo"
              >
                <FolderPlus className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleOpenCreateDocument(section.id)}
                className="p-1.5 text-xs text-emerald-400/80 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all flex items-center gap-1"
                title="Añadir documento (archivo)"
              >
                <FilePlus className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleOpenCreateLink(section.id)}
                className="p-1.5 text-xs text-sky-400/80 hover:text-sky-400 hover:bg-sky-500/10 rounded-lg transition-all flex items-center gap-1"
                title="Añadir enlace (web / youtube)"
              >
                <LinkIcon className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleOpenMoveModal('section', section.id, section.name, section.parentId)}
                className="p-1.5 text-xs text-sky-400/80 hover:text-sky-400 hover:bg-sky-500/10 rounded-lg transition-all"
                title="Mover sección"
              >
                <Move className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleOpenEditSection(section)}
                className="p-1.5 text-xs text-on-surface-muted hover:text-white hover:bg-surface-container-high rounded-lg transition-all"
                title="Editar título"
              >
                <Pencil className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleDeleteSection(section)}
                disabled={!isDeletable}
                className={`p-1.5 text-xs rounded-lg transition-all ${
                  isDeletable
                    ? 'text-red-400/80 hover:text-red-400 hover:bg-red-500/10 cursor-pointer'
                    : 'text-on-surface-muted/30 cursor-not-allowed opacity-40'
                }`}
                title={
                  isDeletable
                    ? 'Borrar sección'
                    : 'No se puede borrar una sección que contenga elementos colgados'
                }
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Contenido Desplegable */}
        {isExpanded && (
          <div className="flex flex-col mt-1">
            {/* Subsecciones colgadas */}
            {hasSubsections && (
              <div className="flex flex-col">
                {section.subsections!.map(sub => renderSectionNode(sub, depth + 1))}
              </div>
            )}

            {/* Elementos (Documentos / Enlaces) colgados */}
            {hasItems && (
              <div className={`flex flex-col gap-2 mt-2 ${depth === 0 ? 'ml-6 md:ml-8' : 'ml-10 md:ml-12'}`}>
                {itemsList.map(item => {
                  const isLink = item.itemType === 'link';

                  if (isLink) {
                    const link = item as LibraryLink;
                    const isYoutube = link.linkType === 'youtube';

                    return (
                      <div
                        key={link.id}
                        className="flex flex-col md:flex-row md:items-center justify-between p-3 rounded-xl bg-surface-container/40 border border-outline-ghost/40 hover:border-theme-main/30 transition-all gap-3"
                      >
                        <div className="flex items-start md:items-center gap-3 min-w-0 flex-1">
                          {/* Icono o Miniatura de YouTube */}
                          {isYoutube && link.thumbnailUrl ? (
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="relative shrink-0 group/thumb block rounded-lg overflow-hidden border border-red-500/30 hover:border-red-500 transition-all"
                            >
                              <img
                                src={link.thumbnailUrl}
                                alt={link.title}
                                className="w-24 h-14 object-cover group-hover/thumb:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover/thumb:bg-black/20 transition-colors">
                                <Youtube className="w-6 h-6 text-red-500 drop-shadow-md" />
                              </div>
                            </a>
                          ) : (
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                              isYoutube
                                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                                : 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                            }`}>
                              {isYoutube ? <Youtube className="w-5 h-5" /> : <LinkIcon className="w-5 h-5" />}
                            </div>
                          )}

                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-display font-medium text-base text-on-surface hover:text-theme-main transition-colors flex items-center gap-1.5 group cursor-pointer"
                                title={`Abrir enlace: ${link.url}`}
                              >
                                <span>{link.title}</span>
                                <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity text-theme-main" />
                              </a>

                              {/* Badges de Enlace */}
                              {isYoutube ? (
                                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
                                  <Youtube className="w-3 h-3" />
                                  <span>YouTube</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
                                  <LinkIcon className="w-3 h-3" />
                                  <span>Enlace Web</span>
                                </span>
                              )}

                              {link.accessLevel === 'registered' && (
                                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20" title="Visible solo para usuarios registrados">
                                  <Lock className="w-2.5 h-2.5" />
                                  <span>Registrados</span>
                                </span>
                              )}
                              {link.accessLevel === 'roles' && (
                                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20" title={`Visible solo para roles: ${(link.allowedRoles || []).join(', ')}`}>
                                  <Shield className="w-2.5 h-2.5" />
                                  <span>{(link.allowedRoles || []).join(', ')}</span>
                                </span>
                              )}
                            </div>

                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-on-surface-muted/70 hover:text-theme-main truncate max-w-md mt-0.5 block"
                            >
                              {link.url}
                            </a>

                            {link.description && (
                              <p className="text-xs text-on-surface-muted mt-0.5 line-clamp-2">{link.description}</p>
                            )}
                          </div>
                        </div>

                        {/* Acciones Admin en Enlace */}
                        {isAdmin && (
                          <div className="flex items-center gap-1 shrink-0 self-end md:self-center">
                            <button
                              onClick={() => handleOpenEditLink(link)}
                              className="p-1.5 text-xs text-on-surface-muted hover:text-white hover:bg-surface-container-high rounded-lg transition-all"
                              title="Editar enlace"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleDeleteLink(link)}
                              className="p-1.5 text-xs text-red-400/80 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                              title="Eliminar enlace"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Render de Documento (Archivo)
                  const doc = item as LibraryDocument;
                  return (
                    <div
                      key={doc.id}
                      className="flex flex-col md:flex-row md:items-center justify-between p-3 rounded-xl bg-surface-container/40 border border-outline-ghost/40 hover:border-theme-main/30 transition-all gap-2"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <FileText className="w-4 h-4 text-theme-main shrink-0 mt-1" />
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2 flex-wrap">
                            {doc.versions && doc.versions.length > 0 ? (
                              <a
                                href={getLibraryVersionDownloadUrl(doc.versions[0].id)}
                                download={!getViewableType(doc.versions[0])}
                                onClick={(e) => handleVersionClick(doc.versions[0], doc.title, e)}
                                className="font-display font-medium text-base text-on-surface hover:text-theme-main transition-colors flex items-center gap-1.5 group cursor-pointer"
                                title={
                                  getViewableType(doc.versions[0])
                                    ? `Ver ${doc.title}`
                                    : `Descargar ${doc.title}`
                                }
                              >
                                <span>{doc.title}</span>
                                {getViewableType(doc.versions[0]) ? (
                                  <Eye className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity text-theme-main" />
                                ) : (
                                  <Download className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity text-theme-main" />
                                )}
                              </a>
                            ) : (
                              <span className="font-display font-medium text-base text-on-surface">{doc.title}</span>
                            )}

                            <div className="flex items-center gap-1.5 ml-2 flex-wrap">
                              {doc.accessLevel === 'registered' && (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30" title="Restringido: Solo usuarios registrados">
                                  <Lock className="w-3 h-3" />
                                  <span>Registrados</span>
                                </span>
                              )}
                              {doc.accessLevel === 'roles' && (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30" title={`Restringido: Solo roles ${(doc.allowedRoles || []).join(', ')}`}>
                                  <Shield className="w-3 h-3" />
                                  <span>{(doc.allowedRoles || []).join(', ') || 'Sin roles'}</span>
                                </span>
                              )}
                              {(doc.versions || []).map(v => {
                                const viewType = getViewableType(v);
                                return (
                                  <div key={v.id} className="inline-flex items-center gap-1 group/ver">
                                    <a
                                      href={getLibraryVersionDownloadUrl(v.id)}
                                      download={!viewType}
                                      onClick={(e) => handleVersionClick(v, doc.title, e)}
                                      className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-theme-main/15 text-theme-main border border-theme-main/30 hover:bg-theme-main hover:text-background transition-all cursor-pointer"
                                      title={
                                        viewType
                                          ? `Ver versión ${v.label} (${v.originalFilename})`
                                          : `Descargar versión ${v.label} (${v.originalFilename})`
                                      }
                                    >
                                      {viewType ? <Eye className="w-3 h-3" /> : <Tag className="w-3 h-3" />}
                                      <span>{v.label}</span>
                                    </a>
                                    {isAdmin && doc.versions.length > 1 && (
                                      <button
                                        onClick={() => handleDeleteVersion(v.id, v.label, doc.title)}
                                        className="text-red-400/60 hover:text-red-400 opacity-0 group-hover/ver:opacity-100 transition-opacity p-0.5"
                                        title={`Eliminar versión ${v.label}`}
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {doc.description && (
                            <p className="text-xs text-on-surface-muted mt-0.5 line-clamp-2">{doc.description}</p>
                          )}
                        </div>
                      </div>

                      {/* Acciones de Admin en Documento */}
                      {isAdmin && (
                        <div className="flex items-center gap-1 shrink-0 self-end md:self-center">
                          <button
                            onClick={() => handleOpenAddVersion(doc)}
                            className="px-2 py-1 text-xs text-emerald-300 hover:text-emerald-200 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-all flex items-center gap-1"
                            title="Añadir nueva versión al documento"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Versión</span>
                          </button>

                          <button
                            onClick={() => handleOpenMoveModal('document', doc.id, doc.title, doc.sectionId)}
                            className="p-1.5 text-xs text-sky-400/80 hover:text-sky-400 hover:bg-sky-500/10 rounded-lg transition-all"
                            title="Mover documento de sección"
                          >
                            <Move className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleOpenEditDocument(doc)}
                            className="p-1.5 text-xs text-on-surface-muted hover:text-white hover:bg-surface-container-high rounded-lg transition-all"
                            title="Editar título del documento"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteDocument(doc)}
                            className="p-1.5 text-xs text-red-400/80 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                            title="Eliminar documento"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col w-full">
      <PageHeader
        title="La Biblioteca"
        subtitle="Compendio sagrado de documentos, manuales, escrituras y enlaces de La Secta."
        imageSrc="/library_banner.png"
        imageAlt="La Biblioteca de La Secta"
      />

      <div className="max-w-5xl w-full mx-auto px-0 md:px-8 py-4 md:py-10 relative z-20 -mt-20">
        <div className="bg-transparent md:bg-surface border-0 md:border border-transparent md:border-outline-ghost rounded-none md:rounded shadow-none md:shadow-2xl px-4 py-6 md:p-10 md:pt-8 relative">

          <div className="bg-surface-low p-4 md:p-8 border border-outline-ghost shadow-inner mb-8 relative z-20">
            <Cita texto="Regla número uno de la magia: *Nunca te fíes de nada que parezca pensar por sí mismo si no puedes ver dónde tiene el cerebro.*" />
          </div>

          <div className="flex items-center justify-between mb-6 pb-4 border-b border-outline-ghost/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-theme-main/10 border border-theme-main/30 flex items-center justify-center text-theme-main shadow-[0_0_15px_rgba(var(--color-theme-main),0.2)]">
                <BookOpen className="w-6 h-6" />
              </div>
              <h2 className="text-2xl md:text-3xl font-display text-on-surface">
                Archivos, Documentos y Enlaces
              </h2>
            </div>

            {isAdmin && (
              <Button
                onClick={handleOpenCreateTitle}
                variant="primary"
                className="shrink-0 flex items-center gap-2 px-5 py-2.5 shadow-lg"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Título Raíz</span>
              </Button>
            )}
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm flex-1">{error}</span>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm flex-1">{successMessage}</span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-on-surface-muted">
              <Loader2 className="w-8 h-8 animate-spin text-theme-main" />
              <p className="font-display text-sm tracking-wide">Accediendo a los archivos de La Biblioteca...</p>
            </div>
          ) : tree.length === 0 ? (
            <div className="text-center py-16 px-4 bg-surface-container/30 rounded-2xl border border-outline-ghost/50">
              <BookOpen className="w-12 h-12 text-on-surface-muted/40 mx-auto mb-3" />
              <h3 className="text-lg font-display text-on-surface mb-1">La Biblioteca está vacía</h3>
              <p className="text-sm text-on-surface-muted max-w-md mx-auto">
                Actualmente no hay ningún documento o enlace publicado. {isAdmin && 'Haz clic en "Nuevo Título Raíz" para empezar.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {tree.map(sec => renderSectionNode(sec, 0))}
            </div>
          )}
        </div>
      </div>

      {/* MODAL: SECCIÓN */}
      {sectionModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-theme-container border border-outline-ghost rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-4 border-b border-outline-ghost/50 pb-3">
              <h3 className="text-xl font-display text-on-surface font-semibold flex items-center gap-2">
                <Folder className="w-5 h-5 text-theme-main" />
                <span>
                  {sectionModal.mode === 'create_title'
                    ? 'Crear Título Raíz'
                    : sectionModal.mode === 'create_subtitle'
                    ? 'Crear Subtítulo'
                    : 'Editar Sección'}
                </span>
              </h3>
              <button
                onClick={() => setSectionModal({ isOpen: false, mode: 'create_title' })}
                className="text-on-surface-muted hover:text-on-surface"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSection} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-display tracking-wider text-on-surface-muted uppercase mb-1">
                  Nombre de la sección / Título
                </label>
                <input
                  type="text"
                  required
                  value={sectionNameInput}
                  onChange={e => setSectionNameInput(e.target.value)}
                  placeholder="Ej: Manuales, Enlaces de Interés, Vídeos..."
                  className="w-full bg-surface-container border border-outline-ghost rounded-xl px-4 py-2.5 text-on-surface focus:outline-none focus:border-theme-main transition-colors text-sm"
                />
              </div>

              {sectionModal.mode === 'create_title' && (
                <div>
                  <label className="block text-xs font-display tracking-wider text-on-surface-muted uppercase mb-1">
                    Ubicación Padre (Opcional)
                  </label>
                  <select
                    value={sectionParentIdInput}
                    onChange={e => setSectionParentIdInput(e.target.value)}
                    className="w-full bg-surface-container border border-outline-ghost rounded-xl px-4 py-2.5 text-on-surface focus:outline-none focus:border-theme-main transition-colors text-sm"
                  >
                    <option value="">Raíz (Sin Padre)</option>
                    {flatSectionsList.map(sec => (
                      <option key={sec.id} value={sec.id}>
                        {'\u00A0'.repeat(sec.depth * 4)} {sec.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-2 pt-3 border-t border-outline-ghost/50">
                <Button
                  type="button"
                  variant="text"
                  onClick={() => setSectionModal({ isOpen: false, mode: 'create_title' })}
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? 'Guardando...' : 'Guardar Sección'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DOCUMENTO (ARCHIVO) */}
      {documentModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-theme-container border border-outline-ghost rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-4 border-b border-outline-ghost/50 pb-3">
              <h3 className="text-xl font-display text-on-surface font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                <span>{documentModal.mode === 'create' ? 'Añadir Nuevo Documento' : 'Editar Documento'}</span>
              </h3>
              <button
                onClick={() => setDocumentModal({ isOpen: false, mode: 'create' })}
                className="text-on-surface-muted hover:text-on-surface"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDocument} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-display tracking-wider text-on-surface-muted uppercase mb-1">
                  Título del Documento
                </label>
                <input
                  type="text"
                  required
                  value={docTitleInput}
                  onChange={e => setDocTitleInput(e.target.value)}
                  placeholder="Ej: Reglas oficiales de La Secta"
                  className="w-full bg-surface-container border border-outline-ghost rounded-xl px-4 py-2.5 text-on-surface focus:outline-none focus:border-theme-main transition-colors text-sm"
                />
              </div>

              {documentModal.mode === 'edit' && (
                <div>
                  <label className="block text-xs font-display tracking-wider text-on-surface-muted uppercase mb-1">
                    Sección Perteneciente
                  </label>
                  <select
                    value={docSectionIdInput}
                    onChange={e => setDocSectionIdInput(e.target.value)}
                    className="w-full bg-surface-container border border-outline-ghost rounded-xl px-4 py-2.5 text-on-surface focus:outline-none focus:border-theme-main transition-colors text-sm"
                  >
                    {flatSectionsList.map(sec => (
                      <option key={sec.id} value={sec.id}>
                        {'\u00A0'.repeat(sec.depth * 4)} {sec.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-display tracking-wider text-on-surface-muted uppercase mb-1">
                  Descripción (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={docDescInput}
                  onChange={e => setDocDescInput(e.target.value)}
                  placeholder="Breve resumen o contenido del documento..."
                  className="w-full bg-surface-container border border-outline-ghost rounded-xl px-4 py-2 text-on-surface focus:outline-none focus:border-theme-main transition-colors text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-display tracking-wider text-on-surface-muted uppercase mb-1">
                  Restricción de Acceso
                </label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setDocAccessLevelInput('all')}
                    className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-medium transition-all ${
                      docAccessLevelInput === 'all'
                        ? 'bg-theme-main/20 border-theme-main text-theme-main font-semibold'
                        : 'bg-surface-container border-outline-ghost/60 text-on-surface-muted hover:border-outline-ghost hover:text-on-surface'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Todos</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocAccessLevelInput('registered')}
                    className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-medium transition-all ${
                      docAccessLevelInput === 'registered'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-semibold'
                        : 'bg-surface-container border-outline-ghost/60 text-on-surface-muted hover:border-outline-ghost hover:text-on-surface'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Registrados</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocAccessLevelInput('roles')}
                    className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-medium transition-all ${
                      docAccessLevelInput === 'roles'
                        ? 'bg-purple-500/20 border-purple-500 text-purple-300 font-semibold'
                        : 'bg-surface-container border-outline-ghost/60 text-on-surface-muted hover:border-outline-ghost hover:text-on-surface'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Por Roles</span>
                  </button>
                </div>

                {docAccessLevelInput === 'roles' && (
                  <div className="p-3 rounded-xl bg-surface-container-low/60 border border-purple-500/30 flex flex-col gap-2 mt-2">
                    <span className="text-xs font-medium text-purple-200">Selecciona los roles con acceso:</span>
                    <div className="flex items-center gap-4 flex-wrap">
                      {['narrador', 'editor', 'admin'].map(role => (
                        <label key={role} className="inline-flex items-center gap-2 text-xs text-on-surface cursor-pointer">
                          <input
                            type="checkbox"
                            checked={docAllowedRolesInput.includes(role)}
                            onChange={e => {
                              if (e.target.checked) {
                                setDocAllowedRolesInput([...docAllowedRolesInput, role]);
                              } else {
                                setDocAllowedRolesInput(docAllowedRolesInput.filter(r => r !== role));
                              }
                            }}
                            className="rounded bg-surface-container border-outline-ghost text-purple-500 focus:ring-purple-500/40"
                          />
                          <span className="capitalize">{role}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {documentModal.mode === 'create' && (
                <>
                  <div>
                    <label className="block text-xs font-display tracking-wider text-on-surface-muted uppercase mb-1">
                      Etiqueta de la primera versión
                    </label>
                    <input
                      type="text"
                      required
                      value={docVersionLabelInput}
                      onChange={e => setDocVersionLabelInput(e.target.value)}
                      placeholder="Ej: PDF, DOCX, Versión 1.0"
                      className="w-full bg-surface-container border border-outline-ghost rounded-xl px-4 py-2.5 text-on-surface focus:outline-none focus:border-theme-main transition-colors text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-display tracking-wider text-on-surface-muted uppercase mb-1">
                      Archivo Físico (PDF, DOCX, etc.)
                    </label>
                    <input
                      type="file"
                      required
                      onChange={e => setDocFileInput(e.target.files ? e.target.files[0] : null)}
                      className="w-full bg-surface-container border border-outline-ghost rounded-xl px-3 py-2 text-on-surface text-sm file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-theme-main/20 file:text-theme-main hover:file:bg-theme-main/30"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 mt-2 pt-3 border-t border-outline-ghost/50">
                <Button
                  type="button"
                  variant="text"
                  onClick={() => setDocumentModal({ isOpen: false, mode: 'create' })}
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? 'Subiendo...' : 'Guardar Documento'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ENLACE (WEB / YOUTUBE) */}
      {linkModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-theme-container border border-outline-ghost rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-4 border-b border-outline-ghost/50 pb-3">
              <h3 className="text-xl font-display text-on-surface font-semibold flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-sky-400" />
                <span>{linkModal.mode === 'create' ? 'Añadir Nuevo Enlace' : 'Editar Enlace'}</span>
              </h3>
              <button
                onClick={() => setLinkModal({ isOpen: false, mode: 'create' })}
                className="text-on-surface-muted hover:text-on-surface"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLink} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-display tracking-wider text-on-surface-muted uppercase mb-1">
                  Título del Enlace (Texto Visible)
                </label>
                <input
                  type="text"
                  required
                  value={linkTitleInput}
                  onChange={e => setLinkTitleInput(e.target.value)}
                  placeholder="Ej: Vídeo Explicativo en YouTube o Web Oficial"
                  className="w-full bg-surface-container border border-outline-ghost rounded-xl px-4 py-2.5 text-on-surface focus:outline-none focus:border-theme-main transition-colors text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-display tracking-wider text-on-surface-muted uppercase mb-1">
                  Dirección URL de Destino
                </label>
                <input
                  type="url"
                  required
                  value={linkUrlInput}
                  onChange={e => setLinkUrlInput(e.target.value)}
                  placeholder="Ej: https://www.youtube.com/watch?v=... o https://ejemplo.com"
                  className="w-full bg-surface-container border border-outline-ghost rounded-xl px-4 py-2.5 text-on-surface focus:outline-none focus:border-theme-main transition-colors text-sm"
                />
                <span className="text-[11px] text-on-surface-muted mt-1 block">
                  * Si introduces un enlace de YouTube, se generará la miniatura automáticamente.
                </span>
              </div>

              {linkModal.mode === 'edit' && (
                <div>
                  <label className="block text-xs font-display tracking-wider text-on-surface-muted uppercase mb-1">
                    Sección Perteneciente
                  </label>
                  <select
                    value={linkSectionIdInput}
                    onChange={e => setLinkSectionIdInput(e.target.value)}
                    className="w-full bg-surface-container border border-outline-ghost rounded-xl px-4 py-2.5 text-on-surface focus:outline-none focus:border-theme-main transition-colors text-sm"
                  >
                    {flatSectionsList.map(sec => (
                      <option key={sec.id} value={sec.id}>
                        {'\u00A0'.repeat(sec.depth * 4)} {sec.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-display tracking-wider text-on-surface-muted uppercase mb-1">
                  Descripción (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={linkDescInput}
                  onChange={e => setLinkDescInput(e.target.value)}
                  placeholder="Breve descripción o detalle del recurso enlazado..."
                  className="w-full bg-surface-container border border-outline-ghost rounded-xl px-4 py-2 text-on-surface focus:outline-none focus:border-theme-main transition-colors text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-display tracking-wider text-on-surface-muted uppercase mb-1">
                  Restricción de Acceso
                </label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setLinkAccessLevelInput('all')}
                    className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-medium transition-all ${
                      linkAccessLevelInput === 'all'
                        ? 'bg-theme-main/20 border-theme-main text-theme-main font-semibold'
                        : 'bg-surface-container border-outline-ghost/60 text-on-surface-muted hover:border-outline-ghost hover:text-on-surface'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Todos</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLinkAccessLevelInput('registered')}
                    className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-medium transition-all ${
                      linkAccessLevelInput === 'registered'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-semibold'
                        : 'bg-surface-container border-outline-ghost/60 text-on-surface-muted hover:border-outline-ghost hover:text-on-surface'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Registrados</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLinkAccessLevelInput('roles')}
                    className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-medium transition-all ${
                      linkAccessLevelInput === 'roles'
                        ? 'bg-purple-500/20 border-purple-500 text-purple-300 font-semibold'
                        : 'bg-surface-container border-outline-ghost/60 text-on-surface-muted hover:border-outline-ghost hover:text-on-surface'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Por Roles</span>
                  </button>
                </div>

                {linkAccessLevelInput === 'roles' && (
                  <div className="p-3 rounded-xl bg-surface-container-low/60 border border-purple-500/30 flex flex-col gap-2 mt-2">
                    <span className="text-xs font-medium text-purple-200">Selecciona los roles con acceso:</span>
                    <div className="flex items-center gap-4 flex-wrap">
                      {['narrador', 'editor', 'admin'].map(role => (
                        <label key={role} className="inline-flex items-center gap-2 text-xs text-on-surface cursor-pointer">
                          <input
                            type="checkbox"
                            checked={linkAllowedRolesInput.includes(role)}
                            onChange={e => {
                              if (e.target.checked) {
                                setLinkAllowedRolesInput([...linkAllowedRolesInput, role]);
                              } else {
                                setLinkAllowedRolesInput(linkAllowedRolesInput.filter(r => r !== role));
                              }
                            }}
                            className="rounded bg-surface-container border-outline-ghost text-purple-500 focus:ring-purple-500/40"
                          />
                          <span className="capitalize">{role}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-2 pt-3 border-t border-outline-ghost/50">
                <Button
                  type="button"
                  variant="text"
                  onClick={() => setLinkModal({ isOpen: false, mode: 'create' })}
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? 'Guardando...' : 'Guardar Enlace'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: AÑADIR VERSIÓN */}
      {addVersionModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-theme-container border border-outline-ghost rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-4 border-b border-outline-ghost/50 pb-3">
              <h3 className="text-xl font-display text-on-surface font-semibold flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                <span>Añadir Versión</span>
              </h3>
              <button
                onClick={() => setAddVersionModal({ isOpen: false, documentId: '', documentTitle: '' })}
                className="text-on-surface-muted hover:text-on-surface"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-on-surface-muted mb-4">
              Añadiendo una nueva versión para: <strong className="text-on-surface">{addVersionModal.documentTitle}</strong>
            </p>

            <form onSubmit={handleSaveVersion} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-display tracking-wider text-on-surface-muted uppercase mb-1">
                  Etiqueta de Versión
                </label>
                <input
                  type="text"
                  required
                  value={versionLabelInput}
                  onChange={e => setVersionLabelInput(e.target.value)}
                  placeholder="Ej: DOCX, EPUB, v2.0"
                  className="w-full bg-surface-container border border-outline-ghost rounded-xl px-4 py-2.5 text-on-surface focus:outline-none focus:border-theme-main transition-colors text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-display tracking-wider text-on-surface-muted uppercase mb-1">
                  Archivo
                </label>
                <input
                  type="file"
                  required
                  onChange={e => setVersionFileInput(e.target.files ? e.target.files[0] : null)}
                  className="w-full bg-surface-container border border-outline-ghost rounded-xl px-3 py-2 text-on-surface text-sm file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-theme-main/20 file:text-theme-main hover:file:bg-theme-main/30"
                />
              </div>

              <div className="flex justify-end gap-3 mt-2 pt-3 border-t border-outline-ghost/50">
                <Button
                  type="button"
                  variant="text"
                  onClick={() => setAddVersionModal({ isOpen: false, documentId: '', documentTitle: '' })}
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? 'Subiendo...' : 'Subir Versión'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MOVER ELEMENTO */}
      {moveModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-theme-container border border-outline-ghost rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-4 border-b border-outline-ghost/50 pb-3">
              <h3 className="text-xl font-display text-on-surface font-semibold flex items-center gap-2">
                <Move className="w-5 h-5 text-sky-400" />
                <span>Mover {moveModal.type === 'section' ? 'Sección' : 'Documento'}</span>
              </h3>
              <button
                onClick={() => setMoveModal({ isOpen: false, type: 'section', id: '', name: '' })}
                className="text-on-surface-muted hover:text-on-surface"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-on-surface-muted mb-4">
              Selecciona la nueva ubicación para: <strong className="text-on-surface">{moveModal.name}</strong>
            </p>

            <form onSubmit={handleExecuteMove} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-display tracking-wider text-on-surface-muted uppercase mb-1">
                  Ubicación de Destino
                </label>
                <select
                  value={moveTargetIdInput}
                  onChange={e => setMoveTargetIdInput(e.target.value)}
                  className="w-full bg-surface-container border border-outline-ghost rounded-xl px-4 py-2.5 text-on-surface focus:outline-none focus:border-theme-main transition-colors text-sm"
                >
                  {moveModal.type === 'section' && <option value="">Raíz (Sin Sección Padre)</option>}
                  {flatSectionsList
                    .filter(sec => sec.id !== moveModal.id)
                    .map(sec => (
                      <option key={sec.id} value={sec.id}>
                        {'\u00A0'.repeat(sec.depth * 4)} {sec.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 mt-2 pt-3 border-t border-outline-ghost/50">
                <Button
                  type="button"
                  variant="text"
                  onClick={() => setMoveModal({ isOpen: false, type: 'section', id: '', name: '' })}
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? 'Moviendo...' : 'Confirmar Movimiento'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VISOR DE DOCUMENTOS */}
      {viewerModal.isOpen && viewerModal.version && (
        <div className="fixed inset-0 z-50 bg-background/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
          <div className="bg-theme-container border border-outline-ghost/80 rounded-2xl max-w-5xl w-full max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-outline-ghost/60 bg-surface-container/50 shrink-0 gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-xl bg-theme-main/10 border border-theme-main/30 flex items-center justify-center text-theme-main shrink-0">
                  {getViewableType(viewerModal.version) === 'pdf' && <FileText className="w-5 h-5 text-red-400" />}
                  {getViewableType(viewerModal.version) === 'html' && <FileCode className="w-5 h-5 text-amber-400" />}
                  {getViewableType(viewerModal.version) === 'txt' && <FileText className="w-5 h-5 text-sky-400" />}
                  {getViewableType(viewerModal.version) === 'image' && <FileImage className="w-5 h-5 text-purple-400" />}
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-display font-semibold text-on-surface truncate">
                      {viewerModal.documentTitle}
                    </h3>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-theme-main/20 text-theme-main border border-theme-main/30">
                      {viewerModal.version.label}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-muted truncate">
                    {viewerModal.version.originalFilename} • {formatBytes(viewerModal.version.fileSize)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={getLibraryVersionDownloadUrl(viewerModal.version.id)}
                  download
                  className="px-3.5 py-1.5 text-xs font-display font-semibold text-background bg-theme-main hover:bg-theme-main/90 rounded-xl transition-all flex items-center gap-1.5 shadow-md"
                  title="Descargar archivo"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar</span>
                </a>

                <a
                  href={getLibraryVersionDownloadUrl(viewerModal.version.id, true)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-on-surface-muted hover:text-on-surface bg-surface-container/60 hover:bg-surface-container rounded-xl transition-all flex"
                  title="Abrir en pestaña nueva"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>

                <button
                  onClick={() => setViewerModal({ isOpen: false })}
                  className="p-1.5 text-on-surface-muted hover:text-on-surface bg-surface-container/60 hover:bg-surface-container rounded-xl transition-all"
                  title="Cerrar visor"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 p-2 sm:p-4 bg-background/50 overflow-auto flex flex-col justify-center items-center">
              {getViewableType(viewerModal.version) === 'pdf' && (
                isMobile ? (
                  <div className="w-full min-h-[40vh] flex flex-col items-center justify-center text-center p-6 bg-surface-container/30 border border-outline-ghost/30 rounded-2xl max-w-md mx-auto my-auto">
                    <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-4 animate-pulse">
                      <FileText className="w-8 h-8" />
                    </div>
                    <h4 className="font-display font-semibold text-lg text-on-surface mb-2">
                      Visualización de PDF
                    </h4>
                    <p className="text-sm text-on-surface-muted mb-6 leading-relaxed">
                      Para una lectura óptima y fluida en dispositivos móviles, te recomendamos abrir este archivo PDF en una pestaña de tu navegador.
                    </p>
                    <a
                      href={getLibraryVersionDownloadUrl(viewerModal.version.id, true)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-3 font-display font-medium text-sm text-background bg-theme-main hover:bg-theme-main/90 rounded-xl transition-all flex items-center gap-2 shadow-lg"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Abrir Documento</span>
                    </a>
                  </div>
                ) : (
                  <iframe
                    src={getLibraryVersionDownloadUrl(viewerModal.version.id, true)}
                    className="w-full h-[75vh] rounded-xl border border-outline-ghost/40 bg-surface-container"
                    title={viewerModal.version.originalFilename}
                  />
                )
              )}

              {getViewableType(viewerModal.version) === 'html' && (
                isMobile ? (
                  <div className="w-full min-h-[40vh] flex flex-col items-center justify-center text-center p-6 bg-surface-container/30 border border-outline-ghost/30 rounded-2xl max-w-md mx-auto my-auto">
                    <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 animate-pulse">
                      <FileCode className="w-8 h-8" />
                    </div>
                    <h4 className="font-display font-semibold text-lg text-on-surface mb-2">
                      Documento interactivo HTML
                    </h4>
                    <p className="text-sm text-on-surface-muted mb-6 leading-relaxed">
                      Este documento contiene formato HTML interactivo. Para garantizar su correcto funcionamiento y visualización en tu iPhone, ábrelo en una nueva pestaña.
                    </p>
                    <a
                      href={getLibraryVersionDownloadUrl(viewerModal.version.id, true)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-3 font-display font-medium text-sm text-background bg-theme-main hover:bg-theme-main/90 rounded-xl transition-all flex items-center gap-2 shadow-lg"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Abrir Documento</span>
                    </a>
                  </div>
                ) : (
                  <iframe
                    src={getLibraryVersionDownloadUrl(viewerModal.version.id, true)}
                    className="w-full h-[75vh] rounded-xl border border-outline-ghost/40 bg-white"
                    title={viewerModal.version.originalFilename}
                    sandbox="allow-same-origin allow-scripts"
                  />
                )
              )}

              {getViewableType(viewerModal.version) === 'txt' && (
                <div className="w-full h-[75vh] flex flex-col">
                  {loadingTxt ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2 text-on-surface-muted">
                      <Loader2 className="w-8 h-8 animate-spin text-theme-main" />
                      <p className="text-sm font-display">Cargando documento de texto...</p>
                    </div>
                  ) : txtError ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-red-400">
                      <AlertCircle className="w-8 h-8" />
                      <p className="text-sm">{txtError}</p>
                      <iframe
                        src={getLibraryVersionDownloadUrl(viewerModal.version.id, true)}
                        className="w-full h-full rounded-xl border border-outline-ghost/40 bg-surface-container"
                        title={viewerModal.version.originalFilename}
                      />
                    </div>
                  ) : (
                    <pre className="w-full h-full p-4 sm:p-6 rounded-xl bg-surface-container border border-outline-ghost/40 text-on-surface font-mono text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words overflow-auto">
                      {txtContent}
                    </pre>
                  )}
                </div>
              )}

              {getViewableType(viewerModal.version) === 'image' && (
                <div className="w-full h-[75vh] flex items-center justify-center p-2 bg-surface-container/30 rounded-xl border border-outline-ghost/30 overflow-auto">
                  <img
                    src={getLibraryVersionDownloadUrl(viewerModal.version.id, true)}
                    alt={viewerModal.version.originalFilename}
                    className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
                  />
                </div>
              )}
            </div>

            <div className="p-3 border-t border-outline-ghost/60 bg-surface-container/30 flex items-center justify-between text-xs text-on-surface-muted shrink-0 px-4">
              <span>Formato: {viewerModal.version.mimeType}</span>
              <div className="flex items-center gap-3">
                <a
                  href={getLibraryVersionDownloadUrl(viewerModal.version.id)}
                  download
                  className="hover:text-theme-main transition-colors flex items-center gap-1 font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar archivo</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
