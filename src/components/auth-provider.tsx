'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  useEffect(() => {
    // 后台静默恢复登录态，不阻塞页面渲染
    fetch('/api/auth/refresh', { method: 'POST' })
      .then(async (res) => {
        if (!res.ok) {
          clearAuth();
          return;
        }
        const data = await res.json();
        if (data.token) {
          const meRes = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${data.token}` },
          });
          if (meRes.ok) {
            const user = await meRes.json();
            setAuth(user, data.token);
          } else {
            clearAuth();
          }
        } else {
          clearAuth();
        }
      })
      .catch(() => {
        clearAuth();
      });
  }, [setAuth, clearAuth]);

  // 不阻塞渲染 — 各页面自行处理 user 为 null 的情况
  return <>{children}</>;
}
