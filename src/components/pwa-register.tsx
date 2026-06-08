'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth';

function urlB64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function PwaRegister() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const [installable, setInstallable] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !window.matchMedia('(display-mode: standalone)').matches;
  });
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const subscribeToPush = useCallback(async (authToken: string) => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();

      if (!sub) {
        const vapidPublic = process.env.NEXT_PUBLIC_VAPID_KEY;
        if (!vapidPublic) return; // VAPID 未配置

        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(vapidPublic),
        });
      }

      // 发送到后端
      await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(sub),
      });
    } catch {
      // 推送订阅失败不阻塞用户
    }
  }, []);

  // 注册 SW + 监听安装提示
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // 用户登录后自动订阅推送
  useEffect(() => {
    if (!token || !user) return;
    subscribeToPush(token);
  }, [subscribeToPush, token, user]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setInstallable(false);
    setDeferredPrompt(null);
  };

  if (!installable || dismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white rounded-xl shadow-lg border border-indigo-200 p-4 max-w-xs">
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0">📱</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">添加到主屏幕</p>
          <p className="text-xs text-gray-500 mt-0.5">安装后支持离线访问和推送通知</p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleInstall}
              className="px-3 py-1 rounded-md bg-indigo-600 text-white text-xs hover:bg-indigo-500"
            >
              安装
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="px-3 py-1 rounded-md bg-gray-100 text-gray-600 text-xs hover:bg-gray-200"
            >
              暂不
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
