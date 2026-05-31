'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface NotifItem { id: string; type: string; content: string; read: boolean; createdAt: string; referenceId: string | null; }

function getNotifLink(n: NotifItem): string | null {
  switch (n.type) {
    case 'friend_request':
    case 'buddy_invite':
      return '/friends';
    case 'like':
      return '/explore';
    case 'comment':
      return n.referenceId === 'explore' ? '/explore' : n.referenceId ? `/paths/${n.referenceId}` : null;
    case 'nudge':
      return '/buddies';
    default:
      return null;
  }
}

function getNotifIcon(type: string): string {
  switch (type) {
    case 'friend_request': return '👤';
    case 'buddy_invite': return '🤝';
    case 'like': return '❤️';
    case 'comment': return '💬';
    case 'nudge': return '⏰';
    default: return '🔔';
  }
}

export default function NotificationsPage() {
  const token = useAuthStore(s => s.token);
  const router = useRouter();
  const [notifs, setNotifs] = useState<NotifItem[]>([]);

  useEffect(() => { if (token) load(); }, [token]);

  const load = async () => {
    const res = await fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) { const d = await res.json(); setNotifs(d.notifications || []); }
  };

  const markOne = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id }) });
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAll = async () => {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({}) });
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleClick = async (n: NotifItem) => {
    if (!n.read) {
      await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: n.id }) });
      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
    }
    const link = getNotifLink(n);
    if (link) router.push(link);
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
          {notifs.map(n => {
            const link = getNotifLink(n);
            return (
              <div key={n.id}
                onClick={() => handleClick(n)}
                className={`p-3 rounded-lg flex items-start gap-3 transition-colors ${n.read ? 'bg-white hover:bg-gray-50' : 'bg-indigo-50 border-l-2 border-indigo-400 hover:bg-indigo-100'} ${link ? 'cursor-pointer' : ''}`}>
                <span className="text-lg shrink-0 mt-0.5">{getNotifIcon(n.type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{n.content}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString('zh-CN')}</p>
                </div>
                {!n.read && (
                  <button onClick={(e) => markOne(e, n.id)} className="text-xs text-indigo-500 hover:text-indigo-700 shrink-0 mt-0.5">标记已读</button>
                )}
                {link && (
                  <span className="text-xs text-gray-300 shrink-0 mt-0.5">→</span>
                )}
              </div>
            );
          })}
          {notifs.length === 0 && <p className="text-center text-gray-400 py-8">暂无通知</p>}
        </div>
      </main>
    </div>
  );
}
