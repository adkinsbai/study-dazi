'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth';
import { MessageCircle, Bell, Settings, LogOut, Sparkles, GraduationCap } from 'lucide-react';

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
    <div className="min-h-screen bg-[#fef7f5] bg-stripe">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="relative inline-flex group/tip">
            <Link href="/" className="flex items-center gap-2 group/logo">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#f97066] to-[#e0524a] flex items-center justify-center text-white shadow-md shadow-[#f97066]/30">
                <GraduationCap size={18} />
              </span>
              <span className="text-xl font-black tracking-tight bg-gradient-to-r from-[#f97066] to-[#e0524a] bg-clip-text text-transparent drop-shadow-[0_2px_4px_rgba(249,112,102,0.3)]" style={{ fontFamily: "'Noto Serif SC', serif" }}>DaZi</span>
            </Link>
            <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1.5 px-2.5 py-1 rounded-lg bg-gray-800 text-white text-[11px] whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity shadow-lg z-50">返回首页</span>
          </div>
          <nav className="flex items-center gap-1 text-sm" role="navigation" aria-label="主导航">
            <div className="relative inline-flex group/tip">
              <Link href="/paths/new" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#f97066] text-white text-sm font-medium hover:bg-[#e0524a] transition-colors">
                <Sparkles size={13} /> 生成路径
              </Link>
              <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1.5 px-2.5 py-1 rounded-lg bg-gray-800 text-white text-[11px] whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity shadow-lg z-50">AI 生成学习路径</span>
            </div>
            <div className="relative inline-flex group/tip">
              <Link href="/explore" className="px-3 py-1.5 rounded-full text-gray-600 hover:bg-gray-100 hover:text-gray-700 transition-colors">广场</Link>
              <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1.5 px-2.5 py-1 rounded-lg bg-gray-800 text-white text-[11px] whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity shadow-lg z-50">发现动态、资源与路径</span>
            </div>
            <div className="relative inline-flex group/tip">
              <Link href="/friends" className="px-3 py-1.5 rounded-full text-gray-600 hover:bg-gray-100 hover:text-gray-700 transition-colors relative" aria-label={`好友${notifCount > 0 ? `，${notifCount}条新请求` : ''}`}>
                好友
                {notifCount > 0 && <span className="absolute -top-1 -right-1 bg-[#ef4444] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center" aria-hidden="true">{notifCount}</span>}
              </Link>
              <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1.5 px-2.5 py-1 rounded-lg bg-gray-800 text-white text-[11px] whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity shadow-lg z-50">好友管理</span>
            </div>
            <div className="relative inline-flex group/tip">
              <Link href="/messages" className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors relative" aria-label={`消息${msgCount > 0 ? `，${msgCount}条未读` : ''}`}>
                <MessageCircle size={17} />
                {msgCount > 0 && <span className="absolute -top-1 -right-1 bg-[#ef4444] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center" aria-hidden="true">{msgCount}</span>}
              </Link>
              <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1.5 px-2.5 py-1 rounded-lg bg-gray-800 text-white text-[11px] whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity shadow-lg z-50">私信</span>
            </div>
            <div className="relative inline-flex group/tip">
              <Link href="/notifications" className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors relative" aria-label={`通知${notifCount > 0 ? `，${notifCount}条未读` : ''}`}>
                <Bell size={17} />
                {notifCount > 0 && <span className="absolute -top-1 -right-1 bg-[#ef4444] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center" aria-hidden="true">{notifCount}</span>}
              </Link>
              <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1.5 px-2.5 py-1 rounded-lg bg-gray-800 text-white text-[11px] whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity shadow-lg z-50">通知</span>
            </div>
            <div className="w-px h-5 bg-gray-200 mx-1"></div>
            <div className="relative inline-flex group/tip">
              <Link href="/profile" className="px-2 py-1 rounded-full text-gray-600 hover:bg-gray-100 hover:text-gray-700 transition-colors">{user.username}</Link>
              <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1.5 px-2.5 py-1 rounded-lg bg-gray-800 text-white text-[11px] whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity shadow-lg z-50">个人主页</span>
            </div>
            <div className="relative inline-flex group/tip">
              <Link href="/settings" className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"><Settings size={15} /></Link>
              <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1.5 px-2.5 py-1 rounded-lg bg-gray-800 text-white text-[11px] whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity shadow-lg z-50">设置</span>
            </div>
            <div className="relative inline-flex group/tip">
              <button onClick={logout} className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"><LogOut size={15} /></button>
              <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1.5 px-2.5 py-1 rounded-lg bg-gray-800 text-white text-[11px] whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity shadow-lg z-50">退出登录</span>
            </div>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
