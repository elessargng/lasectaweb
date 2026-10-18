import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Users } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { EstadisticasDeUsuario } from '../components/estadisticas/PanelEstadisticas';
import { useAuth } from '../context/AuthContext';
import { getAvatarUrl } from '../utils/api';
import { getJugadoresPublicos, type JugadorPublico } from '../utils/estadisticasApi';

/**
 * Las estadísticas de la sala: sin id, quienes las tienen públicas (cada uno
 * lleva a su perfil); con id, las de esa persona (las propias se ven siempre; las
 * de otro, si las tiene públicas). Se guardan solas al terminar cada partida.
 */
const Estadisticas = () => {
  const { userId } = useParams();
  return (
    <div className="flex flex-col w-full">
      <PageHeader
        title="Estadísticas"
        subtitle="Lo que se ha jugado en la sala de La Secta"
        imageSrc="/profile_banner_wide.jpg"
        imageAlt="Estadísticas de las partidas"
        maxWidthClass="max-w-4xl"
      />
      <Caja>{userId ? <EstadisticasDeUsuario userId={userId} /> : <ListaPublicas />}</Caja>
    </div>
  );
};

export const Caja = ({ children }: { children: ReactNode }) => (
  <div className="max-w-4xl w-full mx-auto px-0 md:px-8 py-4 md:py-10 relative z-20 -mt-20">
    <div className="bg-transparent md:bg-surface border-0 md:border border-transparent md:border-outline-ghost rounded-none md:rounded shadow-none md:shadow-2xl px-4 py-6 md:p-10 space-y-10 font-body">
      {children}
    </div>
  </div>
);

const ListaPublicas = () => {
  const { user } = useAuth();
  const [jugadores, setJugadores] = useState<JugadorPublico[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getJugadoresPublicos()
      .then(setJugadores)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <>
      {user && (
        <p className="text-sm text-on-surface-muted">
          Las tuyas están en tu{' '}
          <Link to="/profile" className="text-theme-main hover:underline">
            perfil
          </Link>
          , donde también eliges si son públicas.
        </p>
      )}
      <section aria-labelledby="estadisticas-publicas">
        <h2 id="estadisticas-publicas" className="text-xl font-display text-theme-main flex items-center gap-2 mb-4">
          <Users className="w-5 h-5" aria-hidden="true" /> Estadísticas públicas
        </h2>
        {error && <p className="text-blood-bright">{error}</p>}
        {!jugadores && !error && <p className="text-on-surface-muted">Cargando…</p>}
        {jugadores?.length === 0 && <p className="text-on-surface-muted">Aún nadie ha hecho públicas sus estadísticas.</p>}
        {jugadores && jugadores.length > 0 && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {jugadores.map((j) => (
              <li key={j.userId}>
                <Link
                  to={`/perfil/${j.userId}`}
                  className="flex items-center gap-3 rounded border border-outline-ghost bg-surface-low p-3 hover:border-theme-main/60"
                >
                  <img src={getAvatarUrl(j.profilePicture)} alt="" className="h-10 w-10 rounded-full object-cover" />
                  <span className="flex-1 font-display text-on-surface">{j.username}</span>
                  <span className="text-sm text-on-surface-muted">
                    {j.partidas} {j.partidas === 1 ? 'partida' : 'partidas'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
};

export default Estadisticas;
