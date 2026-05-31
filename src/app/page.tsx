'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckInWidget } from '@/components/checkin/checkin-widget';
import { BookOpen, Users, Handshake, MessageCircle, Bell, Settings, LogOut, Sparkles, Search, Trash2, Key, Rocket, Flame, ChevronRight } from 'lucide-react';

interface PathItem {
  id: string;
  title: string;
  domain: string;
  isPublic: boolean;
  createdAt: string;
}

export default function Home() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [paths, setPaths] = useState<PathItem[]>([]);
  const [pathsLoading, setPathsLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [friendCount, setFriendCount] = useState(0);
  const [buddyCount, setBuddyCount] = useState(0);
  const [buddies, setBuddies] = useState<{ id: string; domain: string; buddy: { id: string; username: string; avatarUrl?: string | null }; sharedPathId?: string | null; sharedPathTitle?: string | null }[]>([]);
  const [notifCount, setNotifCount] = useState(0);
  const [msgCount, setMsgCount] = useState(0);

  useEffect(() => {
    if (user) {
      checkApiKey();
      loadPaths();
      loadPendingCount();
      loadBuddyCount();
      loadNotifCount();
      loadMsgCount();
    }
  }, [user]);

  const loadNotifCount = async () => {
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setNotifCount(d.unreadCount || 0); }
    } catch { /* ignore */ }
  };

  const loadMsgCount = async () => {
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch('/api/messages', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setMsgCount(d.unreadCount || 0); }
    } catch { /* ignore */ }
  };

  const loadPendingCount = async () => {
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch('/api/friends', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setPendingCount(d.requests?.length || 0); setFriendCount(d.friends?.length || 0); }
    } catch { /* ignore */ }
  };

  const loadBuddyCount = async () => {
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch('/api/buddies', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setBuddyCount((d.buddies || []).length); setBuddies(d.buddies || []); }
    } catch { /* ignore */ }
  };

  const checkApiKey = async () => {
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        if (!data.deepseekApiKey) setShowKeyModal(true);
      }
    } catch { /* ignore */ }
  };

  const loadPaths = async () => {
    setPathsLoading(true);
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch('/api/paths', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const data = await res.json(); setPaths(data.paths || []); }
    } catch { /* ignore */ }
    finally { setPathsLoading(false); }
  };

  const handleDeletePath = async (e: React.MouseEvent, pathId: string, title: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`确定删除「${title}」吗？此操作不可撤销。`)) return;
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch(`/api/paths/${pathId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setPaths((prev) => prev.filter((p) => p.id !== pathId));
    } catch { /* ignore */ }
  };

  return (
    <div className="min-h-screen bg-[#fef7f5] bg-stripe relative overflow-hidden page-enter">
      {/* 装饰泡泡 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-[8%] left-[3%] w-52 h-52 rounded-full bg-[#f97066]/[0.08] blur-2xl"></div>
        <div className="absolute top-[30%] right-[5%] w-36 h-36 rounded-full bg-[#8b5cf6]/[0.07] blur-2xl"></div>
        <div className="absolute bottom-[20%] left-[15%] w-64 h-64 rounded-full bg-[#f97066]/[0.05] blur-3xl"></div>
        <div className="absolute top-[55%] right-[20%] w-28 h-28 rounded-full bg-[#6366f1]/[0.06] blur-xl"></div>
        <div className="absolute bottom-[10%] right-[35%] w-44 h-44 rounded-full bg-[#f97066]/[0.04] blur-2xl"></div>
        <div className="absolute top-[75%] left-[40%] w-20 h-20 rounded-full bg-[#8b5cf6]/[0.06] blur-xl"></div>
      </div>

      {/* 顶部导航 */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="w-8 h-8 rounded-xl bg-[#f97066] flex items-center justify-center text-white text-sm font-bold">D</span>
            <span className="text-lg font-bold text-gray-900 group-hover:text-gray-700 transition-colors">Study-DaZi</span>
          </Link>
          {user ? (
            <nav className="flex items-center gap-1 sm:gap-2" role="navigation" aria-label="主导航">
              <Link href="/paths/new" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f97066] text-white text-sm font-medium hover:bg-[#e0524a] transition-colors btn-press">
                <Sparkles size={14} /> 生成路径
              </Link>
              <Link href="/explore" className="px-3 py-1.5 rounded-full text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-700 transition-colors">广场</Link>
              <Link href="/friends" className="px-3 py-1.5 rounded-full text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-700 transition-colors relative" aria-label={`好友${pendingCount > 0 ? `，${pendingCount}条新请求` : ''}`}>
                好友
                {pendingCount > 0 && <span className="absolute -top-1 -right-1 bg-[#ef4444] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center" aria-hidden="true">{pendingCount}</span>}
              </Link>
              <Link href="/messages" className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors relative" aria-label={`消息${msgCount > 0 ? `，${msgCount}条未读` : ''}`}>
                <MessageCircle size={18} />
                {msgCount > 0 && <span className="absolute -top-1 -right-1 bg-[#ef4444] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center" aria-hidden="true">{msgCount}</span>}
              </Link>
              <Link href="/notifications" className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors relative" aria-label={`通知${notifCount > 0 ? `，${notifCount}条未读` : ''}`}>
                <Bell size={18} />
                {notifCount > 0 && <span className="absolute -top-1 -right-1 bg-[#ef4444] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center" aria-hidden="true">{notifCount}</span>}
              </Link>
              <div className="w-px h-5 bg-gray-200 mx-1"></div>
              <Link href="/profile" className="flex items-center gap-1.5 px-2 py-1 rounded-full hover:bg-gray-100 transition-colors">
                <span className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-[10px] font-bold overflow-hidden">
                  {user.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover" alt="" /> : user.username[0]}
                </span>
                <span className="text-sm text-gray-700 hidden sm:inline">{user.username}</span>
              </Link>
              <Link href="/settings" className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors" title="设置"><Settings size={16} /></Link>
              <button onClick={logout} className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors" title="退出"><LogOut size={16} /></button>
            </nav>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="px-4 py-1.5 rounded-full text-sm text-gray-600 hover:bg-gray-100 transition-colors">登录</Link>
              <Link href="/register" className="px-4 py-1.5 rounded-full bg-[#f97066] text-white text-sm font-medium hover:bg-[#e0524a] transition-colors">注册</Link>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {user ? (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            {/* 左侧主内容 */}
            <div className="space-y-6 min-w-0">
              {/* 欢迎横幅 — 唯一保留渐变的地方 */}
              <div className="relative overflow-hidden rounded-2xl bg-[#f97066] p-6 sm:p-8 text-white">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/[0.08] rounded-full -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative">
                  <h1 className="text-2xl sm:text-3xl font-bold" style={{ textWrap: 'balance' }}>
                    欢迎回来，{user.username}
                  </h1>
                  <p className="text-white/70 mt-2 text-sm sm:text-base">准备好今天的学习了吗？</p>
                  <div className="mt-4 flex items-center gap-3">
                    <Link href="/paths/new" className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-white text-[#e0524a] text-sm font-semibold hover:bg-white/90 transition-colors">
                      <Sparkles size={14} /> 生成新路径
                    </Link>
                    <Link href="/explore" className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-white/15 text-white text-sm font-medium hover:bg-white/25 transition-colors">
                      <Search size={14} /> 逛逛广场
                    </Link>
                  </div>
                </div>
              </div>

              {/* 打卡组件 */}
              <CheckInWidget />

              {/* 路径列表 */}
              <section aria-label="已保存的路径">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                    <BookOpen size={16} className="text-gray-400" />
                    我的学习路径
                  </h2>
                  <Link href="/paths/new" className="text-sm text-[#6366f1] hover:text-[#4f46e5] underline underline-offset-2 decoration-[#6366f1]/30 hover:decoration-[#6366f1] font-medium transition-colors">
                    查看全部 <ChevronRight size={14} className="inline" />
                  </Link>
                </div>
                {pathsLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map(i => <div key={i} className="h-20 rounded-2xl bg-white/60 animate-pulse"></div>)}
                  </div>
                ) : paths.length === 0 ? (
                  <div className="rounded-2xl bg-white border-2 border-dashed border-gray-200 p-8 text-center">
                    <BookOpen size={32} className="mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-500 text-sm mb-3">还没有学习路径</p>
                    <Link href="/paths/new" className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-[#f97066] text-white text-sm font-medium hover:bg-[#e0524a] transition-colors">
                      创建第一条路径
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {paths.map((p, i) => (
                      <div key={p.id} className="group relative bg-white rounded-2xl border border-gray-100 hover:border-gray-200 overflow-hidden card-lift stagger-item" style={{ '--i': i } as React.CSSProperties}>
                        <Link href={`/paths/${p.id}`} className="block p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-gray-900 truncate">{p.title}</p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{p.domain}</span>
                                <span className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString('zh-CN')}</span>
                              </div>
                            </div>
                            <button
                              onClick={(e) => handleDeletePath(e, p.id, p.title)}
                              className="p-1.5 rounded-full text-gray-300 hover:text-[#ef4444] hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                              title="删除路径"
                              aria-label={`删除路径：${p.title}`}
                            ><Trash2 size={14} /></button>
                          </div>
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* 右侧边栏 */}
            <aside className="space-y-5">
              {/* 快捷数据 */}
              <div className="grid grid-cols-3 gap-2">
                <Link href="/paths/new" className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-white border border-gray-100 card-lift btn-press">
                  <span className="text-xl font-bold text-gray-900">{paths.length}</span>
                  <span className="text-[10px] text-gray-500">路径</span>
                </Link>
                <Link href="/friends" className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-white border border-gray-100 card-lift btn-press">
                  <span className="text-xl font-bold text-gray-900">{friendCount}</span>
                  <span className="text-[10px] text-gray-500">好友</span>
                </Link>
                <Link href="/buddies" className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-white border border-gray-100 card-lift btn-press">
                  <span className="text-xl font-bold text-gray-900">{buddyCount}</span>
                  <span className="text-[10px] text-gray-500">搭子</span>
                </Link>
              </div>

              {/* 搭子空间 */}
              {buddies.length > 0 && (
                <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden" aria-label="搭子空间">
                  <div className="flex items-center justify-between px-4 pt-4 pb-2">
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <Handshake size={14} className="text-[#8b5cf6]" />
                      搭子空间
                    </h3>
                    <Link href="/buddies" className="text-xs text-[#6366f1] hover:text-[#4f46e5] transition-colors">全部</Link>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {buddies.map(b => (
                      <Link key={b.id} href="/buddies" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                        <span className="w-8 h-8 rounded-full bg-[#ede9fe] flex items-center justify-center text-[#7c3aed] text-xs font-bold shrink-0 overflow-hidden">
                          {b.buddy.avatarUrl ? <img src={b.buddy.avatarUrl} className="w-full h-full object-cover" alt="" /> : b.buddy.username[0]}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{b.buddy.username}</p>
                          <span className="text-[10px] bg-[#ede9fe] text-[#7c3aed] px-1.5 py-0.5 rounded-full">{b.domain}</span>
                        </div>
                        <span
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/messages?with=${b.buddy.id}`); }}
                          className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0 cursor-pointer"
                          title="私信"
                        ><MessageCircle size={14} /></span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* 快捷操作 */}
              <div className="bg-[#f5f3ff] rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-[#5b21b6] mb-3">快捷操作</h3>
                <div className="space-y-1.5">
                  <Link href="/paths/new" className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-white hover:text-[#6366f1] transition-all">
                    <Sparkles size={14} className="text-[#f97066]" /> AI 生成学习路径
                  </Link>
                  <Link href="/explore" className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-white hover:text-[#6366f1] transition-all">
                    <Search size={14} className="text-gray-400" /> 浏览路径广场
                  </Link>
                  <Link href="/friends" className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-white hover:text-[#6366f1] transition-all">
                    <Users size={14} className="text-gray-400" /> 查找学习搭子
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        ) : (
          /* 未登录 - 营销页 */
          <div className="py-8 sm:py-16">
            {/* Hero — 唯一渐变 */}
            <div className="relative overflow-hidden rounded-3xl bg-[#f97066] p-8 sm:p-16 text-white text-center">
              <div className="absolute top-0 left-1/4 w-64 h-64 bg-white/[0.06] rounded-full -translate-y-1/2"></div>
              <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-white/[0.04] rounded-full translate-y-1/2"></div>
              <div className="relative space-y-6">
                <h1 className="text-4xl sm:text-5xl font-bold leading-tight" style={{ textWrap: 'balance' }}>
                  和搭子一起<br className="sm:hidden" />系统化自学
                </h1>
                <p className="text-white/70 max-w-lg mx-auto text-base sm:text-lg leading-relaxed">
                  AI 帮你规划学习路径，搭子陪你坚持到底。<br className="hidden sm:block" />
                  不再学杂，不再半途而废。
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                  <Link href="/register" className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-white text-[#e0524a] text-base font-semibold hover:bg-white/90 transition-colors">
                    <Rocket size={18} /> 免费注册
                  </Link>
                  <Link href="/login" className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-white/15 text-white text-base font-medium hover:bg-white/25 transition-colors">
                    已有账号？登录
                  </Link>
                </div>
              </div>
            </div>

            {/* 特性卡片 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
              <div className="bg-white rounded-2xl p-6 border border-gray-100 card-lift stagger-item" style={{ '--i': 0 } as React.CSSProperties}>
                <div className="w-10 h-10 rounded-xl bg-[#fde8e6] flex items-center justify-center mb-3"><Sparkles size={20} className="text-[#f97066]" /></div>
                <h3 className="font-semibold text-gray-900 mb-1.5">AI 生成路径</h3>
                <p className="text-sm text-gray-500 leading-relaxed">输入想学的领域，AI 帮你拆解成可执行的学习路径</p>
              </div>
              <div className="bg-white rounded-2xl p-6 border border-gray-100 card-lift stagger-item" style={{ '--i': 1 } as React.CSSProperties}>
                <div className="w-10 h-10 rounded-xl bg-[#ede9fe] flex items-center justify-center mb-3"><Users size={20} className="text-[#8b5cf6]" /></div>
                <h3 className="font-semibold text-gray-900 mb-1.5">找到学习搭子</h3>
                <p className="text-sm text-gray-500 leading-relaxed">匹配同领域的学习伙伴，互相督促，不再孤军奋战</p>
              </div>
              <div className="bg-white rounded-2xl p-6 border border-gray-100 card-lift stagger-item" style={{ '--i': 2 } as React.CSSProperties}>
                <div className="w-10 h-10 rounded-xl bg-[#fef3c7] flex items-center justify-center mb-3"><Flame size={20} className="text-[#f59e0b]" /></div>
                <h3 className="font-semibold text-gray-900 mb-1.5">打卡坚持</h3>
                <p className="text-sm text-gray-500 leading-relaxed">每日打卡记录进度，连续天数激励你坚持到底</p>
              </div>
            </div>

            <div className="text-center mt-10 text-sm text-gray-400">
              <p>已有学习者在使用 Study-DaZi 规划学习</p>
            </div>
          </div>
        )}
      </main>

      {/* API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 fade-in" role="dialog" aria-modal="true" aria-label="配置 API Key">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm mx-4 space-y-4 modal-enter">
            <div className="text-center">
              <Key size={32} className="mx-auto mb-2 text-[#f97066]" />
              <h3 className="text-lg font-semibold text-gray-900">配置 API Key</h3>
            </div>
            <p className="text-sm text-gray-600 text-center">
              使用 AI 生成学习路径需要 DeepSeek API Key。<br />
              在 <a href="https://platform.deepseek.com" target="_blank" rel="noopener noreferrer" className="text-[#6366f1] underline underline-offset-2 hover:text-[#4f46e5]">platform.deepseek.com</a> 免费注册获取。
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowKeyModal(false)} className="flex-1 rounded-full border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors">稍后</button>
              <Link href="/settings" onClick={() => setShowKeyModal(false)} className="flex-1 rounded-full bg-[#f97066] px-4 py-2.5 text-sm font-semibold text-white text-center hover:bg-[#e0524a] transition-colors">去设置</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
