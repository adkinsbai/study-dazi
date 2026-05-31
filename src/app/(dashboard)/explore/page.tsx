'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ExploreComment { id: string; content: string; createdAt: string; user: { username: string }; }
type Tab = 'posts' | 'resources' | 'paths';

interface PostItem { id: string; content: string; images: string[]; markdown?: string; createdAt: string;
  user: { id: string; username: string; avatarUrl: string | null }; }
interface ResourceItem { id: string; title: string; url?: string; fileUrl?: string; fileName?: string; notes?: string; domain: string; description?: string; createdAt: string;
  user: { username: string }; }
interface PathItem { id: string; title: string; domain: string; forkCount: number; createdAt: string;
  user: { id: string; username: string; avatarUrl: string | null }; }

export default function ExplorePage() {
  const token = useAuthStore(s => s.token);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('posts');
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [paths, setPaths] = useState<PathItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState('');
  const [search, setSearch] = useState('');
  const [suggestedDomains, setSuggestedDomains] = useState<string[]>([]);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [likedResourceIds, setLikedResourceIds] = useState<Set<string>>(new Set());
  const [showLiked, setShowLiked] = useState(false);

  const [showResourceForm, setShowResourceForm] = useState(false);
  const [resForm, setResForm] = useState({ title: '', url: '', domain: '', description: '', notes: '' });
  const [resSubmitting, setResSubmitting] = useState(false);
  const [resError, setResError] = useState('');

  useEffect(() => { loadTab('posts'); loadDomains(); loadLikes(); }, []);

  const loadLikes = async () => {
    try {
      const res = await fetch('/api/likes', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const d = await res.json();
        const pIds = new Set<string>(); const rIds = new Set<string>();
        for (const l of d.likes || []) {
          if (l.postId) pIds.add(l.postId);
          if (l.resourceId) rIds.add(l.resourceId);
        }
        setLikedPostIds(pIds); setLikedResourceIds(rIds);
      }
    } catch { /* ignore */ }
  };

  const toggleLike = async (postId?: string, resourceId?: string) => {
    const isLiked = postId ? likedPostIds.has(postId) : resourceId ? likedResourceIds.has(resourceId!) : false;
    try {
      if (isLiked) {
        await fetch('/api/likes', { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ postId, resourceId }) });
      } else {
        await fetch('/api/likes', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ postId, resourceId }) });
      }
      if (postId) setLikedPostIds(prev => { const n = new Set(prev); isLiked ? n.delete(postId) : n.add(postId); return n; });
      if (resourceId) setLikedResourceIds(prev => { const n = new Set(prev); isLiked ? n.delete(resourceId!) : n.add(resourceId!); return n; });
    } catch { /* ignore */ }
  };

  const loadDomains = async () => {
    try {
      const res = await fetch('/api/resources?domains=1');
      if (res.ok) { const d = await res.json(); setSuggestedDomains(d.domains || []); }
    } catch { /* ignore */ }
  };

  const loadTab = async (t: Tab, d = '') => {
    setLoading(true);
    try {
      if (t === 'posts') {
        const res = await fetch('/api/explore?type=posts');
        if (res.ok) { const data = await res.json(); setPosts(data.posts || []); }
      } else if (t === 'resources') {
        const params = new URLSearchParams({ type: 'resources' });
        if (d) params.set('domain', d);
        if (search) params.set('search', search);
        const res = await fetch(`/api/explore?${params}`);
        if (res.ok) { const data = await res.json(); setResources(data.resources || []); }
      } else {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (d) params.set('domain', d);
        const res = await fetch(`/api/paths/templates?${params}`);
        if (res.ok) { const data = await res.json(); setPaths(data.templates || []); }
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const switchTab = (t: Tab) => { setTab(t); setSearch(''); loadTab(t, domain); };

  const handleFork = async (id: string) => {
    const res = await fetch(`/api/paths/${id}/fork`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) { const d = await res.json(); router.push(`/paths/${d.id}`); }
  };

  const handleAddResource = async () => {
    if (!resForm.title || !resForm.domain) { setResError('请填写资源名称和领域'); return; }
    setResError('');
    setResSubmitting(true);
    try {
      const body: Record<string, string> = { title: resForm.title, domain: resForm.domain };
      if (resForm.url) body.url = resForm.url;
      if (resForm.description) body.description = resForm.description;
      if (resForm.notes) body.notes = resForm.notes;
      const res = await fetch('/api/resources', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || '提交失败 (' + res.status + ')');
      setShowResourceForm(false);
      setResForm({ title: '', url: '', domain: '', description: '', notes: '' });
      loadTab('resources', domain);
    } catch (err) {
      setResError(err instanceof Error ? err.message : '提交失败');
    } finally { setResSubmitting(false); }
  };

  return (
    <div>
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto flex">
          {[{ id: 'posts', label: '动态' }, { id: 'resources', label: '资源' }, { id: 'paths', label: '路径' }].map(t => (
            <button key={t.id} onClick={() => switchTab(t.id as Tab)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-[#f97066] text-[#f97066]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex flex-wrap gap-2 mb-4">
          {suggestedDomains.map(d => (
            <button key={d} onClick={() => { setDomain(domain === d ? '' : d); loadTab(tab, domain === d ? '' : d); }}
              className={`px-3 py-1 rounded-full text-xs font-medium ${domain === d ? 'bg-[#f97066] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {d}
            </button>
          ))}
          {suggestedDomains.length === 0 && (
            <span className="text-xs text-gray-400">分享资源后板块自动出现</span>
          )}
        </div>

        {loading ? <p className="text-center text-gray-400 py-12">加载中...</p> : (
          <>
            {tab === 'posts' && (
              <div className="space-y-4">
                <button onClick={() => setShowLiked(!showLiked)}
                  className={`text-xs ${showLiked ? 'text-red-500' : 'text-gray-400'} hover:text-red-500`}>
                  {showLiked ? '❤️ 我的收藏' : '🤍 我的收藏'}
                </button>
                {posts.filter(p => !showLiked || likedPostIds.has(p.id)).length === 0 && <p className="text-center text-gray-400 py-12">暂无动态</p>}
                {posts.filter(p => !showLiked || likedPostIds.has(p.id)).map(p => (
                  <div key={p.id} className="bg-white rounded-2xl shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Link href={`/profile/${p.user.id}`} className="flex items-center gap-2 hover:underline">
                        <div className="w-6 h-6 rounded-full bg-[#fde8e6] flex items-center justify-center text-xs overflow-hidden">
                          {p.user.avatarUrl ? <img src={p.user.avatarUrl} className="w-full h-full object-cover" /> : p.user.username[0]}
                        </div>
                        <span className="text-sm font-medium text-gray-700">{p.user.username}</span>
                      </Link>
                      <span className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString('zh-CN')}</span>
                      <div className="flex-1" />
                      <button onClick={() => toggleLike(p.id, undefined)}
                        className={`text-sm ${likedPostIds.has(p.id) ? 'text-red-500' : 'text-gray-300'} hover:text-red-500`}>
                        {likedPostIds.has(p.id) ? '❤️' : '🤍'}
                      </button>
                    </div>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{p.content}</p>
                    {p.markdown && <div className="mt-2 text-sm text-gray-700 italic border-l-2 border-gray-200 pl-3">{p.markdown.substring(0, 200)}</div>}
                    {p.images?.length > 0 && <div className="mt-2 flex gap-1 flex-wrap">{p.images.slice(0, 6).map((url, i) => <img key={i} src={url} className="w-20 h-20 object-cover rounded" />)}</div>}
                    <InlineComments targetId={p.id} type="post" />
                  </div>
                ))}
              </div>
            )}

            {tab === 'resources' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadTab('resources', domain)}
                    placeholder="搜索资源名称..." className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400" />
                  <button onClick={() => loadTab('resources', domain)} className="px-4 py-2 bg-[#f97066] text-white text-sm rounded-lg hover:bg-[#e0524a]">搜索</button>
                  <button onClick={() => { setShowResourceForm(!showResourceForm); setResError(''); }}
                    className="text-sm text-[#f97066] hover:text-[#e0524a] shrink-0">+ 分享资源</button>
                  <button onClick={() => setShowLiked(!showLiked)}
                    className={`text-xs shrink-0 ${showLiked ? 'text-red-500' : 'text-gray-400'} hover:text-red-500`}>
                    {showLiked ? '❤️' : '🤍'}
                  </button>
                </div>
                {showResourceForm && (
                  <div className="bg-white rounded-2xl shadow-sm p-4 space-y-2">
                    {resError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{resError}</p>}
                    <input value={resForm.title} onChange={e => setResForm(p => ({ ...p, title: e.target.value }))}
                      placeholder="资源名称 *" className="w-full border rounded-md px-3 py-2 text-sm" />
                    <input value={resForm.url} onChange={e => setResForm(p => ({ ...p, url: e.target.value }))}
                      placeholder="链接 URL" className="w-full border rounded-md px-3 py-2 text-sm" />
                    <input value={resForm.domain} onChange={e => setResForm(p => ({ ...p, domain: e.target.value }))}
                      list="domain-suggestions" placeholder="领域/板块 *（可自定义）"
                      className="w-full border rounded-md px-3 py-2 text-sm" />
                    <datalist id="domain-suggestions">
                      {suggestedDomains.map(d => <option key={d} value={d} />)}
                    </datalist>
                    <textarea value={resForm.notes} onChange={e => setResForm(p => ({ ...p, notes: e.target.value }))}
                      placeholder="笔记/说明（可选）" rows={3}
                      className="w-full border rounded-md px-3 py-2 text-sm resize-none" />
                    <button onClick={handleAddResource} disabled={resSubmitting}
                      className="px-4 py-1.5 rounded-md bg-[#f97066] text-sm text-white hover:bg-[#e0524a] disabled:opacity-50">
                      {resSubmitting ? '提交中...' : '提交'}
                    </button>
                  </div>
                )}
                {resources.filter(r => !showLiked || likedResourceIds.has(r.id)).length === 0 && <p className="text-center text-gray-400 py-8">暂无资源</p>}
                {resources.filter(r => !showLiked || likedResourceIds.has(r.id)).map(r => (
                  <div key={r.id} className="bg-white rounded-2xl shadow-sm p-4">
                    <div className="flex items-center gap-2">
                      {r.url ? (
                        <a href={r.url} target="_blank" rel="noopener" className="text-sm font-medium text-[#f97066] hover:underline">{r.title}</a>
                      ) : <span className="text-sm font-medium">{r.title}</span>}
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100">{r.domain}</span>
                      <div className="flex-1" />
                      <button onClick={() => toggleLike(undefined, r.id)}
                        className={`text-sm ${likedResourceIds.has(r.id) ? 'text-red-500' : 'text-gray-300'} hover:text-red-500`}>
                        {likedResourceIds.has(r.id) ? '❤️' : '🤍'}
                      </button>
                    </div>
                    {r.description && <p className="text-xs text-gray-500 mt-1">{r.description}</p>}
                    {r.notes && <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap border-l-2 border-amber-200 pl-3">{r.notes.substring(0, 300)}</p>}
                    <p className="text-xs text-gray-400 mt-1">{r.user.username} · {new Date(r.createdAt).toLocaleDateString('zh-CN')}</p>
                    <InlineComments targetId={r.id} type="resource" />
                  </div>
                ))}
              </div>
            )}

            {tab === 'paths' && (
              <>
                <div className="flex gap-2 mb-4">
                  <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadTab('paths', domain)}
                    placeholder="搜索路径名称..." className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400" />
                  <button onClick={() => loadTab('paths', domain)} className="px-4 py-2 bg-[#f97066] text-white text-sm rounded-lg hover:bg-[#e0524a]">搜索</button>
                  {(search || domain) && (
                    <button onClick={() => { setSearch(''); setDomain(''); loadTab('paths', ''); }} className="px-3 py-2 text-sm text-gray-400 hover:text-gray-600">清除</button>
                  )}
                </div>
                {paths.length === 0 && (
                  <p className="text-center text-gray-400 py-8">
                    {search || domain ? '没有匹配的路径模板，试试其他关键词' : '暂无路径模板'}
                  </p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {paths.map(t => (
                    <div key={t.id} className="bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition-shadow">
                      <h3 className="font-semibold">{t.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-2 py-0.5 rounded bg-[#fef4f3] text-[#f97066]">{t.domain}</span>
                        <span className="text-xs text-gray-400">Fork {t.forkCount}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500"><Link href={`/profile/${t.user.id}`}>{t.user.username}</Link></div>
                      <button onClick={() => handleFork(t.id)} className="mt-3 w-full py-1.5 rounded-md border border-[#f97066] text-sm text-[#f97066] hover:bg-[#fef4f3]">🔀 Fork</button>
                      <InlineComments targetId={t.id} type="path" />
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ─── Inline comments ──────────────────────────────
function InlineComments({ targetId, type }: { targetId: string; type: string }) {
  const token = useAuthStore(s => s.token);
  const [show, setShow] = useState(false);
  const [comments, setComments] = useState<ExploreComment[]>([]);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      const res = await fetch(`/api/comments?pathId=explore&nodeId=${type}-${targetId}`);
      if (res.ok) { const d = await res.json(); setComments(d.comments || []); }
    } catch { /* ignore */ }
  };

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await fetch('/api/comments', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pathId: 'explore', nodeId: `${type}-${targetId}`, content: text }),
      });
      setText(''); load();
    } catch { /* ignore */ } finally { setSubmitting(false); }
  };

  return (
    <div className="mt-2 border-t pt-2">
      <button onClick={() => { setShow(!show); if (!show) load(); }} className="text-xs text-gray-400 hover:text-[#f97066]">
        💬 评论 {comments.length > 0 && `(${comments.length})`}
      </button>
      {show && (
        <div className="mt-2 space-y-2">
          {comments.map(c => (
            <div key={c.id} className="text-xs"><span className="font-medium">{c.user.username}</span>: {c.content}</div>
          ))}
          <div className="flex gap-1">
            <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="写评论..." className="flex-1 border rounded px-2 py-1 text-xs" />
            <button onClick={handleSubmit} disabled={submitting} className="px-2 py-1 bg-[#f97066] text-white text-xs rounded">发送</button>
          </div>
        </div>
      )}
    </div>
  );
}
