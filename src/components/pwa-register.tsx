'use client';

import { useEffect, useState } from 'react';

export function PwaRegister() {
  const [installable, setInstallable] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Silently fail — PWA is progressive enhancement
      });
    }

    // Listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstallable(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallable(false);
    }
    setDeferredPrompt(null);
  };

  if (!installable || dismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white rounded-xl shadow-lg border border-indigo-200 p-4 max-w-xs animate-in">
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0">📱</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">添加到主屏幕</p>
          <p className="text-xs text-gray-500 mt-0.5">安装 Study-DaZi 获得更好体验</p>
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
