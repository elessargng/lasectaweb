import { useState, type FormEvent } from 'react';
import { getAvatarUrl } from '../utils/api';
import { AVATAR_INVITADO, AVATARES_SALA } from './avatares';
import { botonPrincipal } from './estilos';
import { NOMBRE_MAX } from './invitado';

export type ResultadoPerfil = { ok: true } | { ok: false; error: string; campo: 'nombre' | 'avatar' };

interface PanelUsuarioProps {
  nombreActual: string;
  /** Avatar elegido para la sala; vacío: el por defecto (el de la cuenta, o el logo si es invitado). */
  avatarElegido: string;
  /** Con cuenta: el avatar de su cuenta en la web (null si no tiene). */
  cuenta: { avatar: string | null } | null;
  onGuardar: (nombre: string, avatar: string) => Promise<ResultadoPerfil>;
}

const inputClass =
  'rounded border border-outline-ghost bg-background px-3 py-2 text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main aria-[invalid=true]:border-red-400';

/** Pestaña Usuario: el nombre y el avatar con los que se aparece en la sala. */
const PanelUsuario = ({ nombreActual, avatarElegido, cuenta, onGuardar }: PanelUsuarioProps) => {
  const [nombre, setNombre] = useState(nombreActual);
  const [avatar, setAvatar] = useState(avatarElegido);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoPerfil | null>(null);
  const error = resultado && !resultado.ok ? resultado : null;

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setResultado(null);
    setResultado(await onGuardar(nombre, avatar));
    setEnviando(false);
  };

  // La primera opción (valor vacío) es la de por defecto: el avatar de la cuenta o,
  // si es invitado, el logo, que entonces no se repite en la lista.
  const porDefecto = cuenta
    ? { url: '', etiqueta: 'El de tu cuenta', imagen: cuenta.avatar }
    : { url: '', etiqueta: 'La Secta', imagen: AVATAR_INVITADO };
  const opciones = [
    porDefecto,
    ...AVATARES_SALA.filter((a) => cuenta || a.url !== AVATAR_INVITADO).map((a) => ({ ...a, imagen: a.url })),
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

      <fieldset>
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
        </div>
      </fieldset>

      <div aria-live="polite">
        {error && (
          <p id="sala-pref-error" className="text-sm text-red-400">
            {error.error}
          </p>
        )}
        {resultado?.ok && <p className="text-sm text-on-surface-muted">Guardado.</p>}
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
