'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';
import Link from 'next/link';

interface PostData {
  id: string; content: string; images: string[]; createdAt: string;
  user: { username: string; avatarUrl: string | null };
}

function RichContent({ text }: { text: string }) {
  const parts = text.split(/(\[.*?\]\(.*?\))/g);
  return <span>{parts.map((part, i) => {
    const m = part.match(/^\[(.*?)\]\((.*?)\)$/);
    return m ? <a key={i} href={m[2]} target="_blank" rel="noopener" className="text-indigo-600 underline hover:text-indigo-500">{m[1]}</a> : <span key={i}>{part}</span>;
  })}</span>;
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
  const [newContent, setNewContent] = useState('');
  const [newImages, setNewImages] = useState('');
  const [posting, setPosting] = useState(false);

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

  const openEdit = () => {
    if (!profile) return;
    setEditName(profile.username); setEditAvatar(profile.avatarUrl); setEditBio(profile.bio);
    setShowEdit(true);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: editName, avatarUrl: editAvatar, bio: editBio }),
      });
      if (res.ok) {
        setProfile({ username: editName, avatarUrl: editAvatar, bio: editBio });
        setAuth({ ...user!, username: editName, email: user!.email, emailVerified: user!.emailVerified }, token!);
        setShowEdit(false);
      }
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  const handlePost = async () => {
    if (!newContent.trim()) return;
    setPosting(true);
    try {
      const images = newImages.split('\n').map(s => s.trim()).filter(Boolean);
      const res = await fetch('/api/posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: newContent, images }),
      });
      if (res.ok) { const d = await res.json(); setPosts(prev => [d.post, ...prev]); setNewContent(''); setNewImages(''); }
    } catch { /* ignore */ } finally { setPosting(false); }
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
            <button onClick={openEdit} className="text-sm text-indigo-600 hover:text-indigo-500 shrink-0">编辑资料</button>
          </div>
        </div>

        {/* Post composer */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <textarea value={newContent} onChange={e => setNewContent(e.target.value)}
            placeholder="分享你的学习心得...&#10;支持链接：[文本](https://...)" rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-indigo-400" />
          <input type="text" value={newImages} onChange={e => setNewImages(e.target.value)}
            placeholder="图片 URL（每行一个，最多4张）"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-400" />
          <div className="flex justify-end">
            <button onClick={handlePost} disabled={!newContent.trim() || posting}
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
              <p className="text-sm text-gray-800 whitespace-pre-wrap break-words"><RichContent text={post.content} /></p>
              {post.images?.length > 0 && (
                <div className={`mt-3 grid gap-2 ${post.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {post.images.map((url, i) => (
                    <img key={i} src={url} alt="" className="rounded-lg w-full object-cover max-h-64" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
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
            <div><label className="block text-sm font-medium text-gray-700">头像 URL</label>
              <input type="text" value={editAvatar} onChange={e => setEditAvatar(e.target.value)} placeholder="https://..." className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500" /></div>
            <div><label className="block text-sm font-medium text-gray-700">用户名</label>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500" /></div>
            <div><label className="block text-sm font-medium text-gray-700">简介</label>
              <textarea value={editBio} onChange={e => setEditBio(e.target.value)} rows={2} maxLength={200} placeholder="介绍一下自己..." className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm resize-none outline-none focus:border-indigo-500" /></div>
            <div className="flex gap-3">
              <button onClick={() => setShowEdit(false)} className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">取消</button>
              <button onClick={handleSaveProfile} disabled={saving} className="flex-1 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">{saving ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
