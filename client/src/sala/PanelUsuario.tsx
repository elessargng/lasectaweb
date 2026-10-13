import { ImagePlus } from 'lucide-react';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { getAvatarUrl } from '../utils/api';
import { compressImage } from '../utils/image';
import { AVATAR_INVITADO, AVATARES_SALA } from './avatares';
import { useAriaLive } from './avisosConfig';
import { botonPrincipal } from './estilos';
import { NOMBRE_MAX } from './invitado';

/** Si sale bien, `avatar` es cómo queda guardado (la ruta, si se ha subido una imagen). */
export type ResultadoPerfil = { ok: true; avatar: string } | { ok: false; error: string; campo: 'nombre' | 'avatar' };

/** Lado máximo con el que se sube una imagen propia: el de los cuadros más grandes. */
const LADO_IMAGEN_PROPIA = 256;

/** Una imagen propia ya subida a la sala (las predefinidas van por /avatar(s)…). */
const esImagenPropia = (avatar: string) => avatar.startsWith('/uploads/sala/');

interface PanelUsuarioProps {
  nombreActual: string;
  /**
   * Avatar elegido para la sala; vacío: el por defecto (el de la cuenta, o el
   * logo si es invitado). Puede ser una imagen propia, que solo cambia la sala.
   */
  avatarElegido: string;
  /** Con cuenta: el avatar de su cuenta en la web (null si no tiene). */
  cuenta: { avatar: string | null } | null;
  /** `avatar` puede ser una imagen nueva en base64 (data URL), que se sube al guardar. */
  onGuardar: (nombre: string, avatar: string) => Promise<ResultadoPerfil>;
}

const inputClass =
  'rounded border border-outline-ghost bg-background px-3 py-2 text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main aria-[invalid=true]:border-red-400';

/** Pestaña Usuario: el nombre y el avatar con los que se aparece en la sala. */
const PanelUsuario = ({ nombreActual, avatarElegido, cuenta, onGuardar }: PanelUsuarioProps) => {
  const [nombre, setNombre] = useState(nombreActual);
  const [avatar, setAvatar] = useState(avatarElegido);
  // Imagen propia: la ya subida, o una nueva elegida aquí (data URL) hasta guardar.
  const [propia, setPropia] = useState<string | null>(esImagenPropia(avatarElegido) ? avatarElegido : null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoPerfil | null>(null);
  const error = resultado && !resultado.ok ? resultado : null;
  // Errores y «Guardado» se leen según Preferencias > Accesibilidad.
  const ariaLive = useAriaLive(error ? 'errores' : 'preferencias');

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setResultado(null);
    const r = await onGuardar(nombre, avatar);
    // Una imagen nueva queda guardada con su ruta: se cambia, para no volver a subirla.
    if (r.ok && r.avatar !== avatar) {
      setAvatar(r.avatar);
      setPropia(r.avatar);
    }
    setResultado(r);
    setEnviando(false);
  };

  const elegirImagen = async (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setResultado(null);
    try {
      const imagen = await compressImage(archivo, LADO_IMAGEN_PROPIA);
      setPropia(imagen);
      setAvatar(imagen);
    } catch {
      setResultado({ ok: false, error: 'No se pudo leer la imagen. Prueba con otra.', campo: 'avatar' });
    }
  };

  // La primera opción (valor vacío) es la de por defecto: el avatar de la cuenta o,
  // si es invitado, el logo, que entonces no se repite en la lista.
  const porDefecto = cuenta
    ? { url: '', etiqueta: 'El de tu cuenta', imagen: cuenta.avatar }
    : { url: '', etiqueta: 'La Secta', imagen: AVATAR_INVITADO };
  const opciones = [
    porDefecto,
    ...AVATARES_SALA.filter((a) => cuenta || a.url !== AVATAR_INVITADO).map((a) => ({ ...a, imagen: a.url })),
    ...(propia ? [{ url: propia, etiqueta: 'Tu imagen', imagen: propia }] : []),
  ];

  return (
    <form onSubmit={guardar} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <label htmlFor="sala-pref-nombre" className="text-sm text-on-surface-muted">
          Nombre en la sala
        </label>
        <input
          id="sala-pref-nombre"
          value={nombre}
          maxLength={NOMBRE_MAX}
          autoComplete="nickname"
          onChange={(e) => setNombre(e.target.value)}
          aria-invalid={error?.campo === 'nombre' ? true : undefined}
          aria-describedby={
            [cuenta ? 'sala-pref-nombre-ayuda' : '', error?.campo === 'nombre' ? 'sala-pref-error' : ''].join(' ').trim() ||
            undefined
          }
          className={inputClass}
        />
        {cuenta && (
          <p id="sala-pref-nombre-ayuda" className="text-xs text-on-surface-muted">
            Déjalo vacío para usar tu nombre de usuario.
          </p>
        )}
      </div>

      <fieldset aria-describedby={error?.campo === 'avatar' ? 'sala-pref-error' : undefined}>
        <legend className="mb-2 text-sm text-on-surface-muted">Avatar</legend>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-3">
          {opciones.map((o) => (
            <label key={o.url || 'defecto'} className="cursor-pointer">
              <input
                type="radio"
                name="sala-pref-avatar"
                value={o.url}
                checked={avatar === o.url}
                onChange={() => setAvatar(o.url)}
                className="peer sr-only"
              />
              <span className="flex flex-col items-center gap-1 rounded p-1 text-center text-xs opacity-70 hover:opacity-100 peer-checked:bg-theme-container peer-checked:opacity-100 peer-focus-visible:ring-2 peer-focus-visible:ring-theme-main">
                <span className="block aspect-square w-full overflow-hidden rounded border border-outline-ghost bg-background">
                  {o.imagen && <img src={getAvatarUrl(o.imagen)} alt="" className="h-full w-full object-cover" />}
                </span>
                {o.etiqueta}
              </span>
            </label>
          ))}
          {/* Subir una imagen propia: solo cambia la sala, no el perfil de la web */}
          <label className="flex cursor-pointer flex-col items-center gap-1 rounded p-1 text-center text-xs opacity-70 hover:opacity-100 focus-within:opacity-100 focus-within:ring-2 focus-within:ring-theme-main">
            <span
              aria-hidden="true"
              className="flex aspect-square w-full items-center justify-center rounded border border-dashed border-outline-ghost bg-background"
            >
              <ImagePlus className="h-1/3 w-1/3 text-on-surface-muted" />
            </span>
            Subir imagen
            <input type="file" accept="image/*" onChange={elegirImagen} className="sr-only" />
          </label>
        </div>
        <p className="mt-2 text-xs text-on-surface-muted">Tu imagen solo se verá en la sala; no cambia tu perfil.</p>
      </fieldset>

      <div aria-live={ariaLive}>
        {error && (
          <p id="sala-pref-error" className="text-sm text-red-400">
            {error.error}
          </p>
        )}
        {resultado?.ok && <p className="text-sm text-on-surface-muted">Guardado.</p>}
        {!resultado && avatar.startsWith('data:') && (
          <p className="text-sm text-on-surface-muted">Imagen elegida. Pulsa Guardar para usarla.</p>
        )}
      </div>

      <div>
        <button type="submit" aria-disabled={enviando} className={botonPrincipal}>
          Guardar
        </button>
      </div>
    </form>
  );
};

export default PanelUsuario;
