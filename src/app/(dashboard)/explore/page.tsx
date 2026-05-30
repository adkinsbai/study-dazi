'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Template {
  id: string; title: string; domain: string; forkCount: number; createdAt: string;
  user: { id: string; username: string; avatarUrl: string | null };
}

const DOMAINS = ['前端开发', '后端开发', 'Python', 'AI/ML', '移动开发', 'UI 设计', '数据分析', 'DevOps'];

export default function ExplorePage() {
  const token = useAuthStore(s => s.token);
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [domain, setDomain] = useState('');
  const [forking, setForking] = useState<string | null>(null);

  useEffect(() => { loadTemplates(); }, []);

  const loadTemplates = async (s = '', d = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (s) params.set('search', s);
      if (d) params.set('domain', d);
      const res = await fetch(`/api/paths/templates?${params}`);
      if (res.ok) { const data = await res.json(); setTemplates(data.templates || []); }
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const handleSearch = () => loadTemplates(search, domain);
  const handleDomain = (d: string) => { setDomain(d === domain ? '' : d); loadTemplates(search, d === domain ? '' : d); };

  const handleFork = async (id: string) => {
    setForking(id);
    try {
      const res = await fetch(`/api/paths/${id}/fork`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const d = await res.json();
        setTemplates(prev => prev.map(t => t.id === id ? { ...t, forkCount: t.forkCount + 1 } : t));
        router.push(`/paths/${d.id}`);
      }
    } catch { /* ignore */ } finally { setForking(null); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">路径模板广场</h1>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">返回</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-xl shadow-sm p-4 flex gap-2">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="搜索模板..." className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400" />
          <button onClick={handleSearch} className="px-4 py-2 rounded-lg bg-indigo-600 text-sm text-white hover:bg-indigo-500">搜索</button>
        </div>

        <div className="flex flex-wrap gap-2">
          {DOMAINS.map(d => (
            <button key={d} onClick={() => handleDomain(d)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${domain === d ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {d}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-center text-gray-400 text-sm py-12">加载中...</p>
        ) : templates.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-12">暂无模板</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map(t => (
              <div key={t.id} className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow">
                <h3 className="font-semibold text-gray-900">{t.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-600">{t.domain}</span>
                  <span className="text-xs text-gray-400">Fork {t.forkCount}</span>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] overflow-hidden">
                    {t.user.avatarUrl ? <img src={t.user.avatarUrl} className="w-full h-full object-cover" /> : t.user.username[0]}
                  </div>
                  <span className="text-xs text-gray-500">{t.user.username}</span>
                </div>
                <button onClick={() => handleFork(t.id)} disabled={forking === t.id}
                  className="mt-3 w-full py-1.5 rounded-md border border-indigo-300 text-sm text-indigo-600 hover:bg-indigo-50 disabled:opacity-50">
                  {forking === t.id ? 'Forking...' : '🔀 Fork 到我的路径'}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
