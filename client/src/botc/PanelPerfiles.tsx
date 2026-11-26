import { useRef, useState, type FormEvent } from 'react';
import { useAriaLive } from './avisosConfig';
import { NOMBRE_PERFIL_MAX, type PerfilConfiguracion } from './configuracion';
import { botonPrincipal, botonSecundario, campo } from './estilos';

interface PanelPerfilesProps {
  /** Sin cuenta no se guarda nada: solo se explica. */
  conCuenta: boolean;
  /** Si se pudo traer la configuración de la cuenta. */
  carga: 'cargando' | 'lista' | 'error';
  perfiles: PerfilConfiguracion[];
  /** Guardan o borran; devuelven el error, si lo hay. */
  onGuardar: (nombre: string) => Promise<string | null>;
  onBorrar: (id: number) => Promise<string | null>;
  onAplicar: (perfil: PerfilConfiguracion) => Promise<string | null>;
}


/**
 * Pestaña Perfiles: guardar la configuración de ahora con un nombre y volver a
 * ella después. Un perfil lleva todo menos las comunicaciones y la imagen de
 * perfil. Solo con cuenta: se guarda en el servidor.
 */
const PanelPerfiles = ({ conCuenta, carga, perfiles, onGuardar, onBorrar, onAplicar }: PanelPerfilesProps) => {
  const [nombre, setNombre] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<{ texto: string; delNombre: boolean } | null>(null);
  const [aviso, setAviso] = useState('');
  const ariaLive = useAriaLive(error ? 'errores' : 'preferencias');
  const nombreRef = useRef<HTMLInputElement>(null);

  if (!conCuenta) {
    return (
      <p className="text-sm text-on-surface-muted">
        Sin cuenta, tu configuración solo dura mientras estés en la sala. Inicia sesión para que se guarde y para crear
        perfiles.
      </p>
    );
  }

  const hacer = async (accion: () => Promise<string | null>, hecho: string, delNombre = false) => {
    if (enviando) return false;
    setEnviando(true);
    setError(null);
    setAviso('');
    const fallo = await accion();
    setEnviando(false);
    if (fallo) setError({ texto: fallo, delNombre });
    else setAviso(hecho);
    return !fallo;
  };

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    const limpio = nombre.replace(/\s+/g, ' ').trim();
    if (!limpio) {
      setAviso('');
      setError({ texto: 'Escribe un nombre para el perfil.', delNombre: true });
      nombreRef.current?.focus();
      return;
    }
    const existe = perfiles.some((p) => p.nombre.toLocaleLowerCase('es') === limpio.toLocaleLowerCase('es'));
    if (await hacer(() => onGuardar(limpio), existe ? `Perfil ${limpio} actualizado.` : `Perfil ${limpio} guardado.`, true))
      setNombre('');
  };

  const errorNombre = error?.delNombre ? error : null;

  return (
    <div className="flex flex-col gap-6">
      {carga === 'error' && (
        <p className="text-sm text-blood-pale">
          No se pudo cargar tu configuración guardada; los cambios de ahora no se guardarán. Recarga la página para
          volver a intentarlo.
        </p>
      )}

      <form onSubmit={guardar} className="flex flex-col gap-1">
        <label htmlFor="sala-perfil-nombre" className="text-sm text-on-surface-muted">
          Nombre del perfil
        </label>
        <div className="flex flex-wrap gap-3">
          <input
            ref={nombreRef}
            id="sala-perfil-nombre"
            value={nombre}
            maxLength={NOMBRE_PERFIL_MAX}
            autoComplete="off"
            onChange={(e) => setNombre(e.target.value)}
            aria-invalid={errorNombre ? true : undefined}
            aria-describedby={['sala-perfil-ayuda', errorNombre ? 'sala-perfil-error' : ''].join(' ').trim()}
            className={`${campo} min-w-0 flex-1`}
          />
          <button type="submit" aria-disabled={enviando} className={botonPrincipal}>
            Guardar perfil
          </button>
        </div>
        <p id="sala-perfil-ayuda" className="text-xs text-on-surface-muted">
          Guarda la configuración de ahora, salvo las comunicaciones y la imagen de perfil. Con un nombre que ya existe,
          lo sustituye.
        </p>
      </form>

      <div aria-live={ariaLive}>
        {error && (
          <p id="sala-perfil-error" className="text-sm text-blood-pale">
            {error.texto}
          </p>
        )}
        {aviso && <p className="text-sm text-on-surface-muted">{aviso}</p>}
      </div>

      {perfiles.length === 0 ? (
        <p className="text-sm text-on-surface-muted">Todavía no tienes perfiles guardados.</p>
      ) : (
        <ul aria-label="Tus perfiles" className="flex flex-col gap-3">
          {perfiles.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3">
              <span className="min-w-40 flex-1 break-words text-sm">{p.nombre}</span>
              <button
                type="button"
                aria-label={`Aplicar ${p.nombre}`}
                aria-disabled={enviando}
                onClick={() => void hacer(() => onAplicar(p), `Perfil ${p.nombre} aplicado.`)}
                className={botonSecundario}
              >
                Aplicar
              </button>
              <button
                type="button"
                aria-label={`Borrar ${p.nombre}`}
                aria-disabled={enviando}
                onClick={async () => {
                  // El botón desaparece: el foco va al campo del nombre.
                  if (await hacer(() => onBorrar(p.id), `Perfil ${p.nombre} borrado.`)) nombreRef.current?.focus();
                }}
                className={botonSecundario}
              >
                Borrar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PanelPerfiles;
