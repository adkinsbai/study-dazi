'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';

const PROVIDERS: { id: string; name: string; url: string; placeholder: string; customizableUrl?: boolean }[] = [
  { id: 'deepseek', name: 'DeepSeek', url: 'https://platform.deepseek.com', placeholder: 'sk-...' },
  { id: 'mimo', name: '小米 MIMO', url: 'https://mimo.xiaomi.com', placeholder: '...' },
  { id: 'openai', name: 'OpenAI GPT', url: 'https://platform.openai.com/api-keys', placeholder: 'sk-...' },
  { id: 'openai-relay', name: 'GPT 中转站', url: '', placeholder: 'sk-...', customizableUrl: true },
];

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const authReady = useAuthStore((s) => s.authReady);
  const [selectedProvider, setSelectedProvider] = useState('deepseek');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [configuredProviders, setConfiguredProviders] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!authReady) return; // 等认证状态恢复
    if (!user) {
      router.push('/login');
      return;
    }
    loadApiKeys();
  }, [user, authReady]);

  const loadApiKeys = async () => {
    try {
      const res = await fetch('/api/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConfiguredProviders((data.apiKeys || []).map((k: { provider: string }) => k.provider));
      }
    } catch { /* ignore */ }
  };

  const handleSave = async () => {
    setError('');
    setSaved(false);
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider: selectedProvider,
          apiKey,
          ...(currentProvider.customizableUrl ? { baseUrl } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '保存失败');
      }
      setSaved(true);
      setApiKey('');
      loadApiKeys();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setError('');
    try {
      // 构建请求体：如果有输入就用输入的，没有就让后端查已保存的
      const body: Record<string, string> = { provider: selectedProvider };
      if (apiKey.trim()) body.apiKey = apiKey;
      if (currentProvider.customizableUrl && baseUrl.trim()) body.baseUrl = baseUrl;

      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        setTestResult({ ok: true, msg: `连接成功: "${data.reply}" (${data.url})` });
      } else {
        const detail = data.url ? `${data.error} [${data.url}]` : data.error;
        setTestResult({ ok: false, msg: detail || '连接失败' });
      }
    } catch {
      setTestResult({ ok: false, msg: '网络错误' });
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async (provider: string) => {
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ provider, apiKey: '' }),
      });
      if (res.ok) loadApiKeys();
    } catch { /* ignore */ }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafaf9]">
        <p className="text-gray-400 text-sm">加载中...</p>
      </div>
    );
  }
  if (!user) return null;

  const currentProvider = PROVIDERS.find(p => p.id === selectedProvider)!;

  return (
    <div className="min-h-screen bg-[#fafaf9]">
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">设置</h1>
          <button onClick={() => router.push('/')} className="text-sm text-gray-500 hover:text-[#f97066] transition-colors">
            返回首页
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* 已配置的 provider 列表 */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">AI 模型配置</h2>
          <p className="text-sm text-gray-500 mb-4">
            配置不同 AI 模型的 API Key，生成学习路径时可选择使用哪个模型。
          </p>

          <div className="space-y-2 mb-6">
            {PROVIDERS.map(p => {
              const isConfigured = configuredProviders.includes(p.id);
              return (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${isConfigured ? 'bg-[#10b981]' : 'bg-gray-300'}`} />
                    <span className="text-sm font-medium text-gray-900">{p.name}</span>
                    {isConfigured && <span className="text-xs text-[#10b981] bg-[#d1fae5] px-2 py-0.5 rounded-full">已配置</span>}
                  </div>
                  {isConfigured && (
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-xs text-gray-400 hover:text-[#ef4444] transition-colors"
                    >
                      删除
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* 添加/更新 Key */}
          <div className="border-t border-gray-100 pt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">选择模型</label>
              <div className="flex gap-2">
                {PROVIDERS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedProvider(p.id); setApiKey(''); setBaseUrl(''); setError(''); setTestResult(null); }}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      selectedProvider === p.id
                        ? 'bg-[#f97066] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="apikey" className="block text-sm font-medium text-gray-700 mb-1">
                {currentProvider.name} API Key
              </label>
              {currentProvider.url && (
                <p className="text-xs text-gray-400 mb-2">
                  在 <a href={currentProvider.url} target="_blank" rel="noopener noreferrer" className="text-[#f97066] underline underline-offset-2">{currentProvider.url}</a> 获取
                </p>
              )}
              <input
                id="apikey"
                type="password"
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setTestResult(null); }}
                placeholder={currentProvider.placeholder}
                className="block w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm shadow-sm focus:border-[#f97066] focus:ring-1 focus:ring-[#f97066] outline-none font-mono transition-colors"
              />
            </div>

            {currentProvider.customizableUrl && (
              <div>
                <label htmlFor="baseurl" className="block text-sm font-medium text-gray-700 mb-1">
                  接口地址
                </label>
                <p className="text-xs text-gray-400 mb-2">
                  中转站提供的 API 地址，如 https://api.example.com/v1
                </p>
                <input
                  id="baseurl"
                  type="url"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.example.com/v1"
                  className="block w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm shadow-sm focus:border-[#f97066] focus:ring-1 focus:ring-[#f97066] outline-none transition-colors"
                />
              </div>
            )}

            {error && (
              <div className="text-sm text-[#ef4444] bg-red-50 px-3 py-2 rounded-xl">{error}</div>
            )}
            {saved && (
              <div className="text-sm text-[#10b981] bg-green-50 px-3 py-2 rounded-xl">已保存</div>
            )}
            {testResult && (
              <div className={`text-sm px-3 py-2 rounded-xl ${testResult.ok ? 'text-[#10b981] bg-green-50' : 'text-[#ef4444] bg-red-50'}`}>
                {testResult.ok ? '✅ ' : '❌ '}{testResult.msg}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={!apiKey.trim()}
                className="rounded-full bg-[#f97066] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#e0524a] disabled:opacity-50 transition-colors"
              >
                保存
              </button>
              <button
                onClick={handleTest}
                disabled={testing || (!apiKey.trim() && !configuredProviders.includes(selectedProvider))}
                className="rounded-full border border-gray-200 px-6 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {testing ? '测试中...' : '测试连接'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
