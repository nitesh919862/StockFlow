import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';

export type UserRole = 'Admin' | 'Manager' | 'Staff';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  phone: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    name: string;
    email: string;
    password: string;
    department?: string;
    phone?: string;
  }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isAdmin: boolean;
  isManagerOrAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem('stockflow_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('stockflow_token'));
  const [loading, setLoading] = useState<boolean>(true);

  const persistSession = useCallback((nextToken: string, nextUser: AuthUser) => {
    localStorage.setItem('stockflow_token', nextToken);
    localStorage.setItem('stockflow_user', JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('stockflow_token');
    localStorage.removeItem('stockflow_user');
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const activeToken = localStorage.getItem('stockflow_token');
    if (!activeToken) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get('/auth/me');
      const profile = res.data.data as AuthUser;
      setUser(profile);
      localStorage.setItem('stockflow_user', JSON.stringify(profile));
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.post('/auth/login', { email, password });
      const { token: nextToken, user: nextUser } = res.data.data;
      persistSession(nextToken, nextUser);
    },
    [persistSession]
  );

  const register = useCallback(
    async (payload: {
      name: string;
      email: string;
      password: string;
      department?: string;
      phone?: string;
    }) => {
      const res = await api.post('/auth/register', payload);
      const { token: nextToken, user: nextUser } = res.data.data;
      persistSession(nextToken, nextUser);
    },
    [persistSession]
  );

  const value: AuthContextValue = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    refreshUser,
    isAdmin: user?.role === 'Admin',
    isManagerOrAdmin: user?.role === 'Admin' || user?.role === 'Manager',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
