'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth';

function VerifyForm() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const devCode = searchParams.get('code') || '';
  const [code, setCode] = useState('');
  const [sentCode, setSentCode] = useState(devCode);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const verifyEmail = useAuthStore((s) => s.verifyEmail);
  const router = useRouter();

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await verifyEmail(email, code);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证失败');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    try {
      const res = await fetch('/api/auth/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.code) setSentCode(data.code);
        setCountdown(60);
      } else {
        setError(data.error || '发送失败');
      }
    } catch {
      setError('网络错误，请重试');
    }
  };

  if (!email) {
    return (
      <div className="text-center text-gray-500">
        <p>请先从注册页面开始</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-2xl shadow-sm">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</div>
      )}

      {sentCode && (
        <div className="text-center bg-[#fde8e6] rounded-md py-3">
          <p className="text-xs text-[#e0524a]">开发模式</p>
          <p className="text-2xl font-bold tracking-[0.3em] text-[#f97066] mt-1">{sentCode}</p>
        </div>
      )}

      <div className="text-center">
        <p className="text-sm text-gray-600">
          验证码已发送至 <span className="font-medium">{email}</span>
        </p>
      </div>

      <div>
        <label htmlFor="code" className="block text-sm font-medium text-gray-700">
          验证码
        </label>
        <input
          id="code"
          type="text"
          required
          maxLength={6}
          pattern="[0-9]{6}"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-center text-2xl tracking-[0.5em] shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
          placeholder="000000"
          autoFocus
        />
      </div>

      <button
        type="submit"
        disabled={loading || code.length !== 6}
        className="w-full rounded-full bg-[#f97066] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e0524a] disabled:opacity-50 transition-colors"
      >
        {loading ? '验证中...' : '验证'}
      </button>

      <div className="text-center space-y-2">
        <Link href="/register" className="text-sm text-gray-400 hover:text-gray-600 underline transition-colors">
          ← 返回上一步
        </Link>
      </div>

      <div className="text-center">
        {countdown > 0 ? (
          <span className="text-sm text-gray-400 underline cursor-not-allowed">
            {countdown} 秒后重新发送
          </span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            className="text-sm text-[#f97066] underline hover:text-[#e0524a] transition-colors"
          >
            未收到邮件？重新发送
          </button>
        )}
      </div>
    </form>
  );
}

export default function VerifyPage() {
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
            <h1 className="text-2xl font-bold text-gray-900">验证邮箱</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">输入 6 位验证码完成注册</p>
        </div>
        <Suspense fallback={<div className="text-center text-gray-500">加载中...</div>}>
          <VerifyForm />
        </Suspense>
      </div>
    </div>
  );
}
