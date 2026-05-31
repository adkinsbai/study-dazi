'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败');
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
            <h1 className="text-2xl font-bold text-gray-900">忘记密码</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">输入邮箱，我们将发送重置链接</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm space-y-4">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="text-green-600 text-sm bg-green-50 px-3 py-2 rounded-md">
                重置链接已发送至 {email}，请查收邮件
              </div>
              <Link href="/login" className="text-sm text-[#f97066] hover:text-[#e0524a] block transition-colors">
                返回登录
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-[#f97066] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e0524a] disabled:opacity-50 transition-colors"
              >
                {loading ? '发送中...' : '发送重置链接'}
              </button>

              <div className="text-center">
                <Link href="/login" className="text-sm text-[#f97066] hover:text-[#e0524a] transition-colors">
                  返回登录
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
