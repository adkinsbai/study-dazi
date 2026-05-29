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
  const register = useAuthStore((s) => s.register);
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
      const result = await register(email, 'ResendOnly1');
      if (result.code) setSentCode(result.code);
      setCountdown(60);
    } catch (err) {
      // 60s 冷却中，忽略
      setCountdown(60);
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
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-xl shadow-sm">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</div>
      )}

      {sentCode && (
        <div className="text-center bg-indigo-50 rounded-md py-3">
          <p className="text-xs text-indigo-500">开发模式</p>
          <p className="text-2xl font-bold tracking-[0.3em] text-indigo-600 mt-1">{sentCode}</p>
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
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-center text-2xl tracking-[0.5em] shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
          placeholder="000000"
          autoFocus
        />
      </div>

      <button
        type="submit"
        disabled={loading || code.length !== 6}
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {loading ? '验证中...' : '验证'}
      </button>

      <div className="text-center space-y-2">
        <Link href="/register" className="text-sm text-gray-400 hover:text-gray-600 underline">
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
            className="text-sm text-indigo-600 underline hover:text-indigo-500"
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">验证邮箱</h1>
          <p className="text-sm text-gray-500 mt-1">输入 6 位验证码完成注册</p>
        </div>
        <Suspense fallback={<div className="text-center text-gray-500">加载中...</div>}>
          <VerifyForm />
        </Suspense>
      </div>
    </div>
  );
}
