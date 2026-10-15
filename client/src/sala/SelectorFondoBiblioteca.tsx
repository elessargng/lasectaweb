import { ChevronRight, Folder } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  fetchLibraryTree,
  getLibraryVersionDownloadUrl,
  getViewableType,
  type LibraryDocument,
  type LibraryDocumentVersion,
  type LibrarySection,
} from '../utils/libraryApi';

interface SelectorFondoBibliotecaProps {
  /** Se ha elegido una imagen (la versión del documento). */
  onElegir: (version: LibraryDocumentVersion, titulo: string) => void;
}

/** La carpeta de la Biblioteca en la que se estaba la última vez (se vuelve a ella). */
const CLAVE_CARPETA = 'sala:fondoCarpeta';
const leerCarpeta = () => {
  try {
    return localStorage.getItem(CLAVE_CARPETA);
  } catch {
    return null;
  }
};

/** El camino hasta una carpeta (de la raíz a ella), o null si ya no existe. */
function caminoHasta(carpetas: LibrarySection[], id: string): LibrarySection[] | null {
  for (const c of carpetas) {
    if (c.id === id) return [c];
    const dentro = caminoHasta(c.subsections ?? [], id);
    if (dentro) return [c, ...dentro];
  }
  return null;
}

/** La versión más reciente de un documento, si es una imagen. */
function imagenDe(doc: LibraryDocument): LibraryDocumentVersion | null {
  const recientes = [...(doc.versions ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return recientes.find((v) => getViewableType(v) === 'image') ?? null;
}

/**
 * Elegir un fondo entre las imágenes de la Biblioteca de la web: se navega por
 * sus carpetas (con el camino arriba para volver) y se elige una imagen. Se
 * vuelve a la última carpeta visitada (guardada en este navegador).
 *
 * Solo lo público: se pide la Biblioteca sin sesión, como la ve alguien sin
 * cuenta, aunque el narrador la tenga iniciada. Así nada que pida registro (o
 * un papel) acaba a la vista de toda la partida. El servidor lo vuelve a comprobar.
 */
const SelectorFondoBiblioteca = ({ onElegir }: SelectorFondoBibliotecaProps) => {
  const [arbol, setArbol] = useState<LibrarySection[] | null>(null);
  const [error, setError] = useState('');
  const [carpetaId, setCarpetaId] = useState<string | null>(leerCarpeta);

  useEffect(() => {
    let vigente = true;
    // Siempre sin sesión: solo lo público (lo que pide registro no llega a la partida)
    fetchLibraryTree(true)
      .then((a) => vigente && setArbol(a))
      .catch(() => vigente && setError('No se ha podido leer la Biblioteca.'));
    return () => {
      vigente = false;
    };
  }, []);

  const abrir = (id: string | null) => {
    setCarpetaId(id);
    try {
      if (id) localStorage.setItem(CLAVE_CARPETA, id);
      else localStorage.removeItem(CLAVE_CARPETA);
    } catch {
      // Sin almacenamiento: vale mientras la página esté abierta.
    }
  };

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!arbol) return <p className="text-sm text-on-surface-muted">Leyendo la Biblioteca…</p>;

  // Si la carpeta guardada ya no existe (o no se ve), se empieza por la raíz
  const camino = (carpetaId && caminoHasta(arbol, carpetaId)) || [];
  const actual = camino[camino.length - 1];
  const carpetas = actual ? (actual.subsections ?? []) : arbol;
  const imagenes = (actual?.documents ?? [])
    .map((doc) => ({ doc, version: imagenDe(doc) }))
    .filter((x): x is { doc: LibraryDocument; version: LibraryDocumentVersion } => !!x.version);

  return (
    <div className="flex flex-col gap-3 rounded border border-outline-ghost bg-background/60 p-3">
      {/* Dónde se está, con un botón por carpeta para volver */}
      <nav aria-label="Carpeta de la Biblioteca">
        <ol className="flex flex-wrap items-center gap-1 text-sm">
          {[{ id: null as string | null, name: 'Biblioteca' }, ...camino].map((c, i, todas) => {
            const ultima = i === todas.length - 1;
            return (
              <li key={c.id ?? 'raiz'} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={14} className="text-on-surface-muted" />}
                {ultima ? (
                  <span aria-current="location" className="font-semibold">
                    {c.name}
                  </span>
                ) : (
                  <button type="button" onClick={() => abrir(c.id)} className="text-theme-main underline hover:text-white">
                    {c.name}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {carpetas.length > 0 && (
        <ul aria-label="Carpetas" className="flex flex-wrap gap-2">
          {carpetas.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => abrir(c.id)}
                className="flex items-center gap-1.5 rounded border border-outline-ghost px-2 py-1 text-sm hover:border-theme-main focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main"
              >
                <Folder size={15} className="text-theme-main" />
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {imagenes.length > 0 ? (
        <ul aria-label="Imágenes" className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-2">
          {imagenes.map(({ doc, version }) => (
            <li key={doc.id}>
              <button
                type="button"
                onClick={() => onElegir(version, doc.title)}
                aria-label={`Usar «${doc.title}» de fondo`}
                className="flex w-full flex-col gap-1 rounded border border-outline-ghost p-1 text-left text-xs hover:border-theme-main focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main"
              >
                <img
                  src={getLibraryVersionDownloadUrl(version, true, false)}
                  alt=""
                  loading="lazy"
                  className="aspect-video w-full rounded object-cover"
                />
                <span className="truncate">{doc.title}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-on-surface-muted">
          {actual ? 'En esta carpeta no hay imágenes.' : 'Elige una carpeta.'}
        </p>
      )}
    </div>
  );
};

export default SelectorFondoBiblioteca;
