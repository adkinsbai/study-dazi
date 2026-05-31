'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth';
import { MessageCircle, Bell, Settings, LogOut, Sparkles } from 'lucide-react';

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
    <div className="min-h-screen bg-[#fef7f5]">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold text-gray-900 hover:text-gray-700 transition-colors">
            <span className="w-7 h-7 rounded-lg bg-[#f97066] flex items-center justify-center text-white text-xs font-bold">D</span>
            Study-DaZi
          </Link>
          <nav className="flex items-center gap-1 text-sm" role="navigation" aria-label="主导航">
            <Link href="/paths/new" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#f97066] text-white text-sm font-medium hover:bg-[#e0524a] transition-colors">
              <Sparkles size={13} /> 生成路径
            </Link>
            <Link href="/explore" className="px-3 py-1.5 rounded-full text-gray-600 hover:bg-gray-100 hover:text-gray-700 transition-colors">广场</Link>
            <Link href="/friends" className="px-3 py-1.5 rounded-full text-gray-600 hover:bg-gray-100 hover:text-gray-700 transition-colors relative" aria-label={`好友${notifCount > 0 ? `，${notifCount}条新请求` : ''}`}>
              好友
              {notifCount > 0 && <span className="absolute -top-1 -right-1 bg-[#ef4444] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center" aria-hidden="true">{notifCount}</span>}
            </Link>
            <Link href="/messages" className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors relative" aria-label={`消息${msgCount > 0 ? `，${msgCount}条未读` : ''}`}>
              <MessageCircle size={17} />
              {msgCount > 0 && <span className="absolute -top-1 -right-1 bg-[#ef4444] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center" aria-hidden="true">{msgCount}</span>}
            </Link>
            <Link href="/notifications" className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors relative" aria-label={`通知${notifCount > 0 ? `，${notifCount}条未读` : ''}`}>
              <Bell size={17} />
              {notifCount > 0 && <span className="absolute -top-1 -right-1 bg-[#ef4444] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center" aria-hidden="true">{notifCount}</span>}
            </Link>
            <div className="w-px h-5 bg-gray-200 mx-1"></div>
            <Link href="/profile" className="px-2 py-1 rounded-full text-gray-600 hover:bg-gray-100 hover:text-gray-700 transition-colors">{user.username}</Link>
            <Link href="/settings" className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors" title="设置"><Settings size={15} /></Link>
            <button onClick={logout} className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors" title="退出"><LogOut size={15} /></button>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
