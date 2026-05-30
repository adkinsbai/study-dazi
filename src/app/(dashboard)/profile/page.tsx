'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth';
import Link from 'next/link';

type Tab = 'posts' | 'resources' | 'paths';

interface PostItem { id: string; content: string; images: string[]; markdown?: string; createdAt: string; }
interface ResourceItem { id: string; title: string; url?: string; domain: string; description?: string; notes?: string; createdAt: string; }
interface PathItem { id: string; title: string; domain: string; isTemplate: boolean; createdAt: string; }

export default function ProfilePage() {
  const user = useAuthStore(s => s.user);
  const token = useAuthStore(s => s.token);
  const setAuth = useAuthStore(s => s.setAuth);
  const [profile, setProfile] = useState<{ username: string; avatarUrl: string; bio: string } | null>(null);
  const [tab, setTab] = useState<Tab>('posts');
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [paths, setPaths] = useState<PathItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit profile
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editBio, setEditBio] = useState('');
  const [saving, setSaving] = useState(false);

  // New post
  const [newContent, setNewContent] = useState('');
  const [newImages, setNewImages] = useState<string[]>([]);
  const [newMarkdown, setNewMarkdown] = useState('');
  const [newMarkdownName, setNewMarkdownName] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const [uploading, setUploading] = useState(false);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const mdInputRef = useRef<HTMLInputElement>(null);

  // Edit item modal
  const [editingItem, setEditingItem] = useState<{ id: string; type: string; title?: string; content?: string; url?: string; domain?: string; notes?: string } | null>(null);
  const [editItemForm, setEditItemForm] = useState({ title: '', content: '', url: '', domain: '', notes: '' });

  useEffect(() => { if (token && user) loadAll(); }, [token, user]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [postRes, resRes, pathRes] = await Promise.all([
        fetch(`/api/posts?userId=${user?.id}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/resources?mine=1', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/paths', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (postRes.ok) setPosts((await postRes.json()).posts || []);
      if (resRes.ok) setResources((await resRes.json()).resources || []);
      if (pathRes.ok) setPaths((await pathRes.json()).paths || []);
    } catch { /* ignore */ } finally { setLoading(false); }

    // Load profile
    try {
      const meRes = await fetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` } });
      if (meRes.ok) { const d = await meRes.json(); setProfile({ username: d.username, avatarUrl: d.avatarUrl || '', bio: d.bio || '' }); }
    } catch { /* ignore */ }
  };

  // --- Profile edit ---
  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/users/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ username: editName, avatarUrl: editAvatar, bio: editBio }) });
      if (res.ok) { setProfile({ username: editName, avatarUrl: editAvatar, bio: editBio }); setAuth({ ...user!, username: editName, email: user!.email, emailVerified: user!.emailVerified }, token!); setShowEdit(false); }
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  // --- Post ---
  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData(); form.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
      if (res.ok) { const d = await res.json(); d.url && setNewImages(prev => [...prev, d.url]); }
    } catch { /* ignore */ } finally { setUploading(false); }
  };

  const handlePost = async () => {
    if (!newContent.trim() && !newMarkdown) return;
    setPostError(''); setPosting(true);
    try {
      const body: Record<string, unknown> = { content: newContent, images: newImages };
      if (newMarkdown) { body.markdown = newMarkdown; body.markdownHtml = newMarkdown; }
      const res = await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json().catch(()=>({}))).error || '发布失败');
      const d = await res.json();
      setPosts(prev => [d.post, ...prev]);
      setNewContent(''); setNewImages([]); setNewMarkdown(''); setNewMarkdownName('');
    } catch (err) { setPostError(err instanceof Error ? err.message : '发布失败'); }
    finally { setPosting(false); }
  };

  // --- Edit/Delete item ---
  const openEdit = (item: { id: string; type: string; title?: string; content?: string; url?: string; domain?: string; notes?: string }) => {
    setEditingItem(item);
    setEditItemForm({ title: item.title || '', content: item.content || '', url: item.url || '', domain: item.domain || '', notes: item.notes || '' });
  };

  const handleSaveItem = async () => {
    if (!editingItem) return;
    const { id, type } = editingItem;
    try {
      if (type === 'post') {
        await fetch('/api/posts', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id, content: editItemForm.content }) });
        setPosts(prev => prev.map(p => p.id === id ? { ...p, content: editItemForm.content } : p));
      } else if (type === 'resource') {
        await fetch('/api/resources', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id, title: editItemForm.title, url: editItemForm.url, domain: editItemForm.domain, notes: editItemForm.notes }) });
        setResources(prev => prev.map(r => r.id === id ? { ...r, title: editItemForm.title, url: editItemForm.url, domain: editItemForm.domain, notes: editItemForm.notes } : r));
      } else if (type === 'path') {
        await fetch(`/api/paths/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ title: editItemForm.title }) });
        setPaths(prev => prev.map(p => p.id === id ? { ...p, title: editItemForm.title } : p));
      }
      setEditingItem(null);
    } catch { /* ignore */ }
  };

  const handleDeleteItem = async () => {
    if (!editingItem || !confirm('确定删除？此操作不可撤销。')) return;
    const { id, type } = editingItem;
    try {
      if (type === 'post') { await fetch(`/api/posts?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); setPosts(prev => prev.filter(p => p.id !== id)); }
      else if (type === 'resource') { await fetch(`/api/resources?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); setResources(prev => prev.filter(r => r.id !== id)); }
      else if (type === 'path') { await fetch(`/api/paths/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); setPaths(prev => prev.filter(p => p.id !== id)); }
      setEditingItem(null);
    } catch { /* ignore */ }
  };

  if (loading && !profile) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-400">加载中...</p></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">个人主页</h1>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">返回</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Profile card */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-2xl shrink-0 overflow-hidden">
              {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" /> : profile?.username?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-gray-900">{profile?.username}</h2>
              {profile?.bio && <p className="text-sm text-gray-500 mt-1">{profile.bio}</p>}
            </div>
            <button onClick={() => { setEditName(profile?.username||''); setEditAvatar(profile?.avatarUrl||''); setEditBio(profile?.bio||''); setShowEdit(true); }}
              className="text-sm text-indigo-600 hover:text-indigo-500 shrink-0">编辑资料</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="flex border-b border-gray-100">
            {[{ id: 'posts', label: '动态' }, { id: 'resources', label: '资源' }, { id: 'paths', label: '路径' }].map(t => (
              <button key={t.id} onClick={() => setTab(t.id as Tab)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-4">
            {/* Posts tab */}
            {tab === 'posts' && (
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <textarea value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="分享你的学习心得..." rows={2}
                    className="w-full bg-white border rounded-lg px-3 py-2 text-sm resize-none" />
                  {newImages.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {newImages.map((url, i) => (
                        <div key={i} className="relative w-16 h-16 rounded overflow-hidden">
                          <img src={url} className="w-full h-full object-cover" />
                          <button onClick={() => setNewImages(prev => prev.filter((_, j) => j !== i))}
                            className="absolute top-0 right-0 bg-black/50 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {newMarkdownName && <p className="text-xs text-gray-500">📄 {newMarkdownName} <button onClick={() => { setNewMarkdown(''); setNewMarkdownName(''); }} className="text-red-400">移除</button></p>}
                  {postError && <p className="text-xs text-red-600">{postError}</p>}
                  <div className="flex items-center gap-2">
                    <input ref={imgInputRef} type="file" accept="image/*" multiple onChange={e => { const files = e.target.files; if (files) Array.from(files).slice(0, 4).forEach(f => handleFileUpload(f)); if (imgInputRef.current) imgInputRef.current.value = ''; }} className="hidden" />
                    <button onClick={() => imgInputRef.current?.click()} disabled={uploading} className="text-xs text-gray-500">🖼️ 图片</button>
                    <input ref={mdInputRef} type="file" accept=".md" onChange={async e => { const f = e.target.files?.[0]; if (!f) return; setUploading(true); const form = new FormData(); form.append('file', f); const res = await fetch('/api/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }); if (res.ok) { const d = await res.json(); if (d.content) { setNewMarkdown(d.content); setNewMarkdownName(d.name); } } setUploading(false); if (mdInputRef.current) mdInputRef.current.value = ''; }} className="hidden" />
                    <button onClick={() => mdInputRef.current?.click()} className="text-xs text-gray-500">📄 md</button>
                    <div className="flex-1" />
                    <button onClick={handlePost} disabled={(!newContent.trim() && !newMarkdown) || posting}
                      className="px-3 py-1 rounded-md bg-indigo-600 text-xs text-white">{posting ? '发布中' : '发布'}</button>
                  </div>
                </div>
                {posts.map(p => (
                  <div key={p.id} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString('zh-CN')}</span>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit({ id: p.id, type: 'post', content: p.content })}
                          className="text-xs text-gray-400 hover:text-indigo-600">✏️</button>
                        <button onClick={() => { if (confirm('删除？')) { fetch(`/api/posts?id=${p.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).then(() => setPosts(prev => prev.filter(x => x.id !== p.id))); } }}
                          className="text-xs text-gray-400 hover:text-red-500">🗑️</button>
                      </div>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{p.content}</p>
                    {p.markdown && <p className="text-xs text-gray-500 mt-1 italic">{p.markdown.substring(0, 100)}</p>}
                    {p.images?.length > 0 && <div className="mt-1 flex gap-1">{p.images.map((url, i) => <img key={i} src={url} className="w-14 h-14 object-cover rounded" />)}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* Resources tab */}
            {tab === 'resources' && (
              <div className="space-y-2">
                {resources.map(r => (
                  <div key={r.id} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        {r.url ? <a href={r.url} target="_blank" className="text-sm font-medium text-indigo-600">{r.title}</a> : <span className="text-sm font-medium">{r.title}</span>}
                        <span className="ml-2 text-xs bg-gray-100 px-1.5 py-0.5 rounded">{r.domain}</span>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => openEdit({ id: r.id, type: 'resource', title: r.title, url: r.url || '', domain: r.domain, notes: r.notes || '' })}
                          className="text-xs text-gray-400 hover:text-indigo-600">✏️</button>
                        <button onClick={() => { if (confirm('删除？')) { fetch(`/api/resources?id=${r.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).then(() => setResources(prev => prev.filter(x => x.id !== r.id))); } }}
                          className="text-xs text-gray-400 hover:text-red-500">🗑️</button>
                      </div>
                    </div>
                    {r.notes && <p className="text-xs text-gray-500 mt-1">{r.notes.substring(0, 150)}</p>}
                  </div>
                ))}
                {resources.length === 0 && <p className="text-gray-400 text-sm text-center py-4">暂无分享的资源</p>}
              </div>
            )}

            {/* Paths tab */}
            {tab === 'paths' && (
              <div className="space-y-2">
                {paths.map(p => (
                  <div key={p.id} className="border border-gray-100 rounded-lg p-3 flex items-center justify-between">
                    <Link href={`/paths/${p.id}`} className="text-sm font-medium hover:text-indigo-600">{p.title}</Link>
                    <div className="flex items-center gap-2 shrink-0">
                      {p.isTemplate && <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded">已分享</span>}
                      <button onClick={() => openEdit({ id: p.id, type: 'path', title: p.title })}
                        className="text-xs text-gray-400 hover:text-indigo-600">✏️</button>
                      <button onClick={() => { if (confirm('删除？')) { fetch(`/api/paths/${p.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).then(() => setPaths(prev => prev.filter(x => x.id !== p.id))); } }}
                        className="text-xs text-gray-400 hover:text-red-500">🗑️</button>
                    </div>
                  </div>
                ))}
                {paths.length === 0 && <p className="text-gray-400 text-sm text-center py-4">暂无学习路径</p>}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Edit profile modal */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowEdit(false)}>
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 w-full space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold">编辑资料</h3>
            <div className="flex items-center gap-2">
              <input type="text" value={editAvatar} onChange={e => setEditAvatar(e.target.value)} placeholder="头像 URL" className="flex-1 border rounded-md px-3 py-2 text-sm" />
              <label className="px-3 py-2 border rounded-md text-sm text-gray-500 hover:text-indigo-600 cursor-pointer">
                📎 本地上传
                <input type="file" accept="image/*" className="hidden" onChange={async e => {
                  const f = e.target.files?.[0]; if (!f) return;
                  const form = new FormData(); form.append('file', f);
                  const res = await fetch('/api/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
                  if (res.ok) { const d = await res.json(); if (d.url) setEditAvatar(d.url); }
                }} />
              </label>
            </div>
            <input type="text" value={editName} onChange={e => setEditName(e.target.value)} placeholder="用户名" className="w-full border rounded-md px-3 py-2 text-sm" />
            <textarea value={editBio} onChange={e => setEditBio(e.target.value)} rows={2} placeholder="简介" className="w-full border rounded-md px-3 py-2 text-sm resize-none" />
            <div className="flex gap-2">
              <button onClick={() => setShowEdit(false)} className="flex-1 py-1.5 border rounded-md text-sm">取消</button>
              <button onClick={handleSaveProfile} disabled={saving} className="flex-1 py-1.5 bg-indigo-600 text-white rounded-md text-sm">{saving ? '保存中' : '保存'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit item modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditingItem(null)}>
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 w-full space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold">编辑{editingItem.type === 'post' ? '动态' : editingItem.type === 'resource' ? '资源' : '路径'}</h3>
            {(editingItem.type === 'post') && (
              <textarea value={editItemForm.content} onChange={e => setEditItemForm(p => ({ ...p, content: e.target.value }))} rows={3}
                className="w-full border rounded-md px-3 py-2 text-sm resize-none" />
            )}
            {(editingItem.type === 'resource') && (
              <>
                <input value={editItemForm.title} onChange={e => setEditItemForm(p => ({ ...p, title: e.target.value }))} placeholder="标题" className="w-full border rounded-md px-3 py-2 text-sm" />
                <input value={editItemForm.url} onChange={e => setEditItemForm(p => ({ ...p, url: e.target.value }))} placeholder="URL" className="w-full border rounded-md px-3 py-2 text-sm" />
                <input value={editItemForm.domain} onChange={e => setEditItemForm(p => ({ ...p, domain: e.target.value }))} placeholder="板块" className="w-full border rounded-md px-3 py-2 text-sm" />
                <textarea value={editItemForm.notes} onChange={e => setEditItemForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="笔记" className="w-full border rounded-md px-3 py-2 text-sm resize-none" />
              </>
            )}
            {(editingItem.type === 'path') && (
              <input value={editItemForm.title} onChange={e => setEditItemForm(p => ({ ...p, title: e.target.value }))} placeholder="标题" className="w-full border rounded-md px-3 py-2 text-sm" />
            )}
            <div className="flex gap-2">
              <button onClick={() => setEditingItem(null)} className="flex-1 py-1.5 border rounded-md text-sm">取消</button>
              <button onClick={handleDeleteItem} className="py-1.5 px-3 border rounded-md text-sm text-red-500">删除</button>
              <button onClick={handleSaveItem} className="flex-1 py-1.5 bg-indigo-600 text-white rounded-md text-sm">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
