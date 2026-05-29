'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    // 尝试用 refresh token 恢复登录态
    fetch('/api/auth/refresh', { method: 'POST' })
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        if (data.token) {
          // 拿到新 token 后获取用户信息
          const meRes = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${data.token}` },
          });
          if (meRes.ok) {
            const user = await meRes.json();
            setAuth(user, data.token);
          }
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [setAuth]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400 text-sm">加载中...</p>
      </div>
    );
  }

  return <>{children}</>;
}
