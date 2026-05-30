'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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

  const [showResourceForm, setShowResourceForm] = useState(false);
  const [resForm, setResForm] = useState({ title: '', url: '', domain: '', description: '', notes: '', fileUrl: '', fileName: '' });
  const [uploading, setUploading] = useState(false);
  const [resSubmitting, setResSubmitting] = useState(false);
  const [resError, setResError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadTab('posts'); loadDomains(); }, []);

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
        const params = d ? `?type=resources&domain=${d}` : '?type=resources';
        const res = await fetch(`/api/explore${params}`);
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

  const switchTab = (t: Tab) => { setTab(t); loadTab(t, domain); };

  const handleFork = async (id: string) => {
    const res = await fetch(`/api/paths/${id}/fork`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) { const d = await res.json(); router.push(`/paths/${d.id}`); }
  };

  const [uploadError, setUploadError] = useState('');

  const handleFileUpload = async (file: File) => {
    setUploadError('');
    setUploading(true);
    try {
      const form = new FormData(); form.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
      if (!res.ok) {
        const d = await res.json().catch(()=>({}));
        throw new Error(d.error || '上传失败');
      }
      const d = await res.json();
      setResForm(p => ({ ...p, fileUrl: d.url, fileName: d.name }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : '上传失败');
    } finally { setUploading(false); }
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
      if (resForm.fileUrl) { body.fileUrl = resForm.fileUrl; body.fileName = resForm.fileName; }
      console.log('[Resource] submitting body keys:', Object.keys(body), 'fileUrl length:', (body.fileUrl || '').length);
      const res = await fetch('/api/resources', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || '提交失败 (' + res.status + ')');
      setShowResourceForm(false);
      setResForm({ title: '', url: '', domain: '', description: '', notes: '', fileUrl: '', fileName: '' });
      loadTab('resources', domain);
    } catch (err) {
      setResError(err instanceof Error ? err.message : '提交失败');
      console.error('[Resource] submit error:', err);
    } finally { setResSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">广场</h1>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">返回</Link>
        </div>
      </header>

      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto flex">
          {[{ id: 'posts', label: '动态' }, { id: 'resources', label: '资源' }, { id: 'paths', label: '路径' }].map(t => (
            <button key={t.id} onClick={() => switchTab(t.id as Tab)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex flex-wrap gap-2 mb-4">
          {suggestedDomains.map(d => (
            <button key={d} onClick={() => { setDomain(domain === d ? '' : d); loadTab(tab, domain === d ? '' : d); }}
              className={`px-3 py-1 rounded-full text-xs font-medium ${domain === d ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
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
                {posts.length === 0 && <p className="text-center text-gray-400 py-12">暂无动态</p>}
                {posts.map(p => (
                  <div key={p.id} className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Link href={`/profile/${p.user.id}`} className="flex items-center gap-2 hover:underline">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs overflow-hidden">
                          {p.user.avatarUrl ? <img src={p.user.avatarUrl} className="w-full h-full object-cover" /> : p.user.username[0]}
                        </div>
                        <span className="text-sm font-medium text-gray-700">{p.user.username}</span>
                      </Link>
                      <span className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString('zh-CN')}</span>
                    </div>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{p.content}</p>
                    {p.markdown && <div className="mt-2 text-sm text-gray-700 italic border-l-2 border-gray-200 pl-3">{p.markdown.substring(0, 200)}</div>}
                    {p.images?.length > 0 && <div className="mt-2 flex gap-1 flex-wrap">{p.images.slice(0, 6).map((url, i) => <img key={i} src={url} className="w-20 h-20 object-cover rounded" />)}</div>}
                  </div>
                ))}
              </div>
            )}

            {tab === 'resources' && (
              <div className="space-y-4">
                <button onClick={() => { setShowResourceForm(!showResourceForm); setUploading(false); setUploadError(''); setResError(''); }}
                  className="text-sm text-indigo-600 hover:text-indigo-500">+ 分享资源</button>
                {showResourceForm && (
                  <div className="bg-white rounded-xl shadow-sm p-4 space-y-2">
                    {resError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{resError}</p>}
                    {uploadError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{uploadError}</p>}
                    <input value={resForm.title} onChange={e => setResForm(p => ({ ...p, title: e.target.value }))}
                      placeholder="资源名称 *" className="w-full border rounded-md px-3 py-2 text-sm" />
                    <div className="flex gap-2">
                      <input value={resForm.url} onChange={e => setResForm(p => ({ ...p, url: e.target.value }))}
                        placeholder="链接 URL（可选）" className="flex-1 border rounded-md px-3 py-2 text-sm" />
                      <input ref={fileInputRef} type="file" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} className="hidden" />
                      <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                        className="px-3 py-2 border rounded-md text-sm text-gray-500 hover:text-indigo-600 disabled:opacity-50">
                        {uploading ? '⏳ 上传中...' : resForm.fileName ? '✅ ' + resForm.fileName : '📎 上传文件'}
                      </button>
                    </div>
                    <input value={resForm.domain} onChange={e => setResForm(p => ({ ...p, domain: e.target.value }))}
                      list="domain-suggestions" placeholder="领域/板块 *（可自定义输入）"
                      className="w-full border rounded-md px-3 py-2 text-sm" />
                    <datalist id="domain-suggestions">
                      {suggestedDomains.map(d => <option key={d} value={d} />)}
                    </datalist>
                    <textarea value={resForm.notes} onChange={e => setResForm(p => ({ ...p, notes: e.target.value }))}
                      placeholder="笔记/说明（可选）" rows={3}
                      className="w-full border rounded-md px-3 py-2 text-sm resize-none" />
                    <button onClick={handleAddResource} disabled={resSubmitting}
                      className="px-4 py-1.5 rounded-md bg-indigo-600 text-sm text-white hover:bg-indigo-500 disabled:opacity-50">
                      {resSubmitting ? '提交中...' : '提交'}
                    </button>
                  </div>
                )}
                {resources.length === 0 && <p className="text-center text-gray-400 py-8">暂无资源</p>}
                {resources.map(r => (
                  <div key={r.id} className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-2">
                      {(r.url || r.fileUrl) ? (
                        <a href={r.fileUrl || r.url} target="_blank" rel="noopener" className="text-sm font-medium text-indigo-600 hover:underline">{r.title}</a>
                      ) : <span className="text-sm font-medium">{r.title}</span>}
                      {r.fileName && <span className="text-xs text-gray-400">📎 {r.fileName}</span>}
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100">{r.domain}</span>
                    </div>
                    {r.description && <p className="text-xs text-gray-500 mt-1">{r.description}</p>}
                    {r.notes && <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap border-l-2 border-amber-200 pl-3">{r.notes.substring(0, 300)}</p>}
                    <p className="text-xs text-gray-400 mt-1">{r.user.username} · {new Date(r.createdAt).toLocaleDateString('zh-CN')}</p>
                  </div>
                ))}
              </div>
            )}

            {tab === 'paths' && (
              <>
                {search && (
                  <div className="flex gap-2 mb-4">
                    <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadTab('paths', domain)}
                      placeholder="搜索路径..." className="flex-1 border rounded-lg px-3 py-2 text-sm" />
                    <button onClick={() => loadTab('paths', domain)} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg">搜索</button>
                  </div>
                )}
                {paths.length === 0 && <p className="text-center text-gray-400 py-8">暂无路径模板</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {paths.map(t => (
                    <div key={t.id} className="bg-white rounded-xl shadow-sm p-5">
                      <h3 className="font-semibold">{t.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-600">{t.domain}</span>
                        <span className="text-xs text-gray-400">Fork {t.forkCount}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500"><Link href={`/profile/${t.user.id}`}>{t.user.username}</Link></div>
                      <button onClick={() => handleFork(t.id)} className="mt-3 w-full py-1.5 rounded-md border border-indigo-300 text-sm text-indigo-600 hover:bg-indigo-50">🔀 Fork</button>
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
