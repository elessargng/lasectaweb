import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import Cookies from 'js-cookie';

interface User {
  id: string;
  username: string;
  realName: string;
  botcUsername: string;
  email: string;
  telegramUsername: string;
  profilePicture: string;
  roles: string[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (userData: User, token: string) => void;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    let savedToken = localStorage.getItem('token');
    let savedUser = localStorage.getItem('user');

    // Migration logic from legacy cookies if present
    if (!savedToken || !savedUser) {
      const cookieToken = Cookies.get('token');
      const cookieUser = Cookies.get('user');
      if (cookieToken && cookieUser) {
        savedToken = cookieToken;
        savedUser = cookieUser;
        try {
          localStorage.setItem('token', cookieToken);
          localStorage.setItem('user', cookieUser);
        } catch (e) {
          console.error('Error migrating cookies to localStorage', e);
        }
      }
      // Clean up legacy cookies
      Cookies.remove('token');
      Cookies.remove('user');
    }

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        Cookies.remove('token');
        Cookies.remove('user');
      }
    }
    setIsInitialized(true);
  }, []);

  const login = (userData: User, newToken: string) => {
    setUser(userData);
    setToken(newToken);
    try {
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (e) {
      console.error('Error saving to localStorage', e);
    }
    // Clean up legacy cookies
    Cookies.remove('token');
    Cookies.remove('user');
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    Cookies.remove('token');
    Cookies.remove('user');
  };

  const updateUser = (updateData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...updateData };
      setUser(updatedUser);
      try {
        localStorage.setItem('user', JSON.stringify(updatedUser));
      } catch (e) {
        console.error('Error updating localStorage user', e);
      }
    }
  };

  if (!isInitialized) return null; // or a loading spinner

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, isAuthenticated: !!user }}>
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
