'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth';
import Link from 'next/link';

interface PostData {
  id: string; content: string; images: string[]; markdown?: string; markdownHtml?: string; createdAt: string;
  user: { username: string; avatarUrl: string | null };
}

function RichContent({ text }: { text: string }) {
  // 先处理 [text](url)，再处理裸 URL
  const linked = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '%%LINK%%$1%%URL%%$2%%END%%');
  const parts = linked.split(/%%(LINK|URL|END)%%/);
  const result: React.ReactNode[] = [];
  let i = 0;
  while (i < parts.length) {
    if (parts[i] === 'LINK' && parts[i+2] === 'END') {
      result.push(<a key={i} href={parts[i+1]} target="_blank" rel="noopener" className="text-indigo-600 underline hover:text-indigo-500">{parts[i-1]}</a>);
      i += 3;
    } else {
      // Auto-detect raw URLs in text
      const text2 = parts[i] || '';
      const urlRegex = /(https?:\/\/[^\s<>"]+)/g;
      const subParts = text2.split(urlRegex);
      const matches = text2.match(urlRegex) || [];
      subParts.forEach((sp, j) => {
        if (sp) result.push(<span key={`${i}-${j}`}>{sp}</span>);
        if (matches[j]) result.push(<a key={`${i}-link-${j}`} href={matches[j]} target="_blank" rel="noopener" className="text-indigo-600 underline hover:text-indigo-500">{matches[j]}</a>);
      });
      i++;
    }
  }
  return <span>{result}</span>;
}

// 简易 Markdown 渲染
function MarkdownView({ text }: { text: string }) {
  const html = text
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mt-4 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-4 mb-2">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-gray-100 px-1 rounded text-sm">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-indigo-600 underline hover:text-indigo-500">$1</a>')
    .replace(/\n\n/g, '</p><p class="mt-2">')
    .replace(/\n/g, '<br/>');
  return <div className="text-sm text-gray-800" dangerouslySetInnerHTML={{ __html: `<p>${html}</p>` }} />;
}

export default function ProfilePage() {
  const user = useAuthStore(s => s.user);
  const token = useAuthStore(s => s.token);
  const setAuth = useAuthStore(s => s.setAuth);
  const [profile, setProfile] = useState<{ username: string; avatarUrl: string; bio: string } | null>(null);
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editBio, setEditBio] = useState('');
  const [saving, setSaving] = useState(false);

  // Post composer
  const [newContent, setNewContent] = useState('');
  const [newImages, setNewImages] = useState<string[]>([]);
  const [newMarkdown, setNewMarkdown] = useState('');
  const [newMarkdownName, setNewMarkdownName] = useState('');
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const mdInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (token) loadProfile(); }, [token]);

  const loadProfile = async () => {
    try {
      const [meRes, postRes] = await Promise.all([
        fetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/posts?userId=${user?.id}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (meRes.ok) { const d = await meRes.json(); setProfile({ username: d.username, avatarUrl: d.avatarUrl || '', bio: d.bio || '' }); }
      if (postRes.ok) { const d = await postRes.json(); setPosts(d.posts || []); }
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form,
      });
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; } finally { setUploading(false); }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files).slice(0, 9 - newImages.length)) {
      const result = await handleFileUpload(file);
      if (result?.url) setNewImages(prev => [...prev, result.url]);
    }
    if (imgInputRef.current) imgInputRef.current.value = '';
  };

  const handleMdSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await handleFileUpload(file);
    if (result?.content) {
      setNewMarkdown(result.content);
      setNewMarkdownName(result.name);
    }
    if (mdInputRef.current) mdInputRef.current.value = '';
  };

  const [postError, setPostError] = useState('');

  const handlePost = async () => {
    if (!newContent.trim() && !newMarkdown) return;
    setPostError('');
    setPosting(true);
    try {
      const body: Record<string, unknown> = { content: newContent, images: newImages };
      if (newMarkdown) { body.markdown = newMarkdown; body.markdownHtml = newMarkdown; }
      const res = await fetch('/api/posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `发布失败 (${res.status})`);
      }
      const d = await res.json();
      setPosts(prev => [d.post, ...prev]);
      setNewContent(''); setNewImages([]); setNewMarkdown(''); setNewMarkdownName('');
    } catch (err) {
      setPostError(err instanceof Error ? err.message : '发布失败');
    } finally { setPosting(false); }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('删除这条动态？')) return;
    try {
      await fetch(`/api/posts?id=${postId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch { /* ignore */ }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-400">加载中...</p></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">个人主页</h1>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">返回</Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
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

        {/* Post composer */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          {postError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{postError}</p>}
          <textarea value={newContent} onChange={e => setNewContent(e.target.value)}
            placeholder="分享你的学习心得...&#10;支持链接：[文本](https://...)" rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-indigo-400" />

          {/* Image previews */}
          {newImages.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {newImages.map((url, i) => (
                <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => setNewImages(prev => prev.filter((_, j) => j !== i))}
                    className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Markdown file indicator */}
          {newMarkdownName && (
            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded px-3 py-1.5">
              📄 {newMarkdownName}
              <button onClick={() => { setNewMarkdown(''); setNewMarkdownName(''); }} className="text-red-400 hover:text-red-600 text-xs">移除</button>
            </div>
          )}

          {uploading && <p className="text-xs text-gray-400">上传中...</p>}

          <div className="flex items-center gap-2">
            <input ref={imgInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect}
              className="hidden" />
            <button onClick={() => imgInputRef.current?.click()}
              className="text-xs text-gray-500 hover:text-indigo-600 flex items-center gap-1">
              🖼️ 图片
            </button>
            <input ref={mdInputRef} type="file" accept=".md,.markdown" onChange={handleMdSelect}
              className="hidden" />
            <button onClick={() => mdInputRef.current?.click()}
              className="text-xs text-gray-500 hover:text-indigo-600 flex items-center gap-1">
              📄 Markdown
            </button>
            <div className="flex-1" />
            <button onClick={handlePost} disabled={(!newContent.trim() && !newMarkdown) || posting}
              className="px-4 py-1.5 rounded-md bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
              {posting ? '发布中...' : '发布'}
            </button>
          </div>
        </div>

        {/* Posts */}
        <div className="space-y-4">
          {posts.length === 0 && <p className="text-center text-gray-400 text-sm py-8">还没有动态，发布第一条吧</p>}
          {posts.map(post => (
            <div key={post.id} className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs shrink-0 overflow-hidden">
                  {post.user.avatarUrl ? <img src={post.user.avatarUrl} alt="" className="w-full h-full object-cover" /> : post.user.username?.[0]?.toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-700">{post.user.username}</span>
                <span className="text-xs text-gray-400">{new Date(post.createdAt).toLocaleDateString('zh-CN')}</span>
                <div className="flex-1" />
                {post.user.username === profile?.username && (
                  <button onClick={() => handleDeletePost(post.id)} className="text-xs text-gray-300 hover:text-red-500">🗑️</button>
                )}
              </div>
              {post.content && <p className="text-sm text-gray-800 whitespace-pre-wrap break-words"><RichContent text={post.content} /></p>}
              {post.markdown && <MarkdownView text={post.markdown} />}
              {post.images?.length > 0 && (
                <div className={`mt-3 grid gap-2 ${post.images.length === 1 ? 'grid-cols-1' : post.images.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                  {post.images.map((url, i) => (
                    <img key={i} src={url} alt="" className="rounded-lg w-full object-cover max-h-48" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>

      {/* Edit modal */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowEdit(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4 w-full space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900">编辑资料</h3>
            <div><label className="block text-sm font-medium text-gray-700">头像</label>
              <div className="flex items-center gap-3 mt-1">
                <input type="file" accept="image/*" onChange={async e => {
                  const f = e.target.files?.[0]; if (!f) return;
                  const form = new FormData(); form.append('file', f);
                  const res = await fetch('/api/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
                  if (res.ok) { const d = await res.json(); if (d.url) setEditAvatar(d.url); }
                }} className="text-xs" />
              </div>
              <input type="text" value={editAvatar} onChange={e => setEditAvatar(e.target.value)} placeholder="或粘贴 URL" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500" /></div>
            <div><label className="block text-sm font-medium text-gray-700">用户名</label>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500" /></div>
            <div><label className="block text-sm font-medium text-gray-700">简介</label>
              <textarea value={editBio} onChange={e => setEditBio(e.target.value)} rows={2} maxLength={200} placeholder="介绍一下自己..." className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm resize-none outline-none focus:border-indigo-500" /></div>
            <div className="flex gap-3">
              <button onClick={() => setShowEdit(false)} className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">取消</button>
              <button onClick={async () => {
                setSaving(true);
                try {
                  const res = await fetch('/api/users/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ username: editName, avatarUrl: editAvatar, bio: editBio }) });
                  if (res.ok) { setProfile({ username: editName, avatarUrl: editAvatar, bio: editBio }); setAuth({ ...user!, username: editName, email: user!.email, emailVerified: user!.emailVerified }, token!); setShowEdit(false); }
                } catch { /* ignore */ } finally { setSaving(false); }
              }} disabled={saving} className="flex-1 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">{saving ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
