import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Button from '../components/Button';
import { Check, X, Shield, BookOpen, User as UserIcon, Loader2 } from 'lucide-react';
import { parseApiResponse, getAvatarUrl } from '../utils/api';

interface UserRow {
  id: string;
  username: string;
  realName: string;
  email: string;
  profilePicture: string;
  roles: ('editor' | 'narrador' | 'admin')[];
}

interface PendingRequest {
  id: string;
  userId: string;
  username: string;
  realName: string;
  requestedRole: 'editor' | 'narrador';
  status: string;
  createdAt: string;
}

const Gestion = () => {
  const { user, token, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Comprobar permisos
  const isAdmin = user?.roles?.includes('admin') || false;
  const isNarrador = user?.roles?.includes('narrador') || false;
  const isEditor = user?.roles?.includes('editor') || false;
  const hasAccess = isAdmin || isNarrador || isEditor;

  const fetchUsersAndRequests = async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError('');

      const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';

      // Obtener usuarios
      const usersRes = await fetch(`${apiUrl}/auth/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const usersData = await parseApiResponse(usersRes);
      setUsers(usersData);

      // Obtener solicitudes si es admin o narrador
      if (isAdmin || isNarrador) {
        const reqsRes = await fetch(`${apiUrl}/auth/role-requests/pending`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const reqsData = await parseApiResponse(reqsRes);
        setRequests(reqsData);
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }

    if (user && !hasAccess) {
      navigate('/profile');
      return;
    }

    fetchUsersAndRequests();
  }, [isAuthenticated, user, token, navigate]);

  const handleResolveRequest = async (requestId: string, approve: boolean) => {
    if (!token) return;
    setError('');
    setSuccess('');
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';
      const res = await fetch(`${apiUrl}/auth/role-requests/${requestId}/resolve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ approve })
      });
      await parseApiResponse(res);

      setSuccess(approve ? 'Solicitud aprobada con éxito.' : 'Solicitud rechazada con éxito.');
      fetchUsersAndRequests();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggleRole = async (targetUser: UserRow, roleToToggle: 'editor' | 'narrador' | 'admin') => {
    if (!token) return;
    setError('');
    setSuccess('');

    // Validar permisos rápidos en cliente
    if (isEditor && !isAdmin && !isNarrador) {
      setError('Los Editores no tienen permisos para modificar roles.');
      return;
    }
    if (roleToToggle === 'admin' && !isAdmin) {
      setError('Solo los Administradores pueden otorgar o revocar el rol de Administrador.');
      return;
    }

    setUpdatingUserId(targetUser.id);
    try {
      const isRoleActive = targetUser.roles.includes(roleToToggle);
      const newRoles = isRoleActive
        ? targetUser.roles.filter(r => r !== roleToToggle)
        : [...targetUser.roles, roleToToggle];

      const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';
      const res = await fetch(`${apiUrl}/auth/users/${targetUser.id}/roles`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ roles: newRoles })
      });

      await parseApiResponse(res);

      setSuccess(`Roles de ${targetUser.username} actualizados correctamente.`);
      fetchUsersAndRequests();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdatingUserId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col w-full items-center justify-center min-h-[50vh] gap-4">
        <Loader2 className="animate-spin text-theme-main h-12 w-12" />
        <p className="font-display text-on-surface-muted">Leyendo el grimorio de usuarios...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full">
      <PageHeader
        title="Panel de Gestión"
        imageSrc="/profile_banner_wide.jpg"
        imageAlt="Códice y Velas"
        maxWidthClass="max-w-7xl"
      />

      <div className="max-w-7xl w-full mx-auto px-0 md:px-6 py-4 md:py-10 relative z-20 -mt-20">
        <div className="bg-transparent md:bg-surface border-0 md:border border-transparent md:border-outline-ghost rounded-none md:rounded shadow-none md:shadow-2xl p-4 md:p-10">

          <h2 className="text-2xl font-display font-medium text-white mb-8 border-b border-outline-ghost pb-4">
            Gestión de Adeptos y Jerarquía
          </h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded mb-6 text-sm font-body">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-500/10 border border-green-500/50 text-green-500 p-4 rounded mb-6 text-sm font-body">
              {success}
            </div>
          )}

          {/* Sección de Solicitudes Pendientes (solo para Narradores o Admin) */}
          {(isAdmin || isNarrador) && (
            <div className="mb-10">
              <h3 className="text-xl font-display text-on-surface mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-theme-main"></span>
                Rituales de Ascenso Pendientes
              </h3>

              {requests.length === 0 ? (
                <div className="bg-surface-low border border-dashed border-outline-ghost p-6 rounded text-center text-on-surface-muted italic font-body">
                  No hay deliberaciones ni solicitudes de rango pendientes en este ciclo de luna.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {requests.map((req) => (
                    <div key={req.id} className="bg-surface-low border border-theme-main/30 p-5 rounded flex flex-col justify-between gap-4 shadow-md relative overflow-hidden">
                      <div className="absolute top-0 right-0 bg-theme-ritual-container text-theme-main px-3 py-1 text-xs font-display border-b border-l border-theme-main/30">
                        {req.requestedRole === 'editor' ? 'Conocimiento de Editor' : 'Rango de Narrador'}
                      </div>

                      <div className="flex gap-4 items-center">
                        <div className="flex flex-col">
                          <p className="font-display text-lg text-white font-medium">{req.realName || req.username}</p>
                          <p className="text-xs text-on-surface-muted font-body">@{req.username}</p>
                          <p className="text-xs text-on-surface-muted font-body mt-2">
                            Solicitado el {new Date(req.createdAt).toLocaleDateString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3 mt-2 border-t border-outline-ghost/30 pt-3">
                        <Button
                          onClick={() => handleResolveRequest(req.id, true)}
                          variant="success"
                          className="flex-1 py-1.5 text-sm gap-1.5"
                        >
                          <Check size={16} /> Conceder
                        </Button>
                        <Button
                          onClick={() => handleResolveRequest(req.id, false)}
                          variant="danger"
                          className="flex-1 py-1.5 text-sm gap-1.5"
                        >
                          <X size={16} /> Denegar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tabla de Gestión de Usuarios y Roles */}
          <div>
            <h3 className="text-xl font-display text-on-surface mb-6 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-theme-main"></span>
              Adeptos del Círculo
            </h3>

            <div className="overflow-x-auto border border-outline-ghost rounded bg-surface-low shadow-inner">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-ghost bg-background font-display text-sm text-on-surface-muted uppercase">
                    <th className="py-4 px-6">Miembro</th>
                    <th className="py-4 px-6 text-center">Editor</th>
                    <th className="py-4 px-6 text-center">Narrador</th>
                    <th className="py-4 px-6 text-center">Administrador</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-ghost/30 font-body">
                  {users.map((u) => {
                    const isRowUpdating = updatingUserId === u.id;
                    return (
                      <tr key={u.id} className={`hover:bg-background/40 transition-colors ${isRowUpdating ? 'opacity-50' : ''}`}>
                        {/* Miembro Info */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full overflow-hidden border border-outline-ghost bg-background flex-shrink-0">
                              <img src={getAvatarUrl(u.profilePicture)} alt="Avatar" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex flex-col">
                              <p className="text-on-surface font-medium leading-tight">{u.realName || u.username}</p>
                              <p className="text-xs text-on-surface-muted">@{u.username} • {u.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* Editor Checkbox */}
                        <td className="py-4 px-6 text-center">
                          <button
                            disabled={isEditor && !isAdmin && !isNarrador}
                            onClick={() => handleToggleRole(u, 'editor')}
                            className={`inline-flex items-center justify-center p-2 rounded border transition-all ${u.roles.includes('editor')
                                ? 'bg-theme-ritual-container border-theme-main text-theme-main shadow-md'
                                : 'border-outline-ghost text-on-surface-muted hover:border-theme-main/50'
                              } disabled:opacity-40 disabled:hover:border-outline-ghost disabled:cursor-not-allowed`}
                            title="Conceder/Revocar permiso de Editor"
                          >
                            <BookOpen size={18} />
                          </button>
                        </td>

                        {/* Narrador Checkbox */}
                        <td className="py-4 px-6 text-center">
                          <button
                            disabled={isEditor && !isAdmin && !isNarrador}
                            onClick={() => handleToggleRole(u, 'narrador')}
                            className={`inline-flex items-center justify-center p-2 rounded border transition-all ${u.roles.includes('narrador')
                                ? 'bg-theme-ritual-container border-theme-main text-theme-main shadow-md'
                                : 'border-outline-ghost text-on-surface-muted hover:border-theme-main/50'
                              } disabled:opacity-40 disabled:hover:border-outline-ghost disabled:cursor-not-allowed`}
                            title="Conceder/Revocar permiso de Narrador"
                          >
                            <Shield size={18} />
                          </button>
                        </td>

                        {/* Administrador Checkbox */}
                        <td className="py-4 px-6 text-center">
                          <button
                            disabled={!isAdmin} // Only admins can change administrator role
                            onClick={() => handleToggleRole(u, 'admin')}
                            className={`inline-flex items-center justify-center p-2 rounded border transition-all ${u.roles.includes('admin')
                                ? 'bg-red-950/40 border-red-500 text-red-400 shadow-md shadow-red-500/10'
                                : 'border-outline-ghost text-on-surface-muted hover:border-red-500/50'
                              } disabled:opacity-40 disabled:hover:border-outline-ghost disabled:cursor-not-allowed`}
                            title="Conceder/Revocar permiso de Administrador"
                          >
                            <UserIcon size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Gestion;
