'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';
import Link from 'next/link';

interface UserInfo { id: string; username: string; avatarUrl: string | null; }
interface FriendRequest { id: string; fromUser: UserInfo; createdAt: string; }

export default function FriendsPage() {
  const token = useAuthStore(s => s.token);
  const [friends, setFriends] = useState<UserInfo[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<UserInfo[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => { if (token) loadData(); }, [token]);

  const loadData = async () => {
    try {
      const res = await fetch('/api/friends', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setFriends(d.friends || []); setRequests(d.requests || []); }
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const handleSearch = async () => {
    if (searchQ.length < 2) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQ)}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setSearchResults(d.users || []); }
    } catch { /* ignore */ } finally { setSearching(false); }
  };

  const handleAdd = async (userId: string) => {
    try {
      const res = await fetch('/api/friends', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ toUserId: userId }),
      });
      if (res.ok) { setSearchResults(prev => prev.filter(u => u.id !== userId)); alert('申请已发送'); }
      else { const d = await res.json(); alert(d.error || '失败'); }
    } catch { /* ignore */ }
  };

  const handleAccept = async (reqId: string) => {
    try {
      const res = await fetch(`/api/friends/${reqId}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) loadData();
    } catch { /* ignore */ }
  };

  const handleRemove = async (reqId: string) => {
    if (!confirm('确定删除？')) return;
    try {
      await fetch(`/api/friends/${reqId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      loadData();
    } catch { /* ignore */ }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-400">加载中...</p></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">好友</h1>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">返回</Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Search */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex gap-2">
            <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="搜索用户名（至少2个字符）"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400" />
            <button onClick={handleSearch} disabled={searching}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-sm text-white hover:bg-indigo-500 disabled:opacity-50">
              {searching ? '...' : '搜索'}
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-3 space-y-1">
              {searchResults.map(u => (
                <div key={u.id} className="flex items-center gap-3 py-2 px-2 rounded hover:bg-gray-50">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm shrink-0 overflow-hidden">
                    {u.avatarUrl ? <img src={u.avatarUrl} className="w-full h-full object-cover" /> : u.username[0]?.toUpperCase()}
                  </div>
                  <span className="text-sm font-medium flex-1">{u.username}</span>
                  <button onClick={() => handleAdd(u.id)}
                    className="text-xs text-indigo-600 hover:text-indigo-500">+ 添加</button>
                  <Link href={`/messages?with=${u.id}`} className="text-xs px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600">💬 私信</Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending requests */}
        {requests.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">好友申请 ({requests.length})</h3>
            <div className="space-y-2">
              {requests.map(r => (
                <div key={r.id} className="flex items-center gap-3 py-2">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-sm shrink-0 overflow-hidden">
                    {r.fromUser.avatarUrl ? <img src={r.fromUser.avatarUrl} className="w-full h-full object-cover" /> : r.fromUser.username[0]?.toUpperCase()}
                  </div>
                  <span className="text-sm flex-1">{r.fromUser.username}</span>
                  <button onClick={() => handleAccept(r.id)} className="text-xs px-2 py-1 rounded bg-emerald-500 text-white hover:bg-emerald-600">接受</button>
                  <button onClick={() => handleRemove(r.id)} className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-600 hover:bg-gray-300">拒绝</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Buddies */}
        <BuddySection />

        {/* Friend list */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">我的好友 ({friends.length})</h3>
          {friends.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">还没有好友，搜索并添加吧</p>
          ) : (
            <div className="space-y-1">
              {friends.map(f => (
                <div key={f.id} className="flex items-center gap-2 py-2 px-2 rounded hover:bg-gray-50">
                  <Link href={`/profile/${f.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm shrink-0 overflow-hidden">
                      {f.avatarUrl ? <img src={f.avatarUrl} className="w-full h-full object-cover" /> : f.username[0]?.toUpperCase()}
                    </div>
                    <span className="text-sm font-medium">{f.username}</span>
                  </Link>
                  <BuddyInviteBtn friendId={f.id} />
                  <Link href={`/messages?with=${f.id}`} className="text-xs px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600">💬 私信</Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ─── Buddy invite button on each friend ──────────
function BuddyInviteBtn({ friendId }: { friendId: string }) {
  const token = useAuthStore(s => s.token);
  const [show, setShow] = useState(false);
  const [domain, setDomain] = useState('');
  const [pathId, setPathId] = useState('');
  const [paths, setPaths] = useState<{ id: string; title: string }[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const open = async () => {
    setShow(true); setError(''); setSuccess(false);
    try {
      const res = await fetch('/api/paths', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setPaths(d.paths || []); }
    } catch { /* ignore */ }
  };

  const handleInvite = async () => {
    if (!domain.trim()) { setError('请填写学习领域'); return; }
    setError('');
    setSending(true);
    try {
      const body: Record<string, string> = { toUserId: friendId, domain: domain.trim() };
      if (pathId) body.sharedPathId = pathId;
      const res = await fetch('/api/buddies', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => { setShow(false); setDomain(''); setPathId(''); setSuccess(false); }, 800);
      } else {
        const d = await res.json();
        setError(d.error || '邀请失败');
      }
    } catch { setError('网络错误'); } finally { setSending(false); }
  };

  return (
    <>
      <button onClick={open} className="text-xs text-purple-500 hover:text-purple-700">🤝 搭子</button>
      {show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShow(false)}>
          <div className="bg-white rounded-xl p-5 max-w-xs mx-4 w-full space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-sm">邀请成为搭子</h3>
            {error && <p className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{error}</p>}
            {success && <p className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded">✅ 邀请已发送</p>}
            <input value={domain} onChange={e => setDomain(e.target.value)} placeholder="学习领域 *" className="w-full border rounded-md px-3 py-2 text-sm" />
            <select value={pathId} onChange={e => setPathId(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm">
              <option value="">选择共享路径（可选）</option>
              {paths.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={() => setShow(false)} className="flex-1 py-1.5 border rounded-md text-sm">取消</button>
              <button onClick={handleInvite} disabled={sending} className="flex-1 py-1.5 bg-purple-600 text-white rounded-md text-sm disabled:opacity-50">{sending ? '发送中' : '邀请'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Buddy section ─────────────────────────────────
function BuddySection() {
  const token = useAuthStore(s => s.token);
  const [buddies, setBuddies] = useState<{ id: string; domain: string; buddy: { id: string; username: string } }[]>([]);
  const [buddyRequests, setBuddyRequests] = useState<{ id: string; fromUser: { username: string }; domain: string }[]>([]);

  useEffect(() => { if (token) loadBuddies(); }, [token]);

  const loadBuddies = async () => {
    try {
      const res = await fetch('/api/buddies', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setBuddies(d.buddies || []); setBuddyRequests(d.requests || []); }
    } catch { /* ignore */ }
  };

  const handleBuddyAction = async (id: string, action: string) => {
    await fetch('/api/buddies', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id, action }) });
    loadBuddies();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">搭子 ({buddies.length})</h3>

      {buddies.map(b => (
        <div key={b.id} className="flex items-center gap-2 text-sm">
          <span>🤝 {b.buddy.username}</span>
          <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">{b.domain}</span>
        </div>
      ))}

      {buddyRequests.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-gray-500">搭子申请</p>
          {buddyRequests.map(r => (
            <div key={r.id} className="flex items-center gap-2 text-sm">
              <span>{r.fromUser.username} · {r.domain}</span>
              <button onClick={() => handleBuddyAction(r.id, 'accept')} className="text-xs text-emerald-600">接受</button>
              <button onClick={() => handleBuddyAction(r.id, 'reject')} className="text-xs text-red-400">拒绝</button>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
