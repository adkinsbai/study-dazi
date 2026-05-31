'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const register = useAuthStore((s) => s.register);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('两次密码不一致');
      return;
    }

    setLoading(true);
    try {
      const result = await register(username, email, password);
      const codeParam = result.code ? `&code=${result.code}` : '';
      router.push(`/verify?email=${encodeURIComponent(email)}${codeParam}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fef7f5] px-4 relative overflow-hidden">
      {/* Decorative gradient blobs */}
      <div className="absolute top-20 -left-20 w-72 h-72 rounded-full bg-[#f97066]/[0.06] blur-xl"></div>
      <div className="absolute top-1/3 -right-16 w-56 h-56 rounded-full bg-[#f97066]/[0.05] blur-xl"></div>
      <div className="absolute -bottom-10 left-10 w-48 h-48 rounded-full bg-[#f97066]/[0.07] blur-xl"></div>

      <div className="w-full max-w-sm space-y-6 relative z-10">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#f97066] to-[#e0524a] flex items-center justify-center text-white text-sm font-bold">D</span>
            <h1 className="text-2xl font-bold text-gray-900">Study-DaZi</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">创建你的学习搭子账号</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-2xl shadow-sm">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</div>
          )}

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
              用户名
            </label>
            <input
              id="username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
              placeholder="2-30 个字符，中英文、数字、下划线"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              邮箱
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              密码
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 pr-10 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
                placeholder="至少 8 位，含字母和数字"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs transition-colors"
              >
                {showPassword ? '隐藏' : '显示'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">至少 8 位，包含字母和数字</p>
          </div>

          <div>
            <label htmlFor="confirm" className="block text-sm font-medium text-gray-700">
              确认密码
            </label>
            <input
              id="confirm"
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
              placeholder="再次输入密码"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-[#f97066] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e0524a] disabled:opacity-50 transition-colors"
          >
            {loading ? '发送中...' : '注册'}
          </button>

          <div className="text-center text-sm">
            <Link href="/login" className="text-[#f97066] hover:text-[#e0524a] transition-colors">
              已有账号？去登录
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
