'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';
import Link from 'next/link';
import { CheckInWidget } from '@/components/checkin/checkin-widget';

interface PathItem {
  id: string;
  title: string;
  domain: string;
  isPublic: boolean;
  createdAt: string;
}

export default function Home() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [paths, setPaths] = useState<PathItem[]>([]);
  const [pathsLoading, setPathsLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [friendCount, setFriendCount] = useState(0);
  const [buddyCount, setBuddyCount] = useState(0);
  const [buddies, setBuddies] = useState<{ id: string; domain: string; buddy: { id: string; username: string }; sharedPathId?: string | null; sharedPathTitle?: string | null }[]>([]);
  const [notifCount, setNotifCount] = useState(0);
  const [msgCount, setMsgCount] = useState(0);

  // 登录后检查是否有 API Key + 加载路径列表
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
      const res = await fetch('/api/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (!data.deepseekApiKey) {
          setShowKeyModal(true);
        }
      }
    } catch {
      // ignore
    }
  };

  const loadPaths = async () => {
    setPathsLoading(true);
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch('/api/paths', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPaths(data.paths || []);
      }
    } catch {
      // ignore
    } finally {
      setPathsLoading(false);
    }
  };

  const handleDeletePath = async (e: React.MouseEvent, pathId: string, title: string) => {
    e.preventDefault(); // 阻止 Link 导航
    e.stopPropagation();
    if (!confirm(`确定删除「${title}」吗？此操作不可撤销。`)) return;
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch(`/api/paths/${pathId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setPaths((prev) => prev.filter((p) => p.id !== pathId));
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-[#fafaf9]">
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-gray-900 hover:text-[#f97066] transition-colors">Study-DaZi</Link>
          {user ? (
            <nav className="flex items-center gap-3" role="navigation" aria-label="主导航">
              <Link href="/paths/new" className="text-sm font-medium text-[#f97066] hover:text-[#e0524a] transition-colors">
                生成路径
              </Link>
              <Link href="/explore" className="text-sm text-gray-500 hover:text-[#f97066] transition-colors">广场</Link>
              <Link href="/friends" className="text-sm text-gray-500 hover:text-[#f97066] transition-colors relative" aria-label={`好友${pendingCount > 0 ? `，${pendingCount}条新请求` : ''}`}>
                好友
                {pendingCount > 0 && (
                  <span className="absolute -top-2 -right-4 bg-[#ef4444] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center" aria-hidden="true">
                    {pendingCount}
                  </span>
                )}
              </Link>
              <Link href="/profile" className="text-sm text-gray-600 hover:text-[#f97066] transition-colors">
                {user.username}
              </Link>
              <Link href="/notifications" className="text-sm text-gray-500 hover:text-[#f97066] transition-colors relative" aria-label={`通知${notifCount > 0 ? `，${notifCount}条未读` : ''}`}>
                <span aria-hidden="true">🔔</span>
                {notifCount > 0 && (
                  <span className="absolute -top-2 -right-3 bg-[#ef4444] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center" aria-hidden="true">
                    {notifCount}
                  </span>
                )}
              </Link>
              <Link href="/messages" className="text-sm text-gray-500 hover:text-[#f97066] transition-colors relative" aria-label={`消息${msgCount > 0 ? `，${msgCount}条未读` : ''}`}>
                <span aria-hidden="true">💬</span>
                {msgCount > 0 && (
                  <span className="absolute -top-2 -right-3 bg-[#ef4444] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center" aria-hidden="true">
                    {msgCount}
                  </span>
                )}
              </Link>
              <Link href="/settings" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
                设置
              </Link>
              <button onClick={logout} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                退出
              </button>
            </nav>
          ) : (
            <Link href="/login" className="text-sm font-medium text-[#f97066] hover:text-[#e0524a] transition-colors">
              登录
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        {user ? (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-[#f97066] to-[#e0524a] rounded-2xl p-6 text-white">
              <h2 className="text-xl font-semibold">欢迎回来，{user.username} 👋</h2>
              <p className="text-white/80 mt-1">准备好今天的学习了吗？</p>
            </div>

            <CheckInWidget />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link href="/paths/new" className="group bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition-all hover:-translate-y-0.5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-9 h-9 rounded-xl bg-[#fde8e6] text-[#f97066] flex items-center justify-center text-sm">📚</span>
                  <p className="text-sm text-gray-500">我的路径</p>
                </div>
                <p className="text-2xl font-bold text-gray-900">{paths.length}</p>
                <p className="text-xs text-gray-400 mt-1">条学习路径</p>
              </Link>
              <Link href="/friends" className="group bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition-all hover:-translate-y-0.5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-9 h-9 rounded-xl bg-[#eef2ff] text-[#6366f1] flex items-center justify-center text-sm">👥</span>
                  <p className="text-sm text-gray-500">好友</p>
                </div>
                <p className="text-2xl font-bold text-gray-900">{friendCount}</p>
                <p className="text-xs text-gray-400 mt-1">位学习伙伴</p>
              </Link>
              <Link href="/buddies" className="group bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition-all hover:-translate-y-0.5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-9 h-9 rounded-xl bg-[#ede9fe] text-[#8b5cf6] flex items-center justify-center text-sm">🤝</span>
                  <p className="text-sm text-gray-500">搭子</p>
                </div>
                <p className="text-2xl font-bold text-gray-900">{buddyCount}</p>
                <p className="text-xs text-gray-400 mt-1">个搭子关系</p>
              </Link>
            </div>

            {/* 已保存的学习路径 */}
            <section className="bg-white rounded-2xl shadow-sm p-6" aria-label="已保存的路径">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900">已保存的路径</h3>
                <Link href="/paths/new" className="text-sm font-medium text-[#f97066] hover:text-[#e0524a] transition-colors">
                  + 新建路径
                </Link>
              </div>
              {pathsLoading ? (
                <p className="text-sm text-gray-400">加载中...</p>
              ) : paths.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400 text-sm mb-2">还没有学习路径</p>
                  <Link href="/paths/new" className="text-sm font-medium text-[#f97066] hover:text-[#e0524a] transition-colors">
                    创建你的第一条路径 →
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {paths.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-[#fde8e6] hover:bg-[#fef4f3] transition-colors group"
                    >
                      <Link href={`/paths/${p.id}`} className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{p.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {p.domain} · {new Date(p.createdAt).toLocaleDateString('zh-CN')}
                        </p>
                      </Link>
                      <button
                        onClick={(e) => handleDeletePath(e, p.id, p.title)}
                        className="ml-3 text-xs text-gray-300 hover:text-[#ef4444] sm:opacity-0 sm:group-hover:opacity-100 transition-all shrink-0"
                        title="删除路径"
                        aria-label={`删除路径：${p.title}`}
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 搭子空间 */}
            {buddies.length > 0 && (
              <section className="bg-white rounded-2xl shadow-sm p-6" aria-label="搭子空间">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-gray-900">🤝 搭子空间</h3>
                  <Link href="/buddies" className="text-sm font-medium text-[#f97066] hover:text-[#e0524a] transition-colors">
                    查看看板 →
                  </Link>
                </div>
                <div className="space-y-2">
                  {buddies.map(b => (
                    <div key={b.id} className="flex items-center justify-between p-3 rounded-xl border border-[#ede9fe] hover:border-[#c4b5fd] hover:bg-[#f5f3ff] transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {b.buddy.username}
                          <span className="ml-2 text-xs bg-[#ede9fe] text-[#7c3aed] px-1.5 py-0.5 rounded-full">{b.domain}</span>
                        </p>
                        {b.sharedPathId && b.sharedPathTitle ? (
                          <Link href={`/paths/${b.sharedPathId}`} className="text-xs text-[#f97066] hover:text-[#e0524a] mt-0.5 inline-block transition-colors">
                            📚 共享路径：{b.sharedPathTitle}
                          </Link>
                        ) : (
                          <p className="text-xs text-gray-400 mt-0.5">暂无共享路径</p>
                        )}
                      </div>
                      <Link href={`/messages?with=${b.buddy.id}`}
                        className="text-xs px-3 py-1.5 rounded-full bg-[#fde8e6] text-[#e0524a] hover:bg-[#f97066] hover:text-white transition-colors shrink-0">
                        💬 私信
                      </Link>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="text-center space-y-8 py-16 md:py-24">
            <div className="space-y-4">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900" style={{ textWrap: 'balance' }}>
                和搭子一起，系统化自学
              </h2>
              <p className="text-gray-500 max-w-md mx-auto text-base leading-relaxed">
                AI 帮你规划学习路径，搭子陪你坚持到底。不再学杂，不再半途而废。
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Link href="/register" className="rounded-full bg-[#f97066] px-8 py-3 text-sm font-semibold text-white hover:bg-[#e0524a] transition-colors shadow-sm">
                免费注册
              </Link>
              <Link href="/login" className="rounded-full border border-gray-300 px-8 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                登录
              </Link>
            </div>
            <p className="text-xs text-gray-400">已有账号？直接登录开始学习</p>
          </div>
        )}
      </main>

      {/* API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-label="配置 API Key">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm mx-4 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">🔑 配置 API Key</h3>
            <p className="text-sm text-gray-600">
              使用 AI 生成学习路径需要 DeepSeek API Key。在 <a href="https://platform.deepseek.com" target="_blank" rel="noopener noreferrer" className="text-[#f97066] underline underline-offset-2 hover:text-[#e0524a]">platform.deepseek.com</a> 免费注册获取。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowKeyModal(false)}
                className="flex-1 rounded-full border border-gray-300 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                稍后
              </button>
              <Link
                href="/settings"
                onClick={() => setShowKeyModal(false)}
                className="flex-1 rounded-full bg-[#f97066] px-4 py-2.5 text-sm font-semibold text-white text-center hover:bg-[#e0524a] transition-colors"
              >
                去设置
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
