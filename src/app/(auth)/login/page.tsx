'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fef7f5] bg-stripe px-4 relative overflow-hidden">
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
          <p className="text-sm text-gray-500 mt-1">登录你的学习搭子</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-2xl shadow-sm">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</div>
          )}

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
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs transition-colors"
              >
                {showPassword ? '隐藏' : '显示'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-[#f97066] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e0524a] disabled:opacity-50 transition-colors"
          >
            {loading ? '登录中...' : '登录'}
          </button>

          <div className="flex justify-between text-sm">
            <Link href="/register" className="text-[#6366f1] hover:text-[#4f46e5] underline underline-offset-2 decoration-[#6366f1]/30 hover:decoration-[#6366f1] transition-colors">
              注册账号
            </Link>
            <Link href="/forgot-password" className="text-[#6366f1] hover:text-[#4f46e5] underline underline-offset-2 decoration-[#6366f1]/30 hover:decoration-[#6366f1] transition-colors">
              忘记密码？
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
