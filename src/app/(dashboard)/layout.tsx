'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [notifCount, setNotifCount] = useState(0);
  const [msgCount, setMsgCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const token = useAuthStore.getState().token;
    fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok && r.json())
      .then((d) => setNotifCount(d?.unreadCount || 0))
      .catch(() => {});
    fetch('/api/messages', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok && r.json())
      .then((d) => setMsgCount(d?.unreadCount || 0))
      .catch(() => {});
  }, [user]);

  if (!user) return <>{children}</>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-gray-900 hover:text-indigo-600">
            Study-DaZi
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/paths/new" className="text-indigo-600 hover:text-indigo-500">生成路径</Link>
            <Link href="/explore" className="text-gray-500 hover:text-indigo-600">广场</Link>
            <Link href="/friends" className="text-gray-500 hover:text-indigo-600 relative">
              好友
              {notifCount > 0 && (
                <span className="absolute -top-2 -right-4 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {notifCount}
                </span>
              )}
            </Link>
            <Link href="/messages" className="text-gray-500 hover:text-indigo-600 relative">
              💬
              {msgCount > 0 && (
                <span className="absolute -top-2 -right-3 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {msgCount}
                </span>
              )}
            </Link>
            <Link href="/notifications" className="text-gray-500 hover:text-indigo-600 relative">
              🔔
              {notifCount > 0 && (
                <span className="absolute -top-2 -right-3 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {notifCount}
                </span>
              )}
            </Link>
            <Link href="/profile" className="text-gray-500 hover:text-indigo-600">{user.username}</Link>
            <Link href="/settings" className="text-gray-500 hover:text-gray-700">设置</Link>
            <button onClick={logout} className="text-gray-400 hover:text-gray-600">退出</button>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
