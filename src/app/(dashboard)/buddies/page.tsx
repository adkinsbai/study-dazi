'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';
import Link from 'next/link';

interface BoardItem {
  buddyId: string;
  sharedPathId: string;
  domain: string;
  buddy: { id: string; username: string; avatarUrl: string | null };
  path: { id?: string; title: string };
  totalNodes: number;
  myCompleted: number;
  myTotal: number;
  buddyCompleted: number;
  buddyTotal: number;
}

function ProgressBar({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-500 w-8 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-400' : 'bg-gray-300'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-gray-500 w-14 text-right">{done}/{total} ({pct}%)</span>
    </div>
  );
}

export default function BuddiesPage() {
  const token = useAuthStore(s => s.token);
  const [boards, setBoards] = useState<BoardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [nudging, setNudging] = useState<string | null>(null);

  useEffect(() => { if (token) load(); }, [token]);

  const load = async () => {
    const res = await fetch('/api/buddies/board', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) { const d = await res.json(); setBoards(d.boards || []); }
    setLoading(false);
  };

  const handleNudge = async (buddyId: string, toUserId: string) => {
    setNudging(buddyId);
    try {
      await fetch('/api/buddies/nudge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ buddyId, toUserId }),
      });
    } catch { /* ignore */ }
    setNudging(null);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-400">加载中...</p></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">🤝 搭子看板</h1>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">返回</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {boards.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-gray-500 text-sm">还没有搭子共享路径</p>
            <p className="text-gray-400 text-xs mt-1">在好友页面邀请搭子并选择共享路径，即可在此查看进度对比</p>
            <Link href="/friends" className="text-sm text-indigo-600 hover:text-indigo-500 mt-3 inline-block">去邀请搭子 →</Link>
          </div>
        ) : (
          boards.map(b => (
            <div key={b.buddyId} className="bg-white rounded-xl shadow-sm p-5 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-sm font-medium text-purple-600 overflow-hidden shrink-0">
                    {b.buddy.avatarUrl ? <img src={b.buddy.avatarUrl} className="w-full h-full object-cover" /> : b.buddy.username[0]?.toUpperCase()}
                  </div>
                  <div>
                    <Link href={`/profile/${b.buddy.id}`} className="text-sm font-semibold text-gray-900 hover:text-indigo-600">
                      {b.buddy.username}
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">{b.domain}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleNudge(b.buddyId, b.buddy.id)}
                    disabled={nudging === b.buddyId}
                    className="text-xs px-2 py-1 rounded-md bg-amber-50 text-amber-600 hover:bg-amber-100 disabled:opacity-50"
                  >
                    {nudging === b.buddyId ? '发送中' : '⏰ 催更'}
                  </button>
                  <Link href={`/messages?with=${b.buddy.id}`}
                    className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600">
                    💬
                  </Link>
                </div>
              </div>

              {/* Shared path */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">共享路径:</span>
                  {b.path.id ? (
                    <Link href={`/paths/${b.path.id}`} className="text-sm font-medium text-indigo-600 hover:underline">
                      📚 {b.path.title}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium text-gray-700">{b.path.title}</span>
                  )}
                  <span className="text-[10px] text-gray-400 ml-auto">{b.totalNodes} 个节点</span>
                </div>

                {/* Progress comparison */}
                <div className="space-y-2">
                  <ProgressBar done={b.myCompleted} total={b.totalNodes} label="我" />
                  <ProgressBar done={b.buddyCompleted} total={b.totalNodes} label={b.buddy.username[0]} />
                </div>

                {/* Status summary */}
                <div className="flex gap-4 text-[10px] text-gray-400 pt-1 border-t border-gray-200">
                  <span>我的进度: {b.totalNodes > 0 ? Math.round((b.myCompleted / b.totalNodes) * 100) : 0}%</span>
                  <span>{b.buddy.username}进度: {b.totalNodes > 0 ? Math.round((b.buddyCompleted / b.totalNodes) * 100) : 0}%</span>
                  {b.myCompleted >= b.buddyCompleted && b.myCompleted > 0 && <span className="text-emerald-500 ml-auto">🏆 领先</span>}
                </div>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
