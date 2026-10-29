import { useRef, useState, type FormEvent } from 'react';
import { useAriaLive } from './avisosConfig';
import { botonPrincipal, botonSecundario, campo } from './estilos';
import type { ControlJarvis } from './jarvis';

interface PanelJarvisProps {
  conCuenta: boolean;
  jarvis: ControlJarvis;
}

type Campo = 'endpoint' | 'modelo' | 'apiKey';

/**
 * Pestaña Jarvis: el modelo que guía al narrador virtual Jarvis (JEV, de TypeSafe),
 * con su endpoint, el modelo y tu key. Al guardar se comprueba que responde; solo
 * entonces se puede añadir a Jarvis. La key no vuelve a verse: si ya hay una, el
 * campo dice en qué termina y, vacío, se queda la que había. Solo con cuenta.
 */
const PanelJarvis = ({ conCuenta, jarvis }: PanelJarvisProps) => {
  const { configuracion } = jarvis;
  // Lo escrito, o null mientras no se toca (entonces, lo guardado)
  const [endpointEscrito, setEndpoint] = useState<string | null>(null);
  const [modeloEscrito, setModelo] = useState<string | null>(null);
  const endpoint = endpointEscrito ?? configuracion?.endpoint ?? '';
  const modelo = modeloEscrito ?? configuracion?.modelo ?? '';
  const [apiKey, setApiKey] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<{ texto: string; campo?: Campo } | null>(null);
  const [aviso, setAviso] = useState('');
  const ariaLive = useAriaLive(error ? 'errores' : 'preferencias');
  const endpointRef = useRef<HTMLInputElement>(null);
  const modeloRef = useRef<HTMLInputElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);

  if (!conCuenta) {
    return <p className="text-sm text-on-surface-muted">Para enganchar el modelo de Jarvis necesitas una cuenta: inicia sesión.</p>;
  }

  const hacer = async (accion: () => Promise<{ ok: boolean; error: string | null; campo?: string }>, hecho: string) => {
    if (enviando) return;
    setEnviando(true);
    setError(null);
    setAviso('');
    const r = await accion();
    setEnviando(false);
    if (r.ok && !r.error) {
      setApiKey('');
      setAviso(hecho);
      return;
    }
    const cual = (['endpoint', 'modelo', 'apiKey'] as const).find((c) => c === r.campo);
    setError({ texto: r.ok ? `Guardado, pero no responde: ${r.error}` : (r.error ?? 'No se ha podido.'), campo: cual });
    ({ endpoint: endpointRef, modelo: modeloRef, apiKey: keyRef } as const)[cual ?? 'apiKey'].current?.focus();
  };

  const guardar = (e: FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() && !configuracion?.tieneKey) {
      setAviso('');
      setError({ texto: 'Escribe tu key.', campo: 'apiKey' });
      keyRef.current?.focus();
      return;
    }
    void hacer(() => jarvis.guardar({ endpoint, modelo, apiKey }), 'Guardado. Modelo comprobado: responde.');
  };

  const borrar = async () => {
    if (enviando) return;
    setEnviando(true);
    const fallo = await jarvis.borrar();
    setEnviando(false);
    setError(fallo ? { texto: fallo } : null);
    setAviso(fallo ? '' : 'Configuración de Jarvis quitada.');
    // El botón desaparece: el foco va al campo de la key
    if (!fallo) keyRef.current?.focus();
  };

  const props = (c: Campo, ayuda?: string) => ({
    'aria-invalid': error?.campo === c ? true : undefined,
    'aria-describedby': [ayuda, error?.campo === c ? 'sala-jarvis-error' : ''].filter(Boolean).join(' ') || undefined,
  });

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-on-surface-muted">
        Jarvis es un narrador virtual que decide con el modelo JEV de TypeSafe, usando tu key. Al guardar se comprueba que responde.
      </p>

      <form onSubmit={guardar} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="sala-jarvis-endpoint" className="text-sm text-on-surface-muted">
            Endpoint
          </label>
          <input
            ref={endpointRef}
            id="sala-jarvis-endpoint"
            type="url"
            value={endpoint}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setEndpoint(e.target.value)}
            {...props('endpoint')}
            className={campo}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="sala-jarvis-modelo" className="text-sm text-on-surface-muted">
            Modelo
          </label>
          <input
            ref={modeloRef}
            id="sala-jarvis-modelo"
            value={modelo}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setModelo(e.target.value)}
            {...props('modelo', 'sala-jarvis-modelo-ayuda')}
            className={campo}
          />
          <p id="sala-jarvis-modelo-ayuda" className="text-xs text-on-surface-muted">
            <span lang="en">jev-latest</span> apunta a la versión estable; <span lang="en">jev-preview</span>, a la más reciente.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="sala-jarvis-key" className="text-sm text-on-surface-muted">
            Key
          </label>
          <input
            ref={keyRef}
            id="sala-jarvis-key"
            type="password"
            value={apiKey}
            autoComplete="off"
            placeholder={configuracion?.tieneKey ? `Guardada, termina en ${configuracion.ultimos4}` : undefined}
            onChange={(e) => setApiKey(e.target.value)}
            {...props('apiKey', configuracion?.tieneKey ? 'sala-jarvis-key-ayuda' : undefined)}
            className={campo}
          />
          {configuracion?.tieneKey && (
            <p id="sala-jarvis-key-ayuda" className="text-xs text-on-surface-muted">
              Ya tienes una guardada, que termina en {configuracion.ultimos4}. Déjalo vacío para seguir con ella.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="submit" aria-disabled={enviando} className={botonPrincipal}>
            Guardar y comprobar
          </button>
          {configuracion?.tieneKey && (
            <button type="button" aria-disabled={enviando} onClick={() => void borrar()} className={botonSecundario}>
              Quitar
            </button>
          )}
        </div>
      </form>

      <div aria-live={ariaLive}>
        {error && (
          <p id="sala-jarvis-error" className="text-sm text-blood-pale">
            {error.texto}
          </p>
        )}
        {aviso && <p className="text-sm text-on-surface-muted">{aviso}</p>}
      </div>
      {/* Cómo está, fuera del aviso: no se anuncia al abrir la pestaña */}
      {!error && !aviso && configuracion?.tieneKey && (
        <p className="text-sm text-on-surface-muted">
          {configuracion.comprobadoEn ? 'Modelo comprobado: puedes añadir a Jarvis.' : 'Sin comprobar: guarda para comprobar que responde.'}
        </p>
      )}
    </div>
  );
};

export default PanelJarvis;
