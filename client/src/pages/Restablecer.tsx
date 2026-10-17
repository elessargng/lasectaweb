import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Button from '../components/Button';
import Cita from '../components/Cita';
import { Check, X } from 'lucide-react';
import { parseApiResponse } from '../utils/api';

/** Página a la que lleva el enlace del correo de recuperación de contraseña. */
const Restablecer = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [status, setStatus] = useState<'form' | 'sending' | 'success'>('form');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== repeat) {
      setError('Las dos contraseñas no coinciden.');
      return;
    }

    setStatus('sending');
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';
      const response = await fetch(`${apiUrl}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });
      const data = await parseApiResponse(response);
      setMessage(data.message || 'Contraseña cambiada. Ya puedes iniciar sesión con la nueva.');
      setStatus('success');
    } catch (err: any) {
      setError(err.message === 'Failed to fetch'
        ? 'Los dioses no responden. Las crónicas no pudieron conectar con el servidor.'
        : err.message || 'No se pudo cambiar la contraseña.');
      setStatus('form');
    }
  };

  const inputClass = 'bg-surface-low border border-outline-ghost rounded px-3 py-2 text-on-surface focus:outline-none focus:border-theme-main transition-colors';

  return (
    <div className="flex flex-col w-full">
      <PageHeader
        title="Nueva Contraseña"
        imageSrc="/moon_banner_wide.jpg"
        imageAlt="Portal a La Secta"
        maxWidthClass="max-w-xl"
      />

      <div className="max-w-xl w-full mx-auto px-0 md:px-8 py-4 md:py-10 relative z-20 -mt-20">
        <div className="bg-transparent md:bg-surface border-0 md:border border-transparent md:border-outline-ghost p-4 md:p-10 rounded-none md:rounded shadow-none md:shadow-2xl relative flex flex-col gap-6">

          <Cita texto="Hasta los pergaminos más antiguos admiten una nueva firma." />

          {!token && (
            <div className="flex flex-col items-center gap-6 py-6 text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex justify-center items-center border border-red-500/30">
                <X className="text-red-500" size={32} />
              </div>
              <p className="text-red-500 font-body text-sm leading-relaxed">
                Falta el token del enlace. Asegúrate de abrir el enlace completo del correo.
              </p>
              <Button onClick={() => navigate('/')} variant="secondary" className="w-full mt-4 py-3">
                Volver al Inicio
              </Button>
            </div>
          )}

          {token && status === 'success' && (
            <div className="flex flex-col items-center gap-6 py-6 text-center">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex justify-center items-center border border-green-500/30">
                <Check className="text-green-500" size={32} />
              </div>
              <p className="text-on-surface-muted font-body text-sm leading-relaxed">{message}</p>
              <Button onClick={() => navigate('/')} variant="primary" className="w-full mt-4 py-3">
                Ir al Inicio e Identificarse
              </Button>
            </div>
          )}

          {token && status !== 'success' && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded text-sm font-body">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label htmlFor="restablecer-contrasena" className="text-sm font-display text-on-surface-muted">Contraseña nueva</label>
                <input id="restablecer-contrasena" required type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="restablecer-repetir" className="text-sm font-display text-on-surface-muted">Repite la contraseña</label>
                <input id="restablecer-repetir" required type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} className={inputClass} />
              </div>

              <Button type="submit" variant="primary" className="mt-4 py-3" disabled={status === 'sending'}>
                {status === 'sending' ? 'Guardando...' : 'Guardar contraseña'}
              </Button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};

export default Restablecer;
