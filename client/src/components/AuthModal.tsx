import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { X, Check, Plus } from 'lucide-react';
import Button from './Button';
import { compressImage } from '../utils/image';
import { parseApiResponse } from '../utils/api';
import Dialog from './Dialog';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AVATAR_OPTIONS = [
  { id: 'default', url: '/avatar.png', label: 'Adepto' },
  { id: 'wizard', url: '/avatars/wizard.png', label: 'Hechicero' },
  { id: 'sorceress', url: '/avatars/sorceress.png', label: 'Hechicera' },
  { id: 'rogue', url: '/avatars/rogue.png', label: 'Asesino' },
  { id: 'noble', url: '/avatars/noble.png', label: 'Noble' }
];

const API_URL = `${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api'}/auth`;

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { login } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [remember, setRemember] = useState(false);
  // Formulario de «¿Has olvidado tu contraseña?», dentro de la pestaña Entrar.
  const [isForgot, setIsForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSending, setForgotSending] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    realName: '',
    botcUsername: '',
    email: '',
    telegramUsername: '',
    profilePicture: AVATAR_OPTIONS[0].url
  });

  React.useEffect(() => {
    if (!isOpen) {
      setSuccessMessage('');
      setError('');
      setCustomAvatar(null);
      setAcceptTerms(false);
      setIsForgot(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const selectAvatar = (url: string) => {
    setFormData({ ...formData, profilePicture: url });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    try {
      const base64 = await compressImage(file);
      setCustomAvatar(base64);
      setFormData((prev) => ({ ...prev, profilePicture: base64 }));
    } catch (err: any) {
      setError('Error al procesar la imagen. Inténtalo de nuevo.');
    }
  };

  const visibleAvatars = [
    ...AVATAR_OPTIONS,
    ...(customAvatar ? [{ id: 'custom', url: customAvatar, label: 'Personalizado' }] : [])
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isLogin && !acceptTerms) {
      setError('Debes aceptar la Política de Privacidad para unirte a La Secta.');
      return;
    }

    try {
      const endpoint = isLogin ? '/login' : '/register';
      const body = isLogin 
        ? { username: formData.username, password: formData.password, remember }
        : formData;

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await parseApiResponse(response);

      if (isLogin) {
        login(data.user, data.token, remember);
        onClose();
      } else {
        setSuccessMessage(data.message || 'El ritual de registro ha comenzado. Por favor, revisa tu correo electrónico para confirmar tu cuenta.');
      }
    } catch (err: any) {
      if (err.message === 'Failed to fetch') {
        setError('Los dioses no responden. Las crónicas no pudieron conectar con el servidor.');
      } else {
        setError(err.message);
      }
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setForgotSending(true);
    try {
      const response = await fetch(`${API_URL}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail })
      });
      const data = await parseApiResponse(response);
      setSuccessMessage(data.message || 'Si ese correo pertenece a alguna cuenta, recibirás un enlace para elegir una contraseña nueva.');
    } catch (err: any) {
      setError(err.message === 'Failed to fetch'
        ? 'Los dioses no responden. Las crónicas no pudieron conectar con el servidor.'
        : err.message);
    } finally {
      setForgotSending(false);
    }
  };

  if (successMessage) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
        <Dialog onClose={onClose} labelledBy="auth-exito-titulo" className="bg-surface border border-outline-ghost rounded shadow-2xl w-full max-w-md overflow-hidden flex flex-col p-8 text-center gap-6">
          <div className="w-16 h-16 bg-theme-main/10 rounded-full flex justify-center items-center mx-auto border border-theme-main/30 animate-pulse">
            <Check className="text-theme-main" size={32} />
          </div>
          <h2 id="auth-exito-titulo" className="text-2xl font-display text-on-surface">
            {isForgot ? 'Revisa tu correo' : 'Ritual Iniciado'}
          </h2>
          <p className="text-on-surface-muted font-body text-sm leading-relaxed">
            {successMessage}
          </p>
          <Button 
            onClick={() => {
              setSuccessMessage('');
              setIsLogin(true);
              setIsForgot(false);
            }}
            variant="primary" 
            className="w-full mt-2 py-3"
          >
            Volver a Identificarse
          </Button>
        </Dialog>
      </div>
    );
  }

  if (isForgot) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
        <Dialog onClose={onClose} labelledBy="auth-olvido-titulo" className="bg-surface border border-outline-ghost rounded shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
          <div className="flex justify-between items-center p-6 border-b border-outline-ghost">
            <h2 id="auth-olvido-titulo" className="text-2xl font-display text-on-surface">Recuperar contraseña</h2>
            <Button onClick={onClose} variant="text" aria-label="Cerrar" className="text-on-surface-muted hover:text-theme-main transition-colors">
              <X size={24} />
            </Button>
          </div>

          <div className="p-6 overflow-y-auto">
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded mb-4 text-sm font-body">
                {error}
              </div>
            )}

            <form onSubmit={handleForgotSubmit} className="flex flex-col gap-4">
              <p className="text-sm font-body text-on-surface-muted leading-relaxed">
                Escribe el correo con el que te registraste y te enviaremos un enlace para elegir una contraseña nueva.
              </p>
              <div className="flex flex-col gap-1">
                <label htmlFor="auth-olvido-correo" className="text-sm font-display text-on-surface-muted">Correo electrónico</label>
                <input id="auth-olvido-correo" required type="email" autoComplete="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} className="bg-surface-low border border-outline-ghost rounded px-3 py-2 text-on-surface focus:outline-none focus:border-theme-main transition-colors" />
              </div>
              <Button type="submit" variant="primary" className="mt-2 py-3" disabled={forgotSending}>
                {forgotSending ? 'Enviando...' : 'Enviar enlace'}
              </Button>
              <Button
                type="button"
                variant="text"
                onClick={() => { setIsForgot(false); setError(''); }}
                className="text-sm font-body text-on-surface-muted hover:text-theme-main transition-colors"
              >
                Volver a iniciar sesión
              </Button>
            </form>
          </div>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <Dialog onClose={onClose} labelledBy="auth-titulo" className="bg-surface border border-outline-ghost rounded shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-outline-ghost">
          <h2 id="auth-titulo" className="text-2xl font-display text-on-surface">
            {isLogin ? 'Iniciar Sesión' : 'Unirse a la Secta'}
          </h2>
          <Button onClick={onClose} variant="text" aria-label="Cerrar" className="text-on-surface-muted hover:text-theme-main transition-colors">
            <X size={24} />
          </Button>
        </div>

        <div className="flex border-b border-outline-ghost">
          <Button
            variant="text"
            className={`flex-1 py-3 font-display transition-colors ${isLogin ? 'bg-theme-main/10 text-theme-main border-b-2 border-theme-main' : 'text-on-surface-muted hover:bg-surface-high'}`}
            onClick={() => setIsLogin(true)}
          >
            Entrar
          </Button>
          <Button
            variant="text"
            className={`flex-1 py-3 font-display transition-colors ${!isLogin ? 'bg-theme-main/10 text-theme-main border-b-2 border-theme-main' : 'text-on-surface-muted hover:bg-surface-high'}`}
            onClick={() => setIsLogin(false)}
          >
            Registro
          </Button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded mb-4 text-sm font-body">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="auth-nombre-de-usuario" className="text-sm font-display text-on-surface-muted">Nombre de usuario</label>
              <input id="auth-nombre-de-usuario" required name="username" value={formData.username} onChange={handleChange} className="bg-surface-low border border-outline-ghost rounded px-3 py-2 text-on-surface focus:outline-none focus:border-theme-main transition-colors" />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="auth-contrasena" className="text-sm font-display text-on-surface-muted">Contraseña</label>
              <input id="auth-contrasena" required type="password" name="password" value={formData.password} onChange={handleChange} className="bg-surface-low border border-outline-ghost rounded px-3 py-2 text-on-surface focus:outline-none focus:border-theme-main transition-colors" />
              {isLogin && (
                <Button
                  type="button"
                  variant="text"
                  onClick={() => { setIsForgot(true); setError(''); }}
                  className="self-end text-xs font-body text-on-surface-muted hover:text-theme-main transition-colors"
                >
                  ¿Has olvidado tu contraseña?
                </Button>
              )}
            </div>

            {isLogin && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="auth-recordarme"
                    name="remember"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    aria-describedby="auth-recordarme-ayuda"
                    className="w-4 h-4 rounded border-outline-ghost text-theme-main focus:ring-theme-main accent-theme-main bg-surface-low cursor-pointer shrink-0"
                  />
                  <label htmlFor="auth-recordarme" className="text-sm font-display text-on-surface-muted cursor-pointer select-none">
                    Recordarme
                  </label>
                </div>
                <p id="auth-recordarme-ayuda" className="text-xs font-body text-on-surface-muted opacity-80">
                  Mantiene la sesión 30 días en este navegador. No lo marques en un equipo compartido.
                </p>
              </div>
            )}

            {!isLogin && (
              <>
                <div className="flex flex-col gap-1">
                  <label htmlFor="auth-nombre-real" className="text-sm font-display text-on-surface-muted">Nombre real</label>
                  <input id="auth-nombre-real" required name="realName" value={formData.realName} onChange={handleChange} className="bg-surface-low border border-outline-ghost rounded px-3 py-2 text-on-surface focus:outline-none focus:border-theme-main transition-colors" />
                </div>
                
                <div className="flex flex-col gap-1">
                  <label htmlFor="auth-nombre-en-botc-app" className="text-sm font-display text-on-surface-muted">Nombre en BotC.app</label>
                  <input id="auth-nombre-en-botc-app" name="botcUsername" value={formData.botcUsername} onChange={handleChange} className="bg-surface-low border border-outline-ghost rounded px-3 py-2 text-on-surface focus:outline-none focus:border-theme-main transition-colors" />
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="auth-correo-electronico" className="text-sm font-display text-on-surface-muted">Correo electrónico</label>
                  <input id="auth-correo-electronico" required type="email" name="email" value={formData.email} onChange={handleChange} className="bg-surface-low border border-outline-ghost rounded px-3 py-2 text-on-surface focus:outline-none focus:border-theme-main transition-colors" />
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="auth-usuario-de-telegram" className="text-sm font-display text-on-surface-muted">Usuario de Telegram</label>
                  <input id="auth-usuario-de-telegram" name="telegramUsername" value={formData.telegramUsername} onChange={handleChange} className="bg-surface-low border border-outline-ghost rounded px-3 py-2 text-on-surface focus:outline-none focus:border-theme-main transition-colors" />
                </div>

                <div className="flex flex-col gap-2 mt-2">
                  <p id="auth-avatar" className="text-sm font-display text-on-surface-muted">Selecciona tu Avatar</p>
                  <div role="group" aria-labelledby="auth-avatar" className="flex gap-3 overflow-x-auto pb-2 pt-1">
                    {visibleAvatars.map((avatar) => (
                      <Button
                        key={avatar.id}
                        type="button"
                        onClick={() => selectAvatar(avatar.url)}
                        aria-pressed={formData.profilePicture === avatar.url}
                        variant="text"
                        className={`relative w-16 h-16 rounded overflow-hidden flex-shrink-0 transition-all ${formData.profilePicture === avatar.url ? 'ring-2 ring-theme-main ring-offset-2 ring-offset-surface' : 'opacity-70 hover:opacity-100 ring-1 ring-outline-ghost'}`}
                      >
                        <img src={avatar.url} alt={avatar.label} className="w-full h-full object-cover" />
                        {formData.profilePicture === avatar.url && (
                          <div className="absolute inset-0 bg-theme-main/20 flex justify-center items-center backdrop-blur-[1px]">
                            <Check className="text-white drop-shadow-md" size={24} />
                          </div>
                        )}
                      </Button>
                    ))}
                    
                    {/* Custom upload option */}
                    <label className="relative w-16 h-16 rounded overflow-hidden flex-shrink-0 transition-all flex flex-col justify-center items-center border border-dashed border-outline-ghost hover:border-theme-main cursor-pointer opacity-70 hover:opacity-100 focus-within:opacity-100 focus-within:ring-2 focus-within:ring-theme-main bg-surface-low">
                      <Plus size={20} className="text-on-surface-muted" />
                      <span className="text-[9px] font-display uppercase mt-1" aria-hidden="true">Subir</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        aria-label="Subir una imagen propia"
                        className="sr-only" 
                        onChange={handleFileChange} 
                      />
                    </label>
                  </div>
                </div>

                {/* Privacy Policy Agreement Checkbox */}
                <div className="flex items-start gap-2.5 mt-3 pt-3 border-t border-outline-ghost/50">
                  <input
                    required
                    type="checkbox"
                    id="acceptTerms"
                    name="acceptTerms"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-outline-ghost text-theme-main focus:ring-theme-main accent-theme-main bg-surface-low cursor-pointer shrink-0"
                  />
                  <label htmlFor="acceptTerms" className="text-xs font-body text-on-surface-muted leading-snug cursor-pointer select-none">
                    He leído y acepto la{' '}
                    <Link 
                      to="/privacidad" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-theme-main hover:underline font-semibold"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Política de Privacidad
                    </Link>{' '}
                    y las condiciones de La Secta.
                  </label>
                </div>
              </>
            )}

            <Button 
              type="submit" 
              variant="primary" 
              className={`mt-4 py-3 ${!isLogin && !acceptTerms ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={!isLogin && !acceptTerms}
            >
              {isLogin ? 'Entrar a las Crónicas' : 'Completar Ritual'}
            </Button>
          </form>
        </div>
      </Dialog>
    </div>
  );
};

export default AuthModal;
