'use client';

import { create } from 'zustand';

interface User {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  avatarUrl?: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  authReady: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<{ success: boolean; message: string; code?: string }>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: false,
  authReady: false,

  setAuth: (user, token) => set({ user, token, authReady: true }),

  clearAuth: () => set({ user: null, token: null, authReady: true }),

  login: async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '登录失败');
    set({ user: data.user, token: data.token });
  },

  register: async (username, email, password): Promise<{ success: boolean; message: string; code?: string }> => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '注册失败');
    return data;
  },

  verifyEmail: async (email, code) => {
    const res = await fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '验证失败');
    set({ user: data.user, token: data.token });
  },

  refresh: async () => {
    const res = await fetch('/api/auth/refresh', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '刷新失败');
    set({ token: data.token });
  },

  logout: async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    set({ user: null, token: null });
  },
}));
