import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ImagePlus, Lock, Trash2, X } from 'lucide-react';
import {
  MAX_PHOTOS_PER_UPLOAD,
  deleteRitualPhoto,
  setRitualPhotoPublic,
  uploadRitualPhotos,
  type Ritual,
  type RitualPhoto
} from '../../utils/ritualsApi';
import { urlDelServidor } from '../../utils/api';
import { compressImage } from '../../utils/image';

/** Lo más largo de una foto al subirla: se reduce en el navegador antes de enviarla. */
const MAX_LADO_FOTO = 1600;

/** El cursor de un interruptor (como en RitualFormModal): el `<input>` va antes, como `peer` (sr-only). */
const switchClass =
  'relative h-5 w-9 shrink-0 rounded-full border border-outline-ghost bg-background transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-3.5 after:w-3.5 after:rounded-full after:bg-on-surface-muted after:transition-transform peer-checked:border-theme-main peer-checked:bg-theme-container peer-checked:after:translate-x-4 peer-checked:after:bg-theme-main peer-focus-visible:ring-2 peer-focus-visible:ring-theme-main motion-reduce:transition-none motion-reduce:after:transition-none';

/** Un interruptor con su texto. */
const Interruptor = ({ checked, onChange, disabled, children }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; children: string }) => (
  <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-on-surface">
    <input
      type="checkbox"
      role="switch"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className="peer sr-only"
    />
    <span aria-hidden="true" className={switchClass} />
    {children}
  </label>
);

/**
 * Una foto que abre la imagen entera: su nombre es lo que se ve en ella y, si es privada, lo dice.
 * De entrada, una miniatura recortada; el carrusel la pide entera (`fit`).
 */
export const PhotoLink = ({ photo, fit = false }: { photo: RitualPhoto; fit?: boolean }) => (
  <a
    href={urlDelServidor(photo.src)}
    target="_blank"
    rel="noopener noreferrer"
    className={`relative block overflow-hidden rounded-sm border border-outline-ghost/70 hover:border-theme-main/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main ${
      fit ? 'bg-background/60' : 'aspect-[4/3]'
    }`}
  >
    <img
      src={urlDelServidor(photo.src)}
      alt={photo.alt}
      loading="lazy"
      className={fit ? 'mx-auto max-h-[60vh] w-auto max-w-full object-contain' : 'w-full h-full object-cover'}
    />
    {!photo.public && (
      <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-background/85 border border-outline-ghost font-ui text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-on-surface">
        <Lock className="w-3 h-3" />
        <span className="sr-only">, </span>Privada
      </span>
    )}
    <span className="sr-only"> (se abre en una ventana nueva)</span>
  </a>
);

/** Quién subió la foto, debajo de ella. */
const SubidaPor = ({ photo }: { photo: RitualPhoto }) =>
  photo.uploadedByUsername ? <p className="mt-1 text-xs text-on-surface-muted truncate">Subida por {photo.uploadedByUsername}</p> : null;

/** Las fotos de un evento, solo para mirarlas (la línea de tiempo). */
export const PhotoGrid = ({ photos, className }: { photos: RitualPhoto[]; className: string }) => (
  <ul className={className}>
    {photos.map((photo) => (
      <li key={photo.id}>
        <PhotoLink photo={photo} />
        <SubidaPor photo={photo} />
      </li>
    ))}
  </ul>
);

/** Una foto por subir: la clave para la lista y el foco, su imagen, lo que se ve en ella y si es pública. */
interface FotoNueva {
  clave: string;
  src: string;
  alt: string;
  public: boolean;
}

const idDescripcion = (clave: string) => `ritual-foto-nueva-${clave}`;

interface RitualPhotosProps {
  ritual: Ritual;
  /** Sin sesión, solo se miran. */
  token: string | null;
  userId?: string;
  /** Narradores y administradores: pueden borrar cualquier foto que vean. */
  canManage: boolean;
  /** Tras subir, cambiar o borrar: recargar el evento. */
  onChanged: () => Promise<void>;
}

/**
 * Las fotos de un evento, en su ficha: cualquier persona registrada sube las suyas (antes,
 * durante o después), cada una con lo que se ve en ella y pública o privada (de entrada,
 * privada: solo la ve quien la sube). Quien la subió la cambia o la borra; un narrador, la borra.
 */
export const RitualPhotos = ({ ritual, token, userId, canManage, onChanged }: RitualPhotosProps) => {
  const photos = ritual.photos ?? [];
  const [nuevas, setNuevas] = useState<FotoNueva[]>([]);
  const [preparando, setPreparando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const elegirRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** A dónde va el foco cuando ya se vea: una descripción nueva, «Subir fotos» o el título. */
  const [foco, setFoco] = useState<string | null>(null);

  useEffect(() => {
    if (!foco) return;
    if (foco === 'titulo') tituloRef.current?.focus();
    else if (foco === 'elegir') elegirRef.current?.focus();
    else document.getElementById(idDescripcion(foco))?.focus();
    setFoco(null);
  }, [foco]);

  // Las elegidas, reducidas, al final de las que esperan; el foco, a describir la primera
  const elegir = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setError('');
    const caben = MAX_PHOTOS_PER_UPLOAD - nuevas.length;
    if (files.length > caben) setError(`Se pueden subir ${MAX_PHOTOS_PER_UPLOAD} fotos de una vez: se añaden las ${caben} primeras.`);
    setPreparando(true);
    try {
      const listas: FotoNueva[] = [];
      for (const file of files.slice(0, caben)) {
        listas.push({ clave: crypto.randomUUID(), src: await compressImage(file, MAX_LADO_FOTO), alt: '', public: false });
      }
      setNuevas((prev) => [...prev, ...listas]);
      if (listas.length > 0) setFoco(listas[0].clave);
    } catch {
      setError('No se pudo leer alguna foto: prueba con un JPEG o un PNG.');
    } finally {
      setPreparando(false);
    }
  };

  const cambiar = (clave: string, cambio: Partial<FotoNueva>) =>
    setNuevas((prev) => prev.map((f) => (f.clave === clave ? { ...f, ...cambio } : f)));

  // Quitada una de las que esperan, el foco va a la siguiente (o a la anterior, o a «Subir fotos»)
  const quitar = (clave: string) => {
    const i = nuevas.findIndex((f) => f.clave === clave);
    const resto = nuevas.filter((f) => f.clave !== clave);
    setNuevas(resto);
    setFoco(resto[Math.min(i, resto.length - 1)]?.clave ?? 'elegir');
  };

  const cancelar = () => {
    setNuevas([]);
    setError('');
    setFoco('elegir');
  };

  /** Hace algo con el servidor, recarga y avisa; si sale mal, el error. */
  const hacer = async (accion: () => Promise<unknown>, hecho: string, focoTras: string | null) => {
    setError('');
    setAviso('');
    try {
      await accion();
      await onChanged();
      setAviso(hecho);
      if (focoTras) setFoco(focoTras);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el cambio.');
      return false;
    }
  };

  const subir = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setEnviando(true);
    const n = nuevas.length;
    const ok = await hacer(
      () => uploadRitualPhotos(token, ritual.id, nuevas.map((f) => ({ src: f.src, alt: f.alt.trim(), public: f.public }))),
      n === 1 ? 'Foto subida.' : `${n} fotos subidas.`,
      'titulo'
    );
    if (ok) setNuevas([]);
    setEnviando(false);
  };

  return (
    <section aria-labelledby="ritual-detalle-fotos" className="flex flex-col gap-3">
      <h3 ref={tituloRef} id="ritual-detalle-fotos" tabIndex={-1} className="rotulo focus:outline-none">
        Fotos
      </h3>

      {photos.length === 0 ? (
        <p className="text-sm italic text-on-surface-muted">Aún no hay fotos de este evento.</p>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((photo, i) => {
            const mia = !!userId && photo.uploadedBy === userId;
            return (
              <li key={photo.id}>
                <PhotoLink photo={photo} />
                <SubidaPor photo={photo} />
                {(mia || canManage) && token && (
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    {mia ? (
                      <Interruptor
                        checked={photo.public}
                        onChange={(p) =>
                          void hacer(() => setRitualPhotoPublic(token, ritual.id, photo.id, p), `Foto ${i + 1} ${p ? 'pública' : 'privada'}.`, null)
                        }
                      >
                        {`Foto ${i + 1} pública`}
                      </Interruptor>
                    ) : (
                      <span />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('¿Borrar esta foto?')) void hacer(() => deleteRitualPhoto(token, ritual.id, photo.id), 'Foto borrada.', 'titulo');
                      }}
                      aria-label={`Borrar la foto ${i + 1}`}
                      className="btn-sello btn-sello-icono btn-sello-peligro shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p role="alert" className="aviso-error">
          {error}
        </p>
      )}
      <p role="status" className="sr-only">
        {aviso}
      </p>

      {!token ? (
        <p className="text-xs italic text-on-surface-muted">Inicia sesión para subir tus fotos del evento.</p>
      ) : (
        <>
          {nuevas.length > 0 && (
            <form onSubmit={subir} aria-label="Fotos por subir" className="flex flex-col gap-3 p-4 rounded-sm border border-outline-ghost/70 bg-background/40">
              <p className="text-xs text-on-surface-muted">Cada foto es privada (solo la ves tú) salvo que la marques como pública.</p>
              <ul className="flex flex-col gap-3">
                {nuevas.map((foto, i) => (
                  <li key={foto.clave} className="flex items-start gap-3">
                    {/* La miniatura, decorativa: lo que se ve lo dice su descripción */}
                    <img src={foto.src} alt="" className="w-20 h-20 shrink-0 object-cover rounded-sm border border-outline-ghost/70" />
                    <div className="flex-1 min-w-0 flex flex-col gap-2">
                      <div>
                        <label htmlFor={idDescripcion(foto.clave)} className="block text-xs text-on-surface-muted mb-1">
                          Foto nueva {i + 1}: qué se ve
                        </label>
                        <input
                          id={idDescripcion(foto.clave)}
                          type="text"
                          required
                          maxLength={300}
                          value={foto.alt}
                          onChange={(e) => cambiar(foto.clave, { alt: e.target.value })}
                          placeholder="Ej: La plaza llena de jugadores alrededor del grimorio"
                          className="campo"
                        />
                      </div>
                      <Interruptor checked={foto.public} onChange={(p) => cambiar(foto.clave, { public: p })}>
                        {`Foto nueva ${i + 1} pública`}
                      </Interruptor>
                    </div>
                    <button
                      type="button"
                      onClick={() => quitar(foto.clave)}
                      aria-label={`Quitar la foto nueva ${i + 1}`}
                      className="btn-sello btn-sello-icono shrink-0 mt-5"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={cancelar} className="btn-sello">
                  Cancelar
                </button>
                <button type="submit" disabled={enviando} className="btn-runic btn-runic-primary px-4 py-2 text-xs">
                  {enviando ? 'Subiendo…' : nuevas.length === 1 ? 'Subir la foto' : `Subir ${nuevas.length} fotos`}
                </button>
              </div>
            </form>
          )}
          <div>
            <button
              ref={elegirRef}
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={preparando || nuevas.length >= MAX_PHOTOS_PER_UPLOAD}
              className="btn-sello"
            >
              <ImagePlus className="w-3.5 h-3.5" /> {preparando ? 'Preparando fotos…' : nuevas.length > 0 ? 'Añadir más fotos' : 'Subir fotos'}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              hidden
              onChange={(e) => void elegir(e)}
            />
          </div>
        </>
      )}
    </section>
  );
};

export default RitualPhotos;
