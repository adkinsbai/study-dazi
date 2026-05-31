'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';
import Link from 'next/link';

type Scope = 'week' | 'total' | 'friends';

interface RankItem {
  rank: number;
  userId: string;
  username: string;
  avatarUrl: string | null;
  checkInDays: number;
  totalMinutes: number;
  completedNodes: number;
  score: number;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function LeaderboardPage() {
  const token = useAuthStore(s => s.token);
  const myId = useAuthStore(s => s.user?.id);
  const [scope, setScope] = useState<Scope>('week');
  const [rankings, setRankings] = useState<RankItem[]>([]);
  const [myRank, setMyRank] = useState<RankItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (token) load(scope); }, [token, scope]);

  const load = async (s: Scope) => {
    setLoading(true);
    const res = await fetch(`/api/leaderboard?scope=${s}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const d = await res.json();
      setRankings(d.rankings || []);
      setMyRank(d.myRank || null);
    }
    setLoading(false);
  };

  const switchScope = (s: Scope) => { setScope(s); };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">🏆 排行榜</h1>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">返回</Link>
        </div>
      </header>

      <div className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto flex">
          {[
            { id: 'week' as Scope, label: '本周' },
            { id: 'total' as Scope, label: '总榜' },
            { id: 'friends' as Scope, label: '好友' },
          ].map(t => (
            <button key={t.id} onClick={() => switchScope(t.id)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${scope === t.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* My rank card */}
        {myRank && (
          <div className="bg-indigo-50 rounded-xl p-4 flex items-center gap-4">
            <span className="text-2xl">{myRank.rank <= 3 ? MEDALS[myRank.rank - 1] : `#${myRank.rank}`}</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">我的排名</p>
              <p className="text-xs text-gray-500">
                {scope === 'week' ? '本周' : scope === 'friends' ? '好友中' : '累计'}打卡 {myRank.checkInDays} 天 · {myRank.totalMinutes} 分钟 · 完成 {myRank.completedNodes} 节点
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-center text-gray-400 py-8">加载中...</p>
        ) : rankings.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-gray-400 text-sm">
              {scope === 'friends' ? '好友还没有学习记录' : '暂无排行数据'}
            </p>
            <p className="text-gray-300 text-xs mt-1">开始打卡学习吧！</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {rankings.map((item, i) => (
              <Link
                key={item.userId}
                href={item.userId === myId ? '/profile' : `/profile/${item.userId}`}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${i < rankings.length - 1 ? 'border-b border-gray-50' : ''} ${item.userId === myId ? 'bg-indigo-50/50' : ''}`}
              >
                {/* Rank */}
                <span className="w-8 text-center text-sm font-bold shrink-0">
                  {item.rank <= 3 ? (
                    <span className="text-lg">{MEDALS[item.rank - 1]}</span>
                  ) : (
                    <span className="text-gray-400">{item.rank}</span>
                  )}
                </span>

                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-medium text-indigo-600 shrink-0 overflow-hidden">
                  {item.avatarUrl ? <img src={item.avatarUrl} className="w-full h-full object-cover" /> : item.username[0]?.toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {item.username}
                    {item.userId === myId && <span className="text-[10px] text-indigo-500 ml-1">(我)</span>}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    打卡 {item.checkInDays} 天 · {item.totalMinutes} 分钟 · {item.completedNodes} 节点
                  </p>
                </div>

                {/* Score */}
                <span className="text-xs font-bold text-indigo-600 shrink-0">{item.score} 分</span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
