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

  // 登录后检查是否有 API Key + 加载路径列表
  useEffect(() => {
    if (user) {
      checkApiKey();
      loadPaths();
      loadPendingCount();
      loadBuddyCount();
      loadNotifCount();
    }
  }, [user]);

  const loadNotifCount = async () => {
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setNotifCount(d.unreadCount || 0); }
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">Study-DaZi</h1>
          {user ? (
            <div className="flex items-center gap-3">
              <Link href="/paths/new" className="text-sm text-indigo-600 hover:text-indigo-500">
                生成路径
              </Link>
              <Link href="/explore" className="text-sm text-gray-500 hover:text-indigo-600">广场</Link>
              <Link href="/friends" className="text-sm text-gray-500 hover:text-indigo-600 relative">
                好友
                {pendingCount > 0 && (
                  <span className="absolute -top-2 -right-4 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {pendingCount}
                  </span>
                )}
              </Link>
              <Link href="/profile" className="text-sm text-gray-600 hover:text-indigo-600">
                {user.username}
              </Link>
              <Link href="/notifications" className="text-sm text-gray-500 hover:text-indigo-600 relative">
                🔔
                {notifCount > 0 && (
                  <span className="absolute -top-2 -right-3 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {notifCount}
                  </span>
                )}
              </Link>
              <Link href="/messages" className="text-sm text-gray-500 hover:text-indigo-600">💬</Link>
              <Link href="/settings" className="text-sm text-gray-500 hover:text-gray-700">
                设置
              </Link>
              <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">
                退出
              </button>
            </div>
          ) : (
            <Link href="/login" className="text-sm text-indigo-600 hover:text-indigo-500">
              登录
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        {user ? (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900">欢迎回来，{user.username} 👋</h2>
              <p className="text-gray-500 mt-1">准备好今天的学习了吗？</p>
            </div>

            <CheckInWidget />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link href="/paths/new" className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow">
                <p className="text-sm text-gray-500">我的路径</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{paths.length}</p>
              </Link>
              <div className="bg-white rounded-xl shadow-sm p-4">
                <p className="text-sm text-gray-500">好友</p>
                <p className="text-2xl font-bold text-gray-900">{friendCount}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4">
                <p className="text-sm text-gray-500">搭子</p>
                <p className="text-2xl font-bold text-gray-900">{buddyCount}</p>
              </div>
            </div>

            {/* 已保存的学习路径 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900">已保存的路径</h3>
                <Link href="/paths/new" className="text-sm text-indigo-600 hover:text-indigo-500">
                  + 新建路径
                </Link>
              </div>
              {pathsLoading ? (
                <p className="text-sm text-gray-400">加载中...</p>
              ) : paths.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400 text-sm">还没有学习路径</p>
                  <Link href="/paths/new" className="text-sm text-indigo-600 hover:text-indigo-500 mt-2 inline-block">
                    创建你的第一条路径 →
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {paths.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors group"
                    >
                      <Link href={`/paths/${p.id}`} className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{p.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {p.domain} · {new Date(p.createdAt).toLocaleDateString('zh-CN')}
                        </p>
                      </Link>
                      <button
                        onClick={(e) => handleDeletePath(e, p.id, p.title)}
                        className="ml-3 text-xs text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                        title="删除"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 搭子空间 */}
            {buddies.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-gray-900">🤝 搭子空间</h3>
                  <Link href="/friends" className="text-sm text-indigo-600 hover:text-indigo-500">
                    查看全部
                  </Link>
                </div>
                <div className="space-y-2">
                  {buddies.map(b => (
                    <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border border-purple-100 hover:border-purple-200 hover:bg-purple-50/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {b.buddy.username}
                          <span className="ml-2 text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">{b.domain}</span>
                        </p>
                        {b.sharedPathId && b.sharedPathTitle ? (
                          <Link href={`/paths/${b.sharedPathId}`} className="text-xs text-indigo-500 hover:text-indigo-700 mt-0.5 inline-block">
                            📚 共享路径：{b.sharedPathTitle}
                          </Link>
                        ) : (
                          <p className="text-xs text-gray-400 mt-0.5">暂无共享路径</p>
                        )}
                      </div>
                      <Link href={`/messages?with=${b.buddy.id}`}
                        className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 shrink-0">
                        💬 私信
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center space-y-6 py-20">
            <h2 className="text-3xl font-bold text-gray-900">和搭子一起，系统化自学</h2>
            <p className="text-gray-500 max-w-md mx-auto">
              AI 帮你规划学习路径，搭子陪你坚持到底。不再学杂，不再半途而废。
            </p>
            <div className="flex gap-3 justify-center">
              <Link href="/register" className="rounded-md bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500">
                免费注册
              </Link>
              <Link href="/login" className="rounded-md border border-gray-300 px-6 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                登录
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">🔑 配置 API Key</h3>
            <p className="text-sm text-gray-600">
              使用 AI 生成学习路径需要 DeepSeek API Key。在 <a href="https://platform.deepseek.com" target="_blank" className="text-indigo-600 underline">platform.deepseek.com</a> 免费注册获取。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowKeyModal(false)}
                className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                稍后
              </button>
              <Link
                href="/settings"
                onClick={() => setShowKeyModal(false)}
                className="flex-1 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white text-center hover:bg-indigo-500"
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
