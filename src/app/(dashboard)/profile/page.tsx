'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/auth';
import Link from 'next/link';

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState(user?.username || '');
  const [saving, setSaving] = useState(false);

  const handleSaveProfile = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: editName }),
      });
      if (!res.ok) throw new Error('保存失败');
      setAuth({ ...user!, username: editName, email: user!.email, emailVerified: user!.emailVerified }, token!);
      setShowEdit(false);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">个人主页</h1>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">返回</Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-2xl shrink-0">
              {user?.username?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900">{user?.username}</h2>
              <p className="text-sm text-gray-400 mt-1">{user?.email}</p>
            </div>
            <button
              onClick={() => { setEditName(user?.username || ''); setShowEdit(true); }}
              className="text-sm text-indigo-600 hover:text-indigo-500 shrink-0"
            >
              编辑资料
            </button>
          </div>
        </div>

        <p className="text-center text-gray-400 text-sm mt-8">
          头像、简介和动态功能需要数据库迁移后启用
        </p>
      </main>

      {showEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowEdit(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4 w-full space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900">编辑用户名</h3>
            <input
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowEdit(false)}
                className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                取消
              </button>
              <button onClick={handleSaveProfile} disabled={saving}
                className="flex-1 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
