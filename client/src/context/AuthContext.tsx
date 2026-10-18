import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import Cookies from 'js-cookie';
import {
  SESSION_EXPIRED_EVENT,
  clearStoredSession,
  getStoredToken,
  getStoredUser,
  isTokenExpired,
  saveSession,
  saveStoredUser,
} from '../utils/session';

interface User {
  id: string;
  username: string;
  realName: string;
  botcUsername: string;
  email: string;
  telegramUsername: string;
  profilePicture: string;
  roles: string[];
  /** Recibe por correo los avisos del vigilante de La Plaza. */
  vigilanteAlerts?: boolean;
  /** Los demás pueden ver sus estadísticas de la sala. */
  estadisticasPublicas?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  /** `remember`: mantener la sesión al cerrar el navegador («Recordarme»). */
  login: (userData: User, token: string, remember: boolean) => void;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
  isAuthenticated: boolean;
  /** La sesión caducó mientras se usaba la web: hay que avisar. */
  sessionExpired: boolean;
  dismissSessionExpired: () => void;
}

interface Session {
  user: User;
  token: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';

/** Cada cuánto se mira si el token ha caducado con la página abierta. */
const EXPIRY_CHECK_MS = 60_000;

/**
 * Sesión guardada, solo si su token sigue vigente. Un token caducado no cuenta
 * como sesión: si no, la web te mostraría dentro hasta que el servidor te echase.
 */
function readStoredSession(): Session | null {
  const token = getStoredToken();
  const savedUser = getStoredUser();
  if (!token || !savedUser || isTokenExpired(token)) {
    clearStoredSession();
    return null;
  }
  try {
    return { token, user: JSON.parse(savedUser) };
  } catch {
    clearStoredSession();
    return null;
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(readStoredSession);
  const [sessionExpired, setSessionExpired] = useState(false);
  const token = session?.token ?? null;
  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  // Restos de cuando la sesión iba en cookies.
  useEffect(() => {
    Cookies.remove('token');
    Cookies.remove('user');
  }, []);

  const expire = useCallback((notify: boolean) => {
    if (!tokenRef.current) return;
    clearStoredSession();
    setSession(null);
    if (notify) setSessionExpired(true);
  }, []);

  // Al cargar, el servidor confirma que el token vale (la firma pudo cambiar o la
  // cuenta borrarse) y de paso devuelve el perfil al día (roles incluidos).
  const initialToken = useRef(token);
  useEffect(() => {
    const startToken = initialToken.current;
    if (!startToken) return;
    const controller = new AbortController();
    fetch(`${API_URL}/auth/profile`, {
      headers: { Authorization: `Bearer ${startToken}` },
      signal: controller.signal,
    })
      .then(async (res) => {
        if (tokenRef.current !== startToken) return;
        if (res.status === 401 || res.status === 404) {
          expire(false);
          return;
        }
        if (!res.ok) return;
        const profile = await res.json();
        setSession((prev) => {
          if (!prev || prev.token !== startToken) return prev;
          const user = { ...prev.user, ...profile };
          saveStoredUser(JSON.stringify(user));
          return { ...prev, user };
        });
      })
      .catch(() => {
        // Sin conexión no se puede saber: se mantiene la sesión.
      });
    return () => controller.abort();
  }, [expire]);

  // Si una petición vuelve rechazada por sesión, se cierra aquí también.
  useEffect(() => {
    const onExpired = () => expire(true);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [expire]);

  // Con la página abierta, el token puede caducar: se mira cada minuto y al
  // volver a la pestaña (los temporizadores se duermen con el equipo).
  useEffect(() => {
    if (!token) return;
    const check = () => {
      if (isTokenExpired(token)) expire(true);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    const interval = window.setInterval(check, EXPIRY_CHECK_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [token, expire]);

  const login = (userData: User, newToken: string, remember: boolean) => {
    saveSession(newToken, JSON.stringify(userData), remember);
    setSession({ user: userData, token: newToken });
    setSessionExpired(false);
  };

  const logout = () => {
    clearStoredSession();
    setSession(null);
  };

  const updateUser = (updateData: Partial<User>) => {
    if (!session) return;
    const user = { ...session.user, ...updateData };
    setSession({ ...session, user });
    saveStoredUser(JSON.stringify(user));
  };

  const dismissSessionExpired = useCallback(() => setSessionExpired(false), []);

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        token,
        login,
        logout,
        updateUser,
        isAuthenticated: !!session,
        sessionExpired,
        dismissSessionExpired,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
