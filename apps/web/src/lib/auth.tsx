'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { API_BASE } from './api';

interface Me {
  id: string;
  phone: string | null;
  email: string | null;
  name: string | null;
  role: string;
  locale: string;
}

interface AuthState {
  status: 'loading' | 'authed' | 'anon';
  user: Me | null;
  requestEmailOtp: (email: string) => Promise<{ devCode?: string }>;
  verifyEmailOtp: (email: string, code: string) => Promise<void>;
  googleSignIn: (idToken: string) => Promise<void>;
  appleSignIn: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  reloadMe: () => Promise<void>;
  authFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
  authFetchBlob: (path: string, init?: RequestInit) => Promise<Blob>;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [user, setUser] = useState<Me | null>(null);
  const accessToken = useRef<string | null>(null);

  const refresh = useCallback(async (): Promise<boolean> => {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return false;
    const { accessToken: at } = (await res.json()) as { accessToken: string };
    accessToken.current = at;
    return true;
  }, []);

  const authResponse = useCallback(
    async (path: string, init: RequestInit = {}): Promise<Response> => {
      const call = () =>
        fetch(`${API_BASE}${path}`, {
          ...init,
          credentials: 'include',
          headers: {
            ...(init.headers ?? {}),
            ...(accessToken.current
              ? { authorization: `Bearer ${accessToken.current}` }
              : {}),
            ...(init.body ? { 'content-type': 'application/json' } : {}),
          },
        });
      let res = await call();
      if (res.status === 401 && (await refresh())) res = await call();
      if (!res.ok) {
        const problem = (await res.json().catch(() => ({}))) as {
          message?: string | string[];
        };
        throw new Error(
          `${res.status}: ${Array.isArray(problem.message) ? problem.message.join('. ') : problem.message || 'Request failed.'}`,
        );
      }
      return res;
    },
    [refresh],
  );

  const authFetch = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> =>
      (await authResponse(path, init)).json() as Promise<T>,
    [authResponse],
  );
  const authFetchBlob = useCallback(
    async (path: string, init?: RequestInit): Promise<Blob> =>
      (await authResponse(path, init)).blob(),
    [authResponse],
  );

  const loadMe = useCallback(async () => {
    try {
      const me = await authFetch<Me>('/users/me');
      setUser(me);
      setStatus('authed');
    } catch {
      setUser(null);
      setStatus('anon');
    }
  }, [authFetch]);

  useEffect(() => {
    (async () => {
      try {
        if (await refresh()) await loadMe();
        else setStatus('anon');
      } catch {
        setStatus('anon');
      }
    })();
  }, [refresh, loadMe]);

  const requestEmailOtp = useCallback(async (email: string) => {
    const res = await fetch(`${API_BASE}/auth/email/request`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const e = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(e.message ?? 'Could not send code.');
    }
    return res.json() as Promise<{ devCode?: string }>;
  }, []);

  const verifyEmailOtp = useCallback(
    async (email: string, code: string) => {
      const res = await fetch(`${API_BASE}/auth/email/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, code }),
      });
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(e.message ?? 'Invalid code.');
      }
      const { accessToken: at } = (await res.json()) as { accessToken: string };
      accessToken.current = at;
      await loadMe();
    },
    [loadMe],
  );

  const oauthSignIn = useCallback(
    async (provider: 'google' | 'apple', idToken: string) => {
      const res = await fetch(`${API_BASE}/auth/${provider}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(e.message ?? 'Sign-in failed.');
      }
      const { accessToken: at } = (await res.json()) as { accessToken: string };
      accessToken.current = at;
      await loadMe();
    },
    [loadMe],
  );

  const googleSignIn = useCallback(
    (t: string) => oauthSignIn('google', t),
    [oauthSignIn],
  );
  const appleSignIn = useCallback(
    (t: string) => oauthSignIn('apple', t),
    [oauthSignIn],
  );

  const logout = useCallback(async () => {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    accessToken.current = null;
    setUser(null);
    setStatus('anon');
  }, []);

  return (
    <AuthCtx.Provider
      value={{
        status,
        user,
        requestEmailOtp,
        verifyEmailOtp,
        googleSignIn,
        appleSignIn,
        logout,
        reloadMe: loadMe,
        authFetch,
        authFetchBlob,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
