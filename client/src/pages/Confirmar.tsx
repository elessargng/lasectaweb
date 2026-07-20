import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Button from '../components/Button';
import Cita from '../components/Cita';
import { Check, X, Loader2 } from 'lucide-react';
import { parseApiResponse } from '../utils/api';

const Confirmar = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const hasRun = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Falta el token de confirmación. Por favor, asegúrate de que el enlace sea correcto.');
      return;
    }

    if (hasRun.current) return;
    hasRun.current = true;

    const verifyEmail = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';
        const response = await fetch(`${apiUrl}/auth/confirm?token=${token}`);
        const data = await parseApiResponse(response);

        setStatus('success');
        setMessage(data.message || 'Tu cuenta ha sido verificada correctamente.');
      } catch (err: any) {
        setStatus('error');
        setMessage(err.message || 'Ocurrió un error inesperado al procesar el ritual de verificación.');
      }
    };

    verifyEmail();
  }, [token]);

  return (
    <div className="flex flex-col w-full">
      <PageHeader
        title="Confirmación de Cuenta"
        imageSrc="/moon_banner_wide.jpg"
        imageAlt="Portal a La Secta"
        maxWidthClass="max-w-xl"
      />

      <div className="max-w-xl w-full mx-auto px-0 md:px-8 py-4 md:py-10 relative z-20 -mt-20">
        <div className="bg-transparent md:bg-surface border-0 md:border border-transparent md:border-outline-ghost p-4 md:p-10 rounded-none md:rounded shadow-none md:shadow-2xl relative text-center flex flex-col gap-6">

          <Cita texto="Tu alma ha sido convocada. Los registros del grimorio aguardan." />

          {status === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="text-theme-main animate-spin" size={48} />
              <p className="text-on-surface-muted font-body text-sm">Comprobando inscripción en los pergaminos...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center gap-6 py-6">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex justify-center items-center border border-green-500/30">
                <Check className="text-green-500" size={32} />
              </div>
              <h3 className="text-2xl font-display text-white">¡Bienvenido a La Secta!</h3>
              <p className="text-on-surface-muted font-body text-sm leading-relaxed">
                {message}
              </p>
              <Button
                onClick={() => navigate('/')}
                variant="primary"
                className="w-full mt-4 py-3"
              >
                Ir al Inicio e Identificarse
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-6 py-6">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex justify-center items-center border border-red-500/30">
                <X className="text-red-500" size={32} />
              </div>
              <h3 className="text-2xl font-display text-white">Ritual Fallido</h3>
              <p className="text-red-500 font-body text-sm leading-relaxed">
                {message}
              </p>
              <Button
                onClick={() => navigate('/')}
                variant="secondary"
                className="w-full mt-4 py-3"
              >
                Volver al Inicio
              </Button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Confirmar;
