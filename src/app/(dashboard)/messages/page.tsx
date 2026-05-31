'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAuthStore } from '@/stores/auth';
import { useBadgeStore } from '@/stores/badges';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Conv { user: { id: string; username: string; avatarUrl: string | null }; lastMsg: string; time: string; unread: number; }
interface Msg { id: string; content: string; createdAt: string; fromUser: { username: string }; fromUserId: string; }

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#fef7f5]"><p className="text-gray-400">加载中...</p></div>}>
      <MessagesPageInner />
    </Suspense>
  );
}

function MessagesPageInner() {
  const token = useAuthStore(s => s.token);
  const myId = useAuthStore(s => s.user?.id);
  const refreshBadges = useBadgeStore(s => s.refreshBadges);
  const params = useSearchParams();
  const [convs, setConvs] = useState<Conv[]>([]);
  const [chatUser, setChatUser] = useState<{ id: string; username: string; avatarUrl?: string | null } | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');

  useEffect(() => { if (token) loadConvs(); }, [token]);

  useEffect(() => {
    const withId = params.get('with');
    if (!withId) return;
    if (chatUser?.id === withId) return;
    const conv = convs.find(c => c.user.id === withId);
    if (conv) { openChat(conv.user); return; }
    if (convs !== undefined) {
      fetch(`/api/users/${withId}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.user) openChat({ id: d.user.id, username: d.user.username, avatarUrl: d.user.avatarUrl }); });
    }
  }, [params, convs]);

  const loadConvs = async () => {
    const res = await fetch('/api/messages', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) { const d = await res.json(); setConvs(d.conversations || []); }
  };

  const openChat = async (user: { id: string; username: string; avatarUrl?: string | null }) => {
    setChatUser(user);
    const res = await fetch(`/api/messages?with=${user.id}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) { const d = await res.json(); setMsgs(d.messages || []); }
    loadConvs();
    if (token) refreshBadges(token);
  };

  const sendMsg = async () => {
    if (!text.trim() || !chatUser) return;
    await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ toUserId: chatUser.id, content: text }) });
    setText('');
    openChat(chatUser);
  };

  return (
    <div className="min-h-screen bg-[#fef7f5] bg-stripe flex flex-col">
      <header className="bg-white/90 backdrop-blur-md border-b border-[#fde8e6] shrink-0">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="w-1 h-5 rounded-full bg-[#f97066]"></span>
            消息
          </h1>
          <Link href="/" className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">✕</Link>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full flex overflow-hidden" style={{ height: 'calc(100vh - 53px)' }}>
        {/* 左侧会话列表 */}
        <div className={`${chatUser ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 lg:w-96 border-r border-[#fde8e6] bg-white shrink-0`}>
          <div className="p-3 border-b border-gray-50">
            <p className="text-xs text-gray-400 font-medium">最近会话</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {convs.map(c => (
              <button key={c.user.id} onClick={() => openChat(c.user)}
                className={`w-full p-3 flex items-center gap-3 hover:bg-gray-50 text-left transition-colors ${chatUser?.id === c.user.id ? 'bg-[#fef4f3] border-r-2 border-[#f97066]' : 'border-r-2 border-transparent'}`}>
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-sm font-bold text-white overflow-hidden">
                    {c.user.avatarUrl ? <img src={c.user.avatarUrl} className="w-full h-full object-cover" /> : c.user.username[0]?.toUpperCase()}
                  </div>
                  {c.unread > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[#ef4444] text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5">
                      {c.unread}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{c.user.username}</span>
                    <span className="text-[10px] text-gray-400 shrink-0 ml-2">{new Date(c.time).toLocaleDateString('zh-CN')}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{c.lastMsg}</p>
                </div>
              </button>
            ))}
            {convs.length === 0 && (
              <div className="p-8 text-center">
                <p className="text-3xl mb-2">💬</p>
                <p className="text-gray-400 text-sm">暂无会话</p>
                <p className="text-gray-300 text-xs mt-1">从好友列表或主页搭子空间发起私信</p>
              </div>
            )}
          </div>
        </div>

        {/* 右侧聊天区 */}
        <div className={`${chatUser ? 'flex' : 'hidden md:flex'} flex-col flex-1 bg-[#fef7f5]`}>
          {chatUser ? (
            <>
              {/* 聊天头部 */}
              <div className="bg-white/90 backdrop-blur-md border-b border-[#fde8e6] px-4 py-3 flex items-center gap-3 shrink-0">
                <button onClick={() => setChatUser(null)} className="md:hidden p-1 rounded-full text-gray-400 hover:bg-gray-100 transition-colors">←</button>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-sm font-bold text-white shrink-0 overflow-hidden">
                  {chatUser.avatarUrl ? <img src={chatUser.avatarUrl} className="w-full h-full object-cover" /> : chatUser.username[0]?.toUpperCase()}
                </div>
                <span className="text-sm font-semibold text-gray-900">{chatUser.username}</span>
              </div>

              {/* 消息列表 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {msgs.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-3xl mb-2">👋</p>
                    <p className="text-gray-400 text-sm">暂无消息，发送第一条打个招呼吧</p>
                  </div>
                )}
                {msgs.map(m => {
                  const isMine = m.fromUserId === myId;
                  return (
                    <div key={m.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                      {!isMine && (
                        <span className="text-[10px] text-gray-400 mb-1 ml-1">{m.fromUser.username}</span>
                      )}
                      <div className={`max-w-[75%] px-4 py-2.5 text-sm leading-relaxed ${isMine
                        ? 'bg-gradient-to-br from-[#f97066] to-[#e0524a] text-white rounded-2xl rounded-br-md shadow-sm'
                        : 'bg-white text-gray-800 rounded-2xl rounded-bl-md border border-gray-100 shadow-sm'}`}>
                        {m.content}
                      </div>
                      <span className="text-[10px] text-gray-300 mt-1 mx-1">
                        {new Date(m.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* 输入区 */}
              <div className="bg-white/90 backdrop-blur-md border-t border-[#fde8e6] p-3 flex gap-2 shrink-0">
                <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMsg()}
                  placeholder="输入消息..." className="flex-1 border border-gray-200 rounded-full px-4 py-2.5 text-sm outline-none focus:border-[#f97066] focus:ring-1 focus:ring-[#fde8e6] transition-colors bg-[#fef7f5]" />
                <button onClick={sendMsg} className="px-5 py-2.5 bg-gradient-to-br from-[#f97066] to-[#e0524a] text-white text-sm rounded-full hover:shadow-md transition-all">发送</button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-5xl mb-4">💬</p>
                <p className="text-gray-400 text-sm">选择一个会话开始聊天</p>
                <p className="text-gray-300 text-xs mt-1">或从好友页面发起新对话</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
