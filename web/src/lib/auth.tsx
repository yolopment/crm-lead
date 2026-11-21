'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getApiBase } from './api';

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  isOnLeave: boolean;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  phone?: string | null;
  website?: string | null;
  orgStatus?: 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'DELETED';
  planTier?: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  trialEndsAt?: string | null;
  maxUsers?: number;
  maxLeads?: number;
  storageQuotaBytes?: number | string | bigint;
  storageUsedBytes?: number | string | bigint;
  orgStorageDriver?: string;
  gdriveEmail?: string | null;
}

interface AuthContextType {
  user: User | null;
  org: Organization | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    const storedToken = localStorage.getItem('crm_token');
    if (!storedToken) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch(`${getApiBase()}/auth/me`, {
        headers: { Authorization: `Bearer ${storedToken}` },
      });
      if (!res.ok) {
        localStorage.removeItem('crm_token');
        setToken(null);
        setUser(null);
        setOrg(null);
        return;
      }
      const data = await res.json();
      setUser({
        id: data.id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        role: data.role,
        isOnLeave: data.isOnLeave,
      });
      setOrg(data.organization);
      setToken(storedToken);
    } catch {
      localStorage.removeItem('crm_token');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${getApiBase()}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Login failed');
    }
    const data = await res.json();
    localStorage.setItem('crm_token', data.token);
    setToken(data.token);
    setUser(data.user);
    setOrg(data.organization);
    router.push('/dashboard/calls');
  };

  const logout = () => {
    localStorage.removeItem('crm_token');
    setToken(null);
    setUser(null);
    setOrg(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, org, token, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

