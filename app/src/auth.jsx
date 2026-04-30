// Auth context — wraps the app, exposes user/supplier + login/logout/register.

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth as authApi } from './api.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [supplier, setSupplier] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user: u, supplier: s } = await authApi.me();
      setUser(u); setSupplier(s ?? null);
    } catch {
      setUser(null); setSupplier(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = async (email, password) => {
    const res = await authApi.login(email, password);
    await refresh();
    return res;
  };
  const register = async (payload) => {
    const res = await authApi.register(payload);
    await refresh();
    return res;
  };
  const logout = async () => {
    try { await authApi.logout(); } catch {}
    setUser(null); setSupplier(null);
  };

  return (
    <AuthCtx.Provider value={{ user, supplier, loading, login, register, logout, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
