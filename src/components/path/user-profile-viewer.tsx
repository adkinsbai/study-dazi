'use client';

import { useState } from 'react';

interface UserProfileViewerProps {
  profile: string;
  onConfirm: () => void;
  onBack: () => void;
  loading?: boolean;
}

// 简单的 Markdown 渲染器
function renderMarkdown(md: string): string {
  return md
    // 标题
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-gray-900 mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-gray-900 mt-6 mb-3 pb-2 border-b border-gray-100">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-gray-900 mb-4">$1</h1>')
    // 列表项
    .replace(/^- (.+)$/gm, '<li class="flex items-start gap-2 mb-1"><span class="text-[#f97066] mt-1">•</span><span>$1</span></li>')
    // 粗体
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
    // 引用块
    .replace(/^> (.+)$/gm, '<blockquote class="pl-4 border-l-4 border-[#f97066] italic text-gray-600 my-3">$1</blockquote>')
    // 换行
    .replace(/\n\n/g, '</div><div class="mb-3">')
    .replace(/\n/g, '<br/>');
}

export default function UserProfileViewer({ profile, onConfirm, onBack, loading }: UserProfileViewerProps) {
  const [showRaw, setShowRaw] = useState(false);

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* 头部 */}
      <div className="bg-gradient-to-r from-[#f97066] to-[#e0524a] px-6 py-4">
        <h3 className="text-lg font-bold text-white">📋 你的学习画像</h3>
        <p className="text-sm text-white/80 mt-1">基于你的回答，AI 生成了这份个性化画像</p>
      </div>

      {/* 切换按钮 */}
      <div className="px-6 pt-4">
        <div className="flex gap-2">
          <button
            onClick={() => setShowRaw(false)}
            className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
              !showRaw ? 'bg-[#f97066] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            渲染预览
          </button>
          <button
            onClick={() => setShowRaw(true)}
            className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
              showRaw ? 'bg-[#f97066] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            原始 Markdown
          </button>
        </div>
      </div>

      {/* 内容 */}
      <div className="p-6">
        {showRaw ? (
          <pre className="bg-gray-50 rounded-xl p-4 text-sm font-mono text-gray-700 overflow-x-auto whitespace-pre-wrap">
            {profile}
          </pre>
        ) : (
          <div
            className="prose prose-sm max-w-none text-gray-600 [&_li]:list-none"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(profile) }}
          />
        )}
      </div>

      {/* 按钮 */}
      <div className="flex gap-3 px-6 pb-6">
        <button
          onClick={onBack}
          className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          重新填写
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 rounded-xl bg-[#f97066] px-4 py-3 text-sm font-semibold text-white hover:bg-[#e0524a] disabled:opacity-50 transition-colors"
        >
          {loading ? '生成中...' : '确认，生成学习路径'}
        </button>
      </div>
    </div>
  );
}
