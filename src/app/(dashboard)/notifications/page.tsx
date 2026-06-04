'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';
import { useBadgeStore } from '@/stores/badges';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { X, Bell, Heart, MessageCircle, User, Users, Clock } from 'lucide-react';

interface NotifItem { id: string; type: string; content: string; read: boolean; createdAt: string; referenceId: string | null; }

function getNotifLink(n: NotifItem): string | null {
  switch (n.type) {
    case 'friend_request':
    case 'buddy_invite': return '/friends';
    case 'like':
      if (n.referenceId) return '/explore';
      return null;
    case 'comment':
      if (!n.referenceId) return null;
      if (n.referenceId.startsWith('explore:')) return '/explore';
      return `/paths/${n.referenceId}`;
    case 'nudge':
    case 'group_invite': return '/buddies';
    default: return null;
  }
}

function getNotifIcon(type: string) {
  switch (type) {
    case 'friend_request': return <User size={14} />;
    case 'buddy_invite': return <Users size={14} />;
    case 'group_invite': return <Users size={14} />;
    case 'like': return <Heart size={14} />;
    case 'comment': return <MessageCircle size={14} />;
    case 'nudge': return <Clock size={14} />;
    default: return <Bell size={14} />;
  }
}

function getNotifColor(type: string): string {
  switch (type) {
    case 'friend_request': return 'bg-[#eef2ff] text-[#6366f1]';
    case 'buddy_invite':
    case 'group_invite': return 'bg-[#ede9fe] text-[#8b5cf6]';
    case 'like': return 'bg-[#fde8e6] text-[#f97066]';
    case 'comment': return 'bg-[#d1fae5] text-[#10b981]';
    case 'nudge': return 'bg-[#fef3c7] text-[#f59e0b]';
    default: return 'bg-gray-100 text-gray-500';
  }
}

export default function NotificationsPage() {
  const token = useAuthStore(s => s.token);
  const refreshBadges = useBadgeStore(s => s.refreshBadges);
  const router = useRouter();
  const [notifs, setNotifs] = useState<NotifItem[]>([]);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      const res = await fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setNotifs(d.notifications || []); }
      // Auto-mark all as read on visit
      await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({}) });
      setNotifs(prev => prev.map(n => ({ ...n, read: true })));
      refreshBadges(token);
    };
    load();
  }, [token]);

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
    <div className="min-h-screen bg-[#fef7f5] bg-stripe">
      <header className="bg-white/90 backdrop-blur-md border-b border-[#fde8e6] sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="w-1 h-5 rounded-full bg-[#f97066]"></span>
            通知{unreadCount > 0 && <span className="text-sm font-normal text-[#f97066]">({unreadCount}条未读)</span>}
          </h1>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && <button onClick={markAll} className="px-3 py-1 rounded-full text-xs text-[#f97066] bg-[#fde8e6] hover:bg-[#f97066] hover:text-white transition-colors">全部已读</button>}
            <Link href="/" className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"><X size={16} /></Link>
          </div>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-6">
        {notifs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3 text-gray-300"><Bell size={48} /></p>
            <p className="text-gray-400 text-sm">暂无通知</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifs.map(n => {
              const link = getNotifLink(n);
              return (
                <div key={n.id}
                  onClick={() => handleClick(n)}
                  className={`group relative p-4 rounded-2xl flex items-start gap-3 transition-all ${n.read ? 'bg-white border border-gray-100 hover:border-[#fde8e6] hover:shadow-sm' : 'bg-[#fef4f3] border border-[#fde8e6] hover:shadow-sm'} ${link ? 'cursor-pointer' : ''}`}>
                  {!n.read && <div className="absolute top-4 left-4 w-1.5 h-1.5 rounded-full bg-[#f97066]"></div>}
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 ${getNotifColor(n.type)}`}>{getNotifIcon(n.type)}</span>
                  <div className="flex-1 min-w-0 pl-2">
                    <p className="text-sm text-gray-800 leading-relaxed">{n.content}</p>
                    <p className="text-xs text-gray-400 mt-1.5">{new Date(n.createdAt).toLocaleString('zh-CN')}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!n.read && (
                      <button onClick={(e) => markOne(e, n.id)} className="px-2 py-0.5 rounded-full text-[10px] text-[#f97066] bg-[#fde8e6] hover:bg-[#f97066] hover:text-white transition-colors">已读</button>
                    )}
                    {link && <span className="text-xs text-gray-300 group-hover:text-[#6366f1] transition-colors">→</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
