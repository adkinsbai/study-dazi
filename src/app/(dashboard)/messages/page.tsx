'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAuthStore } from '@/stores/auth';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Conv { user: { id: string; username: string; avatarUrl: string | null }; lastMsg: string; time: string; unread: number; }
interface Msg { id: string; content: string; createdAt: string; fromUser: { username: string }; fromUserId: string; }

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-400">加载中...</p></div>}>
      <MessagesPageInner />
    </Suspense>
  );
}

function MessagesPageInner() {
  const token = useAuthStore(s => s.token);
  const myId = useAuthStore(s => s.user?.id);
  const params = useSearchParams();
  const [convs, setConvs] = useState<Conv[]>([]);
  const [chatUser, setChatUser] = useState<{ id: string; username: string } | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');

  useEffect(() => { if (token) loadConvs(); }, [token]);

  // Auto-open chat from URL ?with=userId (even for new conversations)
  useEffect(() => {
    const withId = params.get('with');
    if (!withId) return;
    // Already in a chat with this user
    if (chatUser?.id === withId) return;
    // Found in existing conversations
    const conv = convs.find(c => c.user.id === withId);
    if (conv) { openChat(conv.user); return; }
    // New conversation — fetch user info then open
    if (convs !== undefined) { // convs loaded (could be empty)
      fetch(`/api/users/${withId}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.user) openChat({ id: d.user.id, username: d.user.username }); });
    }
  }, [params, convs]);

  const loadConvs = async () => {
    const res = await fetch('/api/messages', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) { const d = await res.json(); setConvs(d.conversations || []); }
  };

  const openChat = async (user: { id: string; username: string }) => {
    setChatUser(user);
    const res = await fetch(`/api/messages?with=${user.id}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) { const d = await res.json(); setMsgs(d.messages || []); }
    loadConvs(); // refresh unread counts
  };

  const sendMsg = async () => {
    if (!text.trim() || !chatUser) return;
    await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ toUserId: chatUser.id, content: text }) });
    setText('');
    openChat(chatUser); // refresh
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold">{chatUser ? chatUser.username : '消息'}</h1>
          <div className="flex gap-3">
            {chatUser && <button onClick={() => setChatUser(null)} className="text-sm text-gray-500">← 返回</button>}
            <Link href="/" className="text-sm text-gray-500">首页</Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {!chatUser ? (
          <div className="space-y-2">
            {convs.map(c => (
              <button key={c.user.id} onClick={() => openChat(c.user)}
                className="w-full bg-white rounded-lg p-3 flex items-center gap-3 hover:bg-gray-50 text-left">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                  {c.user.username[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{c.user.username}</span>
                    <span className="text-xs text-gray-400">{new Date(c.time).toLocaleDateString('zh-CN')}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{c.lastMsg}</p>
                </div>
                {c.unread > 0 && <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{c.unread}</span>}
              </button>
            ))}
            {convs.length === 0 && <p className="text-center text-gray-400 py-8">暂无消息</p>}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm h-[70vh] flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {msgs.map(m => (
                <div key={m.id} className={`flex ${m.fromUserId === myId ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] px-3 py-2 rounded-lg text-sm ${m.fromUserId === myId ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                    {m.content}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t p-3 flex gap-2">
              <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMsg()}
                placeholder="输入消息..." className="flex-1 border rounded-lg px-3 py-2 text-sm" />
              <button onClick={sendMsg} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg">发送</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
