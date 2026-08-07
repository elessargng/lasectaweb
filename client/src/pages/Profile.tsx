import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import PageHeader from '../components/PageHeader';
import { Check, Plus, Shield } from 'lucide-react';
import { compressImage } from '../utils/image';
import { parseApiResponse, getAvatarUrl } from '../utils/api';

const AVATAR_OPTIONS = [
  { id: 'default', url: '/avatar.png', label: 'Adepto' },
  { id: 'wizard', url: '/avatars/wizard.png', label: 'Hechicero' },
  { id: 'sorceress', url: '/avatars/sorceress.png', label: 'Hechicera' },
  { id: 'rogue', url: '/avatars/rogue.png', label: 'Asesino' },
  { id: 'noble', url: '/avatars/noble.png', label: 'Noble' }
];

const Profile = () => {
  const { user, token, isAuthenticated, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);

  const hasAccessToGestion = !!(user && user.roles && (
    user.roles.includes('admin') || 
    user.roles.includes('narrador') || 
    user.roles.includes('editor')
  ));

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const [formData, setFormData] = useState({
    realName: '',
    botcUsername: '',
    email: '',
    telegramUsername: '',
    profilePicture: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    } else if (user) {
      setFormData({
        realName: user.realName || '',
        botcUsername: user.botcUsername || '',
        email: user.email || '',
        telegramUsername: user.telegramUsername || '',
        profilePicture: user.profilePicture || ''
      });

      // Si la foto actual no es una de las por defecto, es personalizada
      const isDefault = AVATAR_OPTIONS.some((opt) => opt.url === user.profilePicture);
      if (user.profilePicture && !isDefault) {
        setCustomAvatar(user.profilePicture);
      } else {
        setCustomAvatar(null);
      }

      if (token) {
        fetchMyRequests();
      }
    }
  }, [isAuthenticated, user, token, navigate]);

  const [requests, setRequests] = useState<any[]>([]);

  const fetchMyRequests = async () => {
    if (!token) return;
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';
      const response = await fetch(`${apiUrl}/auth/role-requests/my`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await parseApiResponse(response);
      setRequests(data);
    } catch (err) {
      console.error('Error fetching role requests', err);
    }
  };

  if (!user) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const selectAvatar = (url: string) => {
    setFormData((prev) => ({ ...prev, profilePicture: url }));
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

  const handleRequestRole = async (requestedRole: 'editor' | 'narrador') => {
    setError('');
    setSuccess('');
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';
      const response = await fetch(`${apiUrl}/auth/role-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ requestedRole })
      });
      await parseApiResponse(response);
      setSuccess(`Solicitud enviada con éxito para convertirte en ${requestedRole === 'editor' ? 'Editor' : 'Narrador'}.`);
      fetchMyRequests();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const visibleAvatars = [
    ...AVATAR_OPTIONS,
    ...(customAvatar ? [{ id: 'custom', url: customAvatar, label: 'Personalizado' }] : [])
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';
      const response = await fetch(`${apiUrl}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await parseApiResponse(response);

      updateUser(data);
      setSuccess('Perfil actualizado correctamente');
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col w-full">
      <PageHeader
        title={`El Grimorio de ${user.username}`}
        imageSrc="/moon_banner_wide.jpg"
        imageAlt="Bosque Oscuro y Luna"
      />

      <div className="max-w-5xl w-full mx-auto px-0 md:px-8 py-4 md:py-10 relative z-20 -mt-20">
        <div className="bg-transparent md:bg-surface border-0 md:border border-transparent md:border-outline-ghost rounded-none md:rounded shadow-none md:shadow-2xl px-4 py-6 md:p-10 relative">

          <div className="flex md:absolute md:top-10 md:right-10 gap-3 mb-8 md:mb-0 justify-end w-full md:w-auto flex-wrap md:flex-nowrap z-20">
            {hasAccessToGestion && !isEditing && (
              <Button onClick={() => navigate('/gestion')} variant="primary" className="px-4 py-2 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Gestión
              </Button>
            )}
            {!isEditing && (
              <Button onClick={handleLogout} variant="danger" className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium shadow-sm transition-colors border-none">
                Cerrar Sesión
              </Button>
            )}
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)} variant="secondary" className="px-4 py-2">
                Editar Perfil
              </Button>
            ) : (
              <Button onClick={() => setIsEditing(false)} variant="danger" className="px-4 py-2">
                Cancelar
              </Button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-6 md:gap-8 mb-8">
            <div className="w-32 h-32 rounded-full overflow-hidden border border-outline-ghost shadow-md flex-shrink-0 bg-background ring-2 ring-theme-main/50">
              <img
                src={getAvatarUrl(isEditing ? formData.profilePicture : user.profilePicture)}
                alt="Avatar"
                className="w-full h-full object-cover grayscale-[0.2] transition-all duration-700"
              />
            </div>
            <div className="flex flex-col justify-center items-center sm:items-start gap-2">
              <p className="text-on-surface-muted font-display text-sm">Rol Primario</p>
              <p className="text-3xl font-display font-medium text-on-surface">{user.realName || user.username}</p>
              <span className="bg-surface-highest text-on-surface px-3 py-1 rounded-sm text-sm font-display w-max border border-outline-ghost">
                {user.roles && user.roles.length > 0
                  ? user.roles.map(r => r === 'admin' ? 'Administrador' : r.charAt(0).toUpperCase() + r.slice(1)).join(' / ')
                  : 'Adepto de La Secta'}
              </span>
            </div>
          </div>

          {error && <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded mb-6 text-sm font-body">{error}</div>}
          {success && <div className="bg-green-500/10 border border-green-500/50 text-green-500 p-3 rounded mb-6 text-sm font-body">{success}</div>}

          {!isEditing ? (
            <>
              <div className="bg-surface-low p-6 border border-outline-ghost shadow-inner rounded mb-8">
                <h3 className="text-xl font-display text-on-surface mb-6 border-b border-outline-ghost/50 pb-2">Información Personal</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-on-surface-muted font-display mb-1">Nombre Real</p>
                    <p className="text-on-surface font-body">{user.realName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-on-surface-muted font-display mb-1">Usuario en BotC.app</p>
                    <p className="text-on-surface font-body">{user.botcUsername || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-on-surface-muted font-display mb-1">Correo Electrónico</p>
                    <p className="text-on-surface font-body">{user.email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-on-surface-muted font-display mb-1">Usuario de Telegram</p>
                    <p className="text-on-surface font-body">{user.telegramUsername || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Solicitudes de Rango */}
              {!(user.roles || []).includes('admin') && (
                <div className="bg-surface-low p-6 border border-outline-ghost shadow-inner rounded mb-8">
                  <h3 className="text-xl font-display text-on-surface mb-6 border-b border-outline-ghost/50 pb-2">Solicitudes de Rango</h3>
                  <div className="flex flex-col gap-4">
                    {/* Solicitud de Editor */}
                    <div className="flex justify-between items-center bg-surface p-4 border border-outline-ghost/50 rounded gap-4">
                      <div>
                        <h4 className="font-display text-on-surface text-base">Conocimiento de Editor</h4>
                        <p className="text-sm font-body text-on-surface-muted mt-1">
                          {(user.roles || []).includes('editor')
                            ? 'Ya posees el rango de Editor.'
                            : 'Permite redactar, corregir y archivar los Códices de La Secta.'}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {(user.roles || []).includes('editor') ? (
                          <span className="text-sm font-display text-green-400 font-bold uppercase">Asignado</span>
                        ) : requests.some(r => r.requestedRole === 'editor' && r.status === 'pending') ? (
                          <span className="text-sm font-display text-theme-main italic">Pendiente de Aprobación</span>
                        ) : (
                          <Button onClick={() => handleRequestRole('editor')} variant="secondary" className="px-4 py-1.5 text-sm">
                            Solicitar Rango
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Solicitud de Narrador */}
                    <div className="flex justify-between items-center bg-surface p-4 border border-outline-ghost/50 rounded gap-4">
                      <div>
                        <h4 className="font-display text-on-surface text-base">Rango de Narrador</h4>
                        <p className="text-sm font-body text-on-surface-muted mt-1">
                          {(user.roles || []).includes('narrador')
                            ? 'Ya posees el rango de Narrador.'
                            : 'Permite convocar rituales, guiar los rituales e influir en el destino de los adeptos.'}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {(user.roles || []).includes('narrador') ? (
                          <span className="text-sm font-display text-green-400 font-bold uppercase">Asignado</span>
                        ) : requests.some(r => r.requestedRole === 'narrador' && r.status === 'pending') ? (
                          <span className="text-sm font-display text-theme-main italic">Pendiente de Aprobación</span>
                        ) : (
                          <Button onClick={() => handleRequestRole('narrador')} variant="secondary" className="px-4 py-1.5 text-sm">
                            Solicitar Rango
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <form onSubmit={handleSubmit} className="bg-surface-low p-6 border border-theme-main/30 shadow-inner rounded mb-8">
              <h3 className="text-xl font-display text-on-surface mb-6 border-b border-outline-ghost/50 pb-2">Editar Información</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-display text-on-surface-muted">Nombre Real</label>
                  <input name="realName" value={formData.realName} onChange={handleChange} className="bg-surface border border-outline-ghost rounded px-3 py-2 text-on-surface focus:outline-none focus:border-theme-main transition-colors" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-display text-on-surface-muted">Usuario en BotC.app</label>
                  <input name="botcUsername" value={formData.botcUsername} onChange={handleChange} className="bg-surface border border-outline-ghost rounded px-3 py-2 text-on-surface focus:outline-none focus:border-theme-main transition-colors" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-display text-on-surface-muted">Correo Electrónico</label>
                  <input required type="email" name="email" value={formData.email} onChange={handleChange} className="bg-surface border border-outline-ghost rounded px-3 py-2 text-on-surface focus:outline-none focus:border-theme-main transition-colors" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-display text-on-surface-muted">Usuario de Telegram</label>
                  <input name="telegramUsername" value={formData.telegramUsername} onChange={handleChange} className="bg-surface border border-outline-ghost rounded px-3 py-2 text-on-surface focus:outline-none focus:border-theme-main transition-colors" />
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-4 mb-6">
                <label className="text-sm font-display text-on-surface-muted">Selecciona tu Avatar</label>
                <div className="flex gap-3 overflow-x-auto pb-2 pt-1">
                  {visibleAvatars.map((avatar) => (
                    <Button
                      key={avatar.id}
                      type="button"
                      onClick={() => selectAvatar(avatar.url)}
                      variant="text"
                      className={`relative w-16 h-16 rounded overflow-hidden flex-shrink-0 transition-all ${formData.profilePicture === avatar.url ? 'ring-2 ring-theme-main ring-offset-2 ring-offset-surface' : 'opacity-70 hover:opacity-100 ring-1 ring-outline-ghost'}`}
                    >
                      <img src={getAvatarUrl(avatar.url)} alt={avatar.label} className="w-full h-full object-cover" />
                      {formData.profilePicture === avatar.url && (
                        <div className="absolute inset-0 bg-theme-main/20 flex justify-center items-center backdrop-blur-[1px]">
                          <Check className="text-white drop-shadow-md" size={24} />
                        </div>
                      )}
                    </Button>
                  ))}

                  {/* Custom upload option */}
                  <label className="relative w-16 h-16 rounded overflow-hidden flex-shrink-0 transition-all flex flex-col justify-center items-center border border-dashed border-outline-ghost hover:border-theme-main cursor-pointer opacity-70 hover:opacity-100 bg-surface-low">
                    <Plus size={20} className="text-on-surface-muted" />
                    <span className="text-[9px] font-display uppercase mt-1">Subir</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>
                </div>
              </div>

              <Button type="submit" variant="primary" className="py-2 px-6">
                Guardar Cambios
              </Button>
            </form>
          )}

          {hasAccessToGestion && (
            <div className="bg-surface-low p-6 border border-theme-main/30 shadow-inner rounded flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-xl font-display text-on-surface mb-1 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-theme-main" />
                  Panel de Gestión
                </h3>
                <p className="text-sm font-body text-on-surface-muted">
                  Accede al panel de administración para gestionar rituales, códices y roles de adeptos.
                </p>
              </div>
              <Button onClick={() => navigate('/gestion')} variant="primary" className="px-6 py-2 shrink-0">
                Ir a Gestión
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
