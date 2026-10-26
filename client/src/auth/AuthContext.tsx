/**
 * Auth state for the app. On mount it restores the stored token and fetches
 * `/api/me`; any 401 from an authenticated call clears the token and drops to
 * logged-out. Register sends the device timezone, and a restored session
 * PATCHes `/api/me` if the device timezone has since changed.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  ApiError,
  deviceTimeZone,
  getMe,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  setAuthToken,
  setUnauthorizedHandler,
  updateMe,
} from '@/api/client';
import type { User } from '@/api/types';

import { tokenStorage } from './tokenStorage';

export type AuthContextValue = {
  /** The signed-in user; null when logged out (or not yet fetched while offline). */
  user: User | null;
  /** True when a token is held, even if `/api/me` couldn't be reached yet. */
  isAuthenticated: boolean;
  /** True while the stored session is being restored on launch. */
  loading: boolean;
  /** Last error from restoring the session (e.g. network), cleared on success. */
  error: ApiError | null;
  login: (username: string, password: string) => Promise<User>;
  register: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  /** Re-fetch `/api/me` (e.g. after a retry or settings change). */
  refreshUser: () => Promise<User | null>;
  /** Replace the cached user, e.g. with the result of PATCH /api/me. */
  setUser: (user: User) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function toApiError(err: unknown): ApiError {
  return err instanceof ApiError ? err : new ApiError(0, err instanceof Error ? err.message : 'Something went wrong');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const mounted = useRef(true);

  const clearSession = useCallback(() => {
    setAuthToken(null);
    void tokenStorage.clearToken();
    if (!mounted.current) return;
    setToken(null);
    setUser(null);
  }, []);

  const startSession = useCallback(async (newToken: string, newUser: User) => {
    setAuthToken(newToken);
    await tokenStorage.setToken(newToken);
    setToken(newToken);
    setUser(newUser);
    setError(null);
  }, []);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    try {
      let { user: me } = await getMe();
      const tz = deviceTimeZone();
      if (tz && tz !== me.timezone) {
        try {
          ({ user: me } = await updateMe({ timezone: tz }));
        } catch {
          // Non-fatal: the server keeps the old timezone until next launch.
        }
      }
      if (mounted.current) {
        setUser(me);
        setError(null);
      }
      return me;
    } catch (err) {
      // A 401 already went through the unauthorized handler.
      if (mounted.current) setError(toApiError(err));
      return null;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    setUnauthorizedHandler(clearSession);
    (async () => {
      const stored = await tokenStorage.getToken();
      if (stored) {
        setAuthToken(stored);
        if (mounted.current) setToken(stored);
        await refreshUser();
      }
      if (mounted.current) setLoading(false);
    })();
    return () => {
      mounted.current = false;
      setUnauthorizedHandler(null);
    };
  }, [clearSession, refreshUser]);

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await apiLogin({ username, password });
      await startSession(res.token, res.user);
      return res.user;
    },
    [startSession],
  );

  const register = useCallback(
    async (username: string, password: string) => {
      const res = await apiRegister({ username, password, timezone: deviceTimeZone() });
      await startSession(res.token, res.user);
      return res.user;
    },
    [startSession],
  );

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Revocation is best-effort; locally we're logged out either way.
    }
    clearSession();
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: token !== null,
      loading,
      error,
      login,
      register,
      logout,
      refreshUser,
      setUser,
    }),
    [user, token, loading, error, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
