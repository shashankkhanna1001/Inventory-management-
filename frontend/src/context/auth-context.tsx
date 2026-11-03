import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AuthUser, LoginResponse } from '@/types/api.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  updateUser: (updated: Partial<AuthUser>) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function parseJwtExp(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2 || !parts[1]) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    const parsed = JSON.parse(jsonPayload) as { exp?: number };
    return parsed.exp ? parsed.exp * 1000 : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearAuth = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  }, []);

  // 1-Hour Session Timer & Expiry Check
  useEffect(() => {
    if (!token) return;

    const checkExpiry = () => {
      const expMs = parseJwtExp(token);
      if (!expMs) return;

      const timeLeft = expMs - Date.now();
      if (timeLeft <= 0) {
        clearAuth();
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login?expired=true';
        }
      }
    };

    // Immediate check
    checkExpiry();

    const expMs = parseJwtExp(token);
    if (!expMs) return;
    const msUntilExpiry = Math.max(0, expMs - Date.now());

    // Schedule exact timeout to expire session
    const timer = setTimeout(() => {
      clearAuth();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login?expired=true';
      }
    }, msUntilExpiry);

    // Also check on tab focus / wake from sleep
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkExpiry();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', checkExpiry);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', checkExpiry);
    };
  }, [token, clearAuth]);

  // Restore from localStorage on mount and validate with /api/auth/me
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('auth_user');

    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser) as AuthUser;
        setToken(storedToken);
        setUser(parsedUser);

        // Validate token with /api/auth/me
        fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${storedToken}` },
        })
          .then((r) => r.json())
          .then((data: { success: boolean; data?: AuthUser }) => {
            if (data.success && data.data) {
              setUser(data.data);
              localStorage.setItem('auth_user', JSON.stringify(data.data));
            } else {
              clearAuth();
            }
          })
          .catch(() => {
            // Keep stored user on temporary network disconnect
          })
          .finally(() => {
            setIsLoading(false);
          });
      } catch {
        clearAuth();
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, [clearAuth]);

  const login = useCallback(
    async (email: string, password: string): Promise<AuthUser> => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      interface LoginApiResponse {
        success?: boolean;
        data?: LoginResponse;
        error?: { message: string };
      }
      let json: LoginApiResponse | null = null;

      try {
        json = (await response.json()) as LoginApiResponse;
      } catch {
        throw new Error('Unable to connect to server. Please check your network connection.');
      }

      if (!response.ok || !json?.success || !json.data) {
        throw new Error(json?.error?.message ?? 'Invalid credentials or server error.');
      }

      const { token: newToken, user: newUser } = json.data;
      setToken(newToken);
      setUser(newUser);
      localStorage.setItem('auth_token', newToken);
      localStorage.setItem('auth_user', JSON.stringify(newUser));

      return newUser;
    },
    [],
  );

  const logout = useCallback(() => {
    clearAuth();
    window.location.href = '/login';
  }, [clearAuth]);

  const updateUser = useCallback((updated: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return null;
      const next = { ...prev, ...updated };
      localStorage.setItem('auth_user', JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
