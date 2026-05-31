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
    <div className="min-h-screen bg-[#fef7f5]">
      {/* 标签栏 */}
      <div className="bg-white/90 backdrop-blur-md border-b border-[#fde8e6] sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex">
          {[
            { id: 'posts' as Tab, label: '动态', icon: '📝' },
            { id: 'resources' as Tab, label: '资源', icon: '📎' },
            { id: 'paths' as Tab, label: '路径', icon: '🗺️' },
          ].map(t => (
            <button key={t.id} onClick={() => switchTab(t.id)}
              className={`px-5 py-3.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${tab === t.id ? 'border-[#f97066] text-[#f97066]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <span className="text-xs">{t.icon}</span> {t.label}
            </button>
          ))}
          <div className="flex-1" />
          <button onClick={() => setShowLiked(!showLiked)}
            className={`px-3 py-3.5 text-sm transition-colors ${showLiked ? 'text-[#f97066]' : 'text-gray-400 hover:text-[#f97066]'}`}>
            {showLiked ? '❤️' : '🤍'}
          </button>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* 领域筛选 */}
        {suggestedDomains.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {suggestedDomains.map(d => (
              <button key={d} onClick={() => { setDomain(domain === d ? '' : d); loadTab(tab, domain === d ? '' : d); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${domain === d ? 'bg-[#f97066] text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:border-[#fde8e6] hover:text-[#f97066]'}`}>
                {d}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-2xl bg-white/60 animate-pulse"></div>)}
          </div>
        ) : (
          <>
            {/* ─── 动态 ─── */}
            {tab === 'posts' && (
              <div className="space-y-4">
                {posts.filter(p => !showLiked || likedPostIds.has(p.id)).length === 0 && (
                  <div className="text-center py-16">
                    <p className="text-4xl mb-3">📝</p>
                    <p className="text-gray-400 text-sm">暂无动态</p>
                  </div>
                )}
                {posts.filter(p => !showLiked || likedPostIds.has(p.id)).map(p => (
                  <article key={p.id} className="bg-white rounded-2xl border border-gray-100 hover:border-[#fde8e6] hover:shadow-sm transition-all overflow-hidden">
                    {/* 用户信息 */}
                    <div className="flex items-center gap-3 px-5 pt-4 pb-2">
                      <Link href={`/profile/${p.user.id}`} className="shrink-0">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-xs font-bold text-white overflow-hidden">
                          {p.user.avatarUrl ? <img src={p.user.avatarUrl} className="w-full h-full object-cover" /> : p.user.username[0]}
                        </div>
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link href={`/profile/${p.user.id}`} className="text-sm font-semibold text-[#6366f1] hover:text-[#4f46e5] underline underline-offset-2 decoration-[#6366f1]/30 hover:decoration-[#6366f1] transition-colors">{p.user.username}</Link>
                        <p className="text-[11px] text-gray-400">{new Date(p.createdAt).toLocaleDateString('zh-CN')}</p>
                      </div>
                      <button onClick={() => toggleLike(p.id, undefined)}
                        className={`p-1.5 rounded-full transition-colors ${likedPostIds.has(p.id) ? 'text-[#f97066] bg-[#fde8e6]' : 'text-gray-300 hover:text-[#f97066] hover:bg-[#fef4f3]'}`}>
                        {likedPostIds.has(p.id) ? '❤️' : '🤍'}
                      </button>
                    </div>

                    {/* 内容 */}
                    <div className="px-5 pb-3">
                      <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{p.content}</p>
                      {p.markdown && (
                        <div className="mt-3 p-3 rounded-xl bg-[#fef7f5] text-sm text-gray-600 leading-relaxed">
                          {p.markdown.substring(0, 200)}{p.markdown.length > 200 && '...'}
                        </div>
                      )}
                      {p.images?.length > 0 && (
                        <div className="mt-3 flex gap-2 flex-wrap">
                          {p.images.slice(0, 6).map((url, i) => (
                            <img key={i} src={url} className="w-20 h-20 object-cover rounded-xl border border-gray-100" alt="动态图片" />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 评论区 */}
                    <div className="border-t border-gray-50">
                      <InlineComments targetId={p.id} type="post" />
                    </div>
                  </article>
                ))}
              </div>
            )}

            {/* ─── 资源 ─── */}
            {tab === 'resources' && (
              <div className="space-y-4">
                {/* 搜索 + 操作栏 */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadTab('resources', domain)}
                      placeholder="搜索资源..." className="w-full border border-gray-200 rounded-full px-4 py-2.5 text-sm outline-none focus:border-[#f97066] focus:ring-1 focus:ring-[#fde8e6] transition-colors bg-white" />
                  </div>
                  <button onClick={() => loadTab('resources', domain)} className="p-2.5 rounded-full bg-[#f97066] text-white hover:bg-[#e0524a] transition-colors">🔍</button>
                  <button onClick={() => { setShowResourceForm(!showResourceForm); setResError(''); }}
                    className="px-4 py-2.5 rounded-full bg-white border border-[#f97066] text-[#f97066] text-sm font-medium hover:bg-[#fef4f3] transition-colors">
                    + 分享资源
                  </button>
                </div>

                {/* 分享资源表单 */}
                {showResourceForm && (
                  <div className="bg-white rounded-2xl border border-[#fde8e6] p-5 space-y-3">
                    {resError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{resError}</p>}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input value={resForm.title} onChange={e => setResForm(p => ({ ...p, title: e.target.value }))}
                        placeholder="资源名称 *" className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#f97066] focus:ring-1 focus:ring-[#fde8e6] transition-colors" />
                      <input value={resForm.url} onChange={e => setResForm(p => ({ ...p, url: e.target.value }))}
                        placeholder="链接 URL" className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#f97066] focus:ring-1 focus:ring-[#fde8e6] transition-colors" />
                    </div>
                    <input value={resForm.domain} onChange={e => setResForm(p => ({ ...p, domain: e.target.value }))}
                      list="domain-suggestions" placeholder="领域/板块 *（可自定义）"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#f97066] focus:ring-1 focus:ring-[#fde8e6] transition-colors" />
                    <datalist id="domain-suggestions">
                      {suggestedDomains.map(d => <option key={d} value={d} />)}
                    </datalist>
                    <textarea value={resForm.notes} onChange={e => setResForm(p => ({ ...p, notes: e.target.value }))}
                      placeholder="笔记/说明（可选）" rows={3}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#f97066] focus:ring-1 focus:ring-[#fde8e6] transition-colors resize-none" />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setShowResourceForm(false)} className="px-4 py-2 rounded-full text-sm text-gray-500 hover:bg-gray-100 transition-colors">取消</button>
                      <button onClick={handleAddResource} disabled={resSubmitting}
                        className="px-5 py-2 rounded-full bg-[#f97066] text-sm text-white hover:bg-[#e0524a] disabled:opacity-50 transition-colors">
                        {resSubmitting ? '提交中...' : '提交'}
                      </button>
                    </div>
                  </div>
                )}

                {resources.filter(r => !showLiked || likedResourceIds.has(r.id)).length === 0 && (
                  <div className="text-center py-16">
                    <p className="text-4xl mb-3">📎</p>
                    <p className="text-gray-400 text-sm">暂无资源</p>
                  </div>
                )}
                {resources.filter(r => !showLiked || likedResourceIds.has(r.id)).map(r => (
                  <article key={r.id} className="bg-white rounded-2xl border border-gray-100 hover:border-[#fde8e6] hover:shadow-sm transition-all overflow-hidden">
                    <div className="p-5">
                      <div className="flex items-start gap-3">
                        <span className="w-10 h-10 rounded-xl bg-[#fde8e6] text-[#f97066] flex items-center justify-center text-sm shrink-0">📎</span>
                        <div className="flex-1 min-w-0">
                          {r.url ? (
                            <a href={r.url} target="_blank" rel="noopener" className="text-sm font-semibold text-[#6366f1] hover:text-[#4f46e5] underline underline-offset-2 decoration-[#6366f1]/30 hover:decoration-[#6366f1] transition-colors">{r.title}</a>
                          ) : <span className="text-sm font-semibold text-gray-900">{r.title}</span>}
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-xs bg-[#fde8e6] text-[#e0524a] px-2 py-0.5 rounded-full">{r.domain}</span>
                            <span className="text-xs text-gray-400">{r.user.username} · {new Date(r.createdAt).toLocaleDateString('zh-CN')}</span>
                          </div>
                          {r.description && <p className="text-xs text-gray-500 mt-2 leading-relaxed">{r.description}</p>}
                          {r.notes && (
                            <div className="mt-3 p-3 rounded-xl bg-[#fef7f5] text-sm text-gray-600 leading-relaxed">
                              {r.notes.substring(0, 300)}{r.notes.length > 300 && '...'}
                            </div>
                          )}
                        </div>
                        <button onClick={() => toggleLike(undefined, r.id)}
                          className={`p-1.5 rounded-full transition-colors shrink-0 ${likedResourceIds.has(r.id) ? 'text-[#f97066] bg-[#fde8e6]' : 'text-gray-300 hover:text-[#f97066] hover:bg-[#fef4f3]'}`}>
                          {likedResourceIds.has(r.id) ? '❤️' : '🤍'}
                        </button>
                      </div>
                    </div>
                    <div className="border-t border-gray-50">
                      <InlineComments targetId={r.id} type="resource" />
                    </div>
                  </article>
                ))}
              </div>
            )}

            {/* ─── 路径 ─── */}
            {tab === 'paths' && (
              <>
                <div className="flex items-center gap-2 mb-5">
                  <div className="flex-1 relative">
                    <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadTab('paths', domain)}
                      placeholder="搜索路径模板..." className="w-full border border-gray-200 rounded-full px-4 py-2.5 text-sm outline-none focus:border-[#f97066] focus:ring-1 focus:ring-[#fde8e6] transition-colors bg-white" />
                  </div>
                  <button onClick={() => loadTab('paths', domain)} className="p-2.5 rounded-full bg-[#f97066] text-white hover:bg-[#e0524a] transition-colors">🔍</button>
                  {(search || domain) && (
                    <button onClick={() => { setSearch(''); setDomain(''); loadTab('paths', ''); }} className="p-2.5 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">✕</button>
                  )}
                </div>
                {paths.length === 0 && (
                  <div className="text-center py-16">
                    <p className="text-4xl mb-3">🗺️</p>
                    <p className="text-gray-400 text-sm">{search || domain ? '没有匹配的路径模板，试试其他关键词' : '暂无路径模板'}</p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {paths.map(t => (
                    <article key={t.id} className="bg-white rounded-2xl border border-gray-100 hover:border-[#fde8e6] hover:shadow-md transition-all overflow-hidden group">
                      <div className="p-5">
                        <div className="flex items-start gap-3 mb-3">
                          <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f97066] to-[#e0524a] text-white flex items-center justify-center text-sm shrink-0">🗺️</span>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-gray-900 group-hover:text-[#f97066] transition-colors">{t.title}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs bg-[#fde8e6] text-[#e0524a] px-2 py-0.5 rounded-full">{t.domain}</span>
                              <span className="text-xs text-gray-400">Fork {t.forkCount}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[9px] text-gray-500">{t.user.username[0]}</div>
                          <span className="text-xs text-gray-500">{t.user.username}</span>
                        </div>
                        <button onClick={() => handleFork(t.id)} className="w-full py-2 rounded-full bg-[#f97066] text-white text-sm font-medium hover:bg-[#e0524a] transition-colors">
                          🔀 Fork 这条路径
                        </button>
                      </div>
                      <div className="border-t border-gray-50">
                        <InlineComments targetId={t.id} type="path" />
                      </div>
                    </article>
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

// ─── 评论组件 ──────────────────────────────
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
    <div className="px-5 py-3">
      <button onClick={() => { setShow(!show); if (!show) load(); }}
        className="text-xs text-gray-400 hover:text-[#f97066] transition-colors flex items-center gap-1.5">
        <span>💬</span> {comments.length > 0 ? `${comments.length} 条评论` : '评论'}
      </button>
      {show && (
        <div className="mt-3 space-y-2.5">
          {comments.length === 0 && <p className="text-xs text-gray-300 pl-6">暂无评论，说点什么吧</p>}
          {comments.map(c => (
            <div key={c.id} className="flex items-start gap-2.5 pl-6">
              <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">{c.user.username[0]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs"><span className="font-semibold text-gray-800">{c.user.username}</span> <span className="text-gray-600">{c.content}</span></p>
                <p className="text-[10px] text-gray-300 mt-0.5">{new Date(c.createdAt).toLocaleDateString('zh-CN')}</p>
              </div>
            </div>
          ))}
          <div className="flex gap-2 pl-6">
            <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="写评论..." className="flex-1 border border-gray-200 rounded-full px-3 py-1.5 text-xs outline-none focus:border-[#f97066] focus:ring-1 focus:ring-[#fde8e6] transition-colors bg-[#fef7f5]" />
            <button onClick={handleSubmit} disabled={submitting}
              className="px-3 py-1.5 bg-[#f97066] text-white text-xs rounded-full hover:bg-[#e0524a] disabled:opacity-50 transition-colors">发送</button>
          </div>
        </div>
      )}
    </div>
  );
}
