'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { Users, MessageCircle, Check } from 'lucide-react';
import Link from 'next/link';

interface UserInfo { id: string; username: string; avatarUrl: string | null; bio: string | null; }
interface PostData { id: string; content: string; images: string[]; markdown?: string; createdAt: string; user: UserInfo; }
interface PathItem { id: string; title: string; domain: string; createdAt: string; }

function MarkdownView({ text }: { text: string }) {
  const html = text
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mt-4 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-4 mb-2">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-gray-100 px-1 rounded text-sm">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\n\n/g, '</p><p class="mt-2">').replace(/\n/g, '<br/>');
  return <div className="text-sm text-gray-800" dangerouslySetInnerHTML={{ __html: `<p>${html}</p>` }} />;
}

export default function FriendProfilePage() {
  const { id } = useParams<{ id: string }>();
  const token = useAuthStore(s => s.token);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [posts, setPosts] = useState<PostData[]>([]);
  const [paths, setPaths] = useState<PathItem[]>([]);
  const [resources, setResources] = useState<{ id: string; title: string; url?: string; domain: string; notes?: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Buddy invite modal state
  const [showBuddy, setShowBuddy] = useState(false);
  const [buddyDomain, setBuddyDomain] = useState('');
  const [buddyPathId, setBuddyPathId] = useState('');
  const [buddyPaths, setBuddyPaths] = useState<{ id: string; title: string }[]>([]);
  const [buddySending, setBuddySending] = useState(false);
  const [buddyError, setBuddyError] = useState('');
  const [buddySuccess, setBuddySuccess] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`/api/users/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setUser(d.user); setPosts(d.posts || []); setPaths(d.paths || []); setResources(d.resources || []); }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [id, token]);

  useEffect(() => { if (token && id) loadData(); }, [id, loadData, token]);

  const openBuddy = async () => {
    setShowBuddy(true); setBuddyError(''); setBuddySuccess(false);
    try {
      const res = await fetch('/api/paths', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setBuddyPaths(d.paths || []); }
    } catch { /* ignore */ }
  };

  const handleBuddyInvite = async () => {
    if (!buddyDomain.trim()) { setBuddyError('请填写学习领域'); return; }
    setBuddyError('');
    setBuddySending(true);
    try {
      const body: Record<string, string> = { toUserId: id as string, domain: buddyDomain.trim() };
      if (buddyPathId) body.sharedPathId = buddyPathId;
      const res = await fetch('/api/buddies', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      if (res.ok) {
        setBuddySuccess(true);
        setTimeout(() => { setShowBuddy(false); setBuddyDomain(''); setBuddyPathId(''); setBuddySuccess(false); }, 800);
      } else {
        const d = await res.json();
        setBuddyError(d.error || '邀请失败');
      }
    } catch { setBuddyError('网络错误'); } finally { setBuddySending(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-400">加载中...</p></div>;
  if (!user) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-400">用户不存在</p></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">{user.username} 的主页</h1>
          <Link href="/friends" className="text-sm text-gray-500 hover:text-gray-700">返回</Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#fde8e6] flex items-center justify-center text-xl shrink-0 overflow-hidden">
              {user.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover" alt="" /> : user.username[0]?.toUpperCase()}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold">{user.username}</h2>
              {user.bio && <p className="text-sm text-gray-500 mt-0.5">{user.bio}</p>}
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={openBuddy} className="text-xs px-2 py-1 rounded-md bg-purple-50 text-purple-600 hover:bg-purple-100"><Users size={12} className="inline mr-1" />邀请搭子</button>
              <Link href={`/messages?with=${user.id}`} className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-[#fef4f3] hover:text-[#f97066]"><MessageCircle size={12} className="inline mr-1" />私信</Link>
            </div>
          </div>
        </div>

        {/* Buddy invite modal */}
        {showBuddy && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowBuddy(false)}>
            <div className="bg-white rounded-2xl p-5 max-w-xs mx-4 w-full space-y-3" onClick={e => e.stopPropagation()}>
              <h3 className="font-semibold text-sm">邀请 {user.username} 成为搭子</h3>
              {buddyError && <p className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{buddyError}</p>}
              {buddySuccess && <p className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded"><Check size={12} className="inline mr-1" />邀请已发送</p>}
              <input value={buddyDomain} onChange={e => setBuddyDomain(e.target.value)} placeholder="学习领域 *" className="w-full border rounded-md px-3 py-2 text-sm" />
              <select value={buddyPathId} onChange={e => setBuddyPathId(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm">
                <option value="">选择共享路径（可选）</option>
                {buddyPaths.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
              <div className="flex gap-2">
                <button onClick={() => setShowBuddy(false)} className="flex-1 py-1.5 border rounded-md text-sm">取消</button>
                <button onClick={handleBuddyInvite} disabled={buddySending} className="flex-1 py-1.5 bg-purple-600 text-white rounded-md text-sm disabled:opacity-50">{buddySending ? '发送中' : '邀请'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Learning paths */}
        {paths.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">学习路径 ({paths.length})</h3>
            <div className="space-y-1">
              {paths.map(p => (
                <Link key={p.id} href={`/paths/${p.id}`}
                  className="flex items-center justify-between py-2 px-2 rounded hover:bg-gray-50">
                  <span className="text-sm font-medium">{p.title}</span>
                  <span className="text-xs text-gray-400">{p.domain}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Resources */}
        {resources.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">分享的资源 ({resources.length})</h3>
            <div className="space-y-2">
              {resources.map(r => (
                <div key={r.id} className="py-1">
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noopener" className="text-sm font-medium text-[#f97066] hover:underline">{r.title}</a>
                  ) : <span className="text-sm font-medium">{r.title}</span>}
                  <span className="ml-2 text-xs bg-gray-100 px-1.5 py-0.5 rounded">{r.domain}</span>
                  {r.notes && <p className="text-xs text-gray-500 mt-0.5">{r.notes.substring(0, 100)}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Posts */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">动态</h3>
          {posts.length === 0 && <p className="text-center text-gray-400 text-sm py-4">暂无动态</p>}
          {posts.map(post => (
            <div key={post.id} className="bg-white rounded-2xl shadow-sm p-4">
              <span className="text-xs text-gray-400">{new Date(post.createdAt).toLocaleDateString('zh-CN')}</span>
              {post.content && <p className="text-sm text-gray-800 mt-2 whitespace-pre-wrap break-words">{post.content}</p>}
              {post.markdown && <div className="mt-2"><MarkdownView text={post.markdown} /></div>}
              {post.images?.length > 0 && (
                <div className={`mt-2 grid gap-2 ${post.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {post.images.map((url, i) => (
                    <img key={i} src={url} className="rounded-lg w-full object-cover max-h-48" alt="动态图片" />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
