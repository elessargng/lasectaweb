import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { parseApiResponse } from '../utils/api';
import { botonPrincipal, campo } from './estilos';
import { NOMBRE_MAX, getUltimoNombre, limpiarNombre } from './invitado';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api'}/auth`;

const labelClass = 'campo-etiqueta mb-0!';

interface EntradaProps {
  /** Hay que mover el foco al título (se vuelve aquí desde la sala). */
  enfocar: boolean;
  /** Aviso con el que se llega aquí (sesión caducada, por ejemplo). */
  aviso: string;
  /** Error del nombre de invitado con el que se vuelve aquí (ya lo usa otro). */
  errorInvitado: string;
  onInvitado: (nombre: string) => void;
}

/**
 * Pantalla de entrada a la sala para quien no tiene sesión en la web: o inicia
 * sesión con su cuenta de La Secta o entra como invitado con un nombre. Las dos
 * opciones van una tras otra con su título, para llegar a cada una navegando
 * por títulos.
 */
const Entrada = ({ enfocar, aviso, errorInvitado, onInvitado }: EntradaProps) => {
  const { login } = useAuth();
  const tituloRef = useRef<HTMLHeadingElement>(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorLogin, setErrorLogin] = useState('');

  const [nombre, setNombre] = useState(getUltimoNombre);
  const [errorNombre, setErrorNombre] = useState(errorInvitado);
  const nombreRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (enfocar) tituloRef.current?.focus();
  }, [enfocar]);

  // El foco va al campo cuando el error ya está pintado, para que el lector lo lea con él.
  useEffect(() => {
    if (errorNombre) nombreRef.current?.focus();
  }, [errorNombre]);

  const iniciarSesion = async (e: FormEvent) => {
    e.preventDefault();
    setErrorLogin('');
    setEnviando(true);
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, remember }),
      });
      const data = await parseApiResponse(response);
      login(data.user, data.token, remember);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setErrorLogin(
        message === 'Failed to fetch' || !message
          ? 'No se pudo conectar con el servidor. Inténtalo de nuevo.'
          : message,
      );
      setEnviando(false);
    }
  };

  const entrarComoInvitado = (e: FormEvent) => {
    e.preventDefault();
    const limpio = limpiarNombre(nombre);
    if (!limpio) {
      setErrorNombre('Escribe un nombre para entrar.');
      if (errorNombre) nombreRef.current?.focus();
      return;
    }
    onInvitado(limpio);
  };

  return (
    <>
      <h1 ref={tituloRef} tabIndex={-1} className="mb-2 font-display text-4xl text-gold-bright drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)] focus:outline-none">
        Entrar en la sala de juego
      </h1>
      <p className="mb-8 text-lg text-on-surface [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]">
        Entra con tu cuenta de La Secta o, si no tienes, con el nombre que quieras usar en la partida.
      </p>

      {aviso && (
        <p className="sala-aviso mb-8 px-4 py-3">{aviso}</p>
      )}

      <div className="grid gap-8 md:grid-cols-2">
        <section aria-labelledby="entrada-cuenta" className="sala-cofre sala-cofre-esquinas p-6">
          <h2 id="entrada-cuenta" className="sala-cofre-titulo mb-4">Con tu cuenta</h2>
          <form onSubmit={iniciarSesion} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="entrada-usuario" className={labelClass}>Nombre de usuario</label>
              <input
                id="entrada-usuario"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                aria-invalid={errorLogin ? true : undefined}
                aria-describedby={errorLogin ? 'entrada-error-login' : undefined}
                className={campo}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="entrada-contrasena" className={labelClass}>Contraseña</label>
              <input
                id="entrada-contrasena"
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={errorLogin ? true : undefined}
                aria-describedby={errorLogin ? 'entrada-error-login' : undefined}
                className={campo}
              />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <input
                  id="entrada-recordarme"
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  aria-describedby="entrada-recordarme-ayuda"
                  className="w-4 h-4 accent-theme-main"
                />
                <label htmlFor="entrada-recordarme" className={labelClass}>Recordarme</label>
              </div>
              <p id="entrada-recordarme-ayuda" className="text-xs text-on-surface-muted">
                Mantiene la sesión 30 días en este navegador. No lo marques en un equipo compartido.
              </p>
            </div>
            <div aria-live="polite">
              {errorLogin && (
                <p id="entrada-error-login" className="text-sm text-blood-pale">{errorLogin}</p>
              )}
            </div>
            <button type="submit" disabled={enviando} className={botonPrincipal}>
              {enviando ? 'Entrando…' : 'Iniciar sesión'}
            </button>
            <p className="text-sm text-on-surface-muted">
              ¿Aún no tienes cuenta?{' '}
              <a href="/" target="_blank" rel="noopener" className="text-theme-main underline hover:text-gold-bright">
                Regístrate en la web
                <span className="sr-only"> (se abre en una ventana nueva)</span>
              </a>
            </p>
          </form>
        </section>

        <section aria-labelledby="entrada-invitado" className="sala-cofre sala-cofre-esquinas p-6">
          <h2 id="entrada-invitado" className="sala-cofre-titulo mb-4">Sin cuenta</h2>
          <form onSubmit={entrarComoInvitado} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="entrada-nombre" className={labelClass}>Tu nombre en la sala</label>
              <input
                id="entrada-nombre"
                ref={nombreRef}
                required
                maxLength={NOMBRE_MAX}
                autoComplete="nickname"
                value={nombre}
                onChange={(e) => {
                  setNombre(e.target.value);
                  if (errorNombre) setErrorNombre('');
                }}
                aria-invalid={errorNombre ? true : undefined}
                aria-describedby={errorNombre ? 'entrada-error-nombre' : undefined}
                className={campo}
              />
              {errorNombre && (
                <p id="entrada-error-nombre" className="text-sm text-blood-pale">{errorNombre}</p>
              )}
            </div>
            <button type="submit" className={botonPrincipal}>Entrar como invitado</button>
          </form>
        </section>
      </div>
    </>
  );
};

export default Entrada;
