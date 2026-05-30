'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';
import Link from 'next/link';

export default function NotificationsPage() {
  const token = useAuthStore(s => s.token);
  const [notifs, setNotifs] = useState<{ id: string; type: string; content: string; read: boolean; createdAt: string }[]>([]);

  useEffect(() => { if (token) load(); }, [token]);

  const load = async () => {
    const res = await fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) { const d = await res.json(); setNotifs(d.notifications || []); }
  };

  const markOne = async (id: string) => {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id }) });
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAll = async () => {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({}) });
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  };

  const unreadCount = notifs.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold">通知{unreadCount > 0 && ` (${unreadCount})`}</h1>
          <div className="flex gap-3">
            {unreadCount > 0 && <button onClick={markAll} className="text-xs text-indigo-600">全部已读</button>}
            <Link href="/" className="text-sm text-gray-500">返回</Link>
          </div>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-2">
          {notifs.map(n => (
            <div key={n.id} className={`p-3 rounded-lg flex items-start gap-3 ${n.read ? 'bg-white' : 'bg-indigo-50 border-l-2 border-indigo-400'}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm">{n.content}</p>
                <p className="text-xs text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString('zh-CN')}</p>
              </div>
              {!n.read && (
                <button onClick={() => markOne(n.id)} className="text-xs text-indigo-500 hover:text-indigo-700 shrink-0 mt-0.5">标记已读</button>
              )}
            </div>
          ))}
          {notifs.length === 0 && <p className="text-center text-gray-400 py-8">暂无通知</p>}
        </div>
      </main>
    </div>
  );
}
