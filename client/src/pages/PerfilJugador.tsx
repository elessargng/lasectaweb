import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Lock } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { getAvatarUrl } from '../utils/api';
import { getPerfilPublico, type PerfilPublico } from '../utils/estadisticasApi';
import { Caja } from './Estadisticas';

/**
 * El perfil de otra persona, para cualquiera: su nombre, su avatar, desde cuándo
 * está y, si las tiene públicas, sus estadísticas de la sala. El propio es la
 * página de perfil de siempre. Se abre, por ejemplo, desde la lista de
 * participantes de la sala.
 */
const PerfilJugador = () => {
  const { userId = '' } = useParams();
  const { user } = useAuth();
  const [perfil, setPerfil] = useState<PerfilPublico | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setPerfil(null);
    setError('');
    getPerfilPublico(userId)
      .then(setPerfil)
      .catch((e: Error) => setError(e.message));
  }, [userId]);

  if (user?.id === userId) return <Navigate to="/profile" replace />;

  return (
    <div className="flex flex-col w-full">
      <PageHeader
        title={perfil?.username ?? 'Perfil'}
        subtitle="Perfil de jugador"
        imageSrc="/profile_banner_wide.jpg"
        imageAlt=""
        maxWidthClass="max-w-4xl"
      />
      <Caja>
        {error && <p className="text-on-surface-muted">{error}</p>}
        {!perfil && !error && <p className="text-on-surface-muted">Cargando…</p>}
        {perfil && (
          <>
            <div className="flex items-center gap-4">
              <img src={getAvatarUrl(perfil.profilePicture)} alt="" className="h-20 w-20 rounded-full object-cover border border-outline-ghost" />
              <div>
                <h2 className="font-display text-2xl text-on-surface">{perfil.username}</h2>
                <p className="text-sm text-on-surface-muted">
                  En La Secta desde {new Date(perfil.createdAt).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
            {perfil.estadisticasPublicas ? (
              <div className="flex flex-col gap-4 rounded border border-outline-ghost bg-surface-low p-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-on-surface-muted">Sus partidas, los roles que ha jugado, sus logros y la crónica de cada partida.</p>
                <Button to={`/estadisticas/${perfil.userId}`} variant="primary" className="px-6 py-2 shrink-0">
                  Ver sus estadísticas
                </Button>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-on-surface-muted">
                <Lock className="w-4 h-4" aria-hidden="true" /> Sus estadísticas son privadas.
              </p>
            )}
            <Link to="/estadisticas" className="inline-block text-theme-main hover:underline">
              Ver otras estadísticas públicas
            </Link>
          </>
        )}
      </Caja>
    </div>
  );
};

export default PerfilJugador;
