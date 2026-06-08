'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth';
import { Calendar, Clock, Play, ExternalLink, CheckCircle2, Sparkles } from 'lucide-react';

interface TaskResource {
  id: string;
  platform: string;
  title: string;
  url: string;
  duration: number | null;
  instructor: string | null;
  isFree: boolean;
}

interface DailyTask {
  nodeId: string;
  nodeTitle: string;
  phaseTitle: string;
  estimatedMinutes: number;
  resources: TaskResource[];
  keywords: string[];
}

interface DailyTasksData {
  tasks: DailyTask[];
  todayMinutes: number;
  summary: { total: number; completed: number; inProgress: number };
  message?: string;
}

const platformColors: Record<string, string> = {
  youtube: 'bg-red-50 text-red-600',
  bilibili: 'bg-pink-50 text-pink-600',
  coursera: 'bg-blue-50 text-blue-600',
  mit_ocw: 'bg-gray-100 text-gray-700',
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const m = Math.round(seconds / 60);
  if (m >= 60) return `${Math.floor(m / 60)}h${m % 60}m`;
  return `${m}m`;
}

export function DailyTasks({ pathId }: { pathId: string }) {
  const token = useAuthStore(s => s.token);
  const [data, setData] = useState<DailyTasksData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/paths/${pathId}/daily-tasks`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('加载失败');
      const d = await res.json();
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [pathId, token]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center gap-2 text-gray-400">
          <div className="w-4 h-4 border-2 border-gray-200 border-t-[#f97066] rounded-full animate-spin" />
          加载今日任务...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const progressPct = data.summary.total > 0
    ? Math.round((data.summary.completed / data.summary.total) * 100)
    : 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#f97066] to-[#fb923c] px-6 py-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={18} />
            <h3 className="font-semibold">今日学习任务</h3>
          </div>
          <div className="flex items-center gap-1 text-sm opacity-90">
            <Clock size={14} />
            预计 {data.todayMinutes} 分钟
          </div>
        </div>
        {/* 进度条 */}
        <div className="mt-3">
          <div className="flex justify-between text-xs opacity-80 mb-1">
            <span>总进度</span>
            <span>{data.summary.completed}/{data.summary.total} 节点 · {progressPct}%</span>
          </div>
          <div className="h-1.5 bg-white/30 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </div>

      {/* 任务列表 */}
      <div className="p-4 space-y-3">
        {data.message && data.tasks.length === 0 && (
          <div className="text-center py-6">
            <Sparkles className="mx-auto text-amber-400 mb-2" size={32} />
            <p className="text-gray-600 font-medium">{data.message}</p>
          </div>
        )}

        {data.tasks.map((task, i) => (
          <div key={task.nodeId} className="border border-gray-100 rounded-xl p-4">
            {/* 任务标题 */}
            <div className="flex items-start gap-3 mb-3">
              <div className="w-6 h-6 rounded-full bg-[#fde8e6] text-[#f97066] flex items-center justify-center text-xs font-bold shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-gray-900">{task.nodeTitle}</h4>
                <p className="text-xs text-gray-400 mt-0.5">
                  {task.phaseTitle} · 预计 {task.estimatedMinutes} 分钟
                </p>
              </div>
            </div>

            {/* 关联资源 */}
            {task.resources.length > 0 && (
              <div className="space-y-2 ml-9">
                {task.resources.map(r => (
                  <a
                    key={r.id}
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors group"
                  >
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${platformColors[r.platform] || 'bg-gray-100 text-gray-500'}`}>
                      {r.platform}
                    </span>
                    <span className="flex-1 text-sm text-gray-700 truncate group-hover:text-[#f97066]">
                      {r.title}
                    </span>
                    {r.duration && (
                      <span className="text-[11px] text-gray-400">{formatDuration(r.duration)}</span>
                    )}
                    <ExternalLink size={12} className="text-gray-300 group-hover:text-[#f97066] shrink-0" />
                  </a>
                ))}
              </div>
            )}

            {/* 无资源提示 */}
            {task.resources.length === 0 && (
              <div className="ml-9 text-xs text-gray-300">
                暂无推荐资源，点击节点查看详情
              </div>
            )}

            {/* 关键词标签 */}
            {task.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2 ml-9">
                {task.keywords.slice(0, 5).map(kw => (
                  <span key={kw} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
