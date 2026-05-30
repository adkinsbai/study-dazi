'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { ProgressBar } from '@/components/ui/progress-bar';

type Step = 'intent' | 'framework' | 'nodes' | 'ready';

interface Phase {
  id: string;
  title: string;
  description: string;
  estimated_hours: number;
  is_required: boolean;
  why: string;
}

interface TreeNode {
  id: string;
  title: string;
  description: string;
  estimated_hours: number;
  node_type: 'required' | 'optional' | 'advanced';
  resources_hint: string;
  check_criteria: string;
}

export default function NewPathPage() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const router = useRouter();

  const [step, setStep] = useState<Step>('intent');
  const [domain, setDomain] = useState('');
  const [level, setLevel] = useState<'零基础' | '有基础' | '进阶'>('零基础');
  const [goal, setGoal] = useState('');
  const [hoursPerWeek, setHoursPerWeek] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [publicTemplate, setPublicTemplate] = useState(false);
  const [phases, setPhases] = useState<Phase[]>([]);
  // expandedPhases = 节点数据缓存（展开后永久保留，不清除）
  const [expandedPhases, setExpandedPhases] = useState<Record<string, TreeNode[]>>({});
  // visibleExpanded = 当前展开可见的阶段 id 集合
  const [visibleExpanded, setVisibleExpanded] = useState<Set<string>>(new Set());
  const [expandingPhase, setExpandingPhase] = useState<string | null>(null);

  // 节点展开进度条
  const [nodeProgress, setNodeProgress] = useState(0);
  const [nodeProgressStatus, setNodeProgressStatus] = useState('');
  const nodeProgressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 进度条状态
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startProgress = useCallback(() => {
    setProgress(0);
    setProgressStatus('正在连接 AI...');
    
    // 模拟进度：AI 生成通常需要 4-8 秒
    const steps = [
      { at: 800,  to: 15, status: '正在分析学习领域...' },
      { at: 1600, to: 30, status: '正在设计课程框架...' },
      { at: 2500, to: 50, status: '正在规划学习阶段...' },
      { at: 3500, to: 65, status: '正在估算学习时长...' },
      { at: 4500, to: 78, status: '正在优化阶段排序...' },
      { at: 5500, to: 88, status: '即将完成...' },
    ];

    const startTime = Date.now();
    progressTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const step = steps.find(s => elapsed < s.at) ?? { to: 92, status: '正在整理结果...' };
      setProgress(step.to);
      setProgressStatus(step.status);
    }, 200);
  }, []);

  const finishProgress = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setProgress(100);
    setProgressStatus('完成！');
  }, []);

  const startNodeProgress = useCallback(() => {
    setNodeProgress(0);
    setNodeProgressStatus('正在生成子节点...');
    const steps = [
      { at: 600,  to: 25, status: '正在分析知识点...' },
      { at: 1200, to: 50, status: '正在规划学习顺序...' },
      { at: 2000, to: 75, status: '正在编写验收标准...' },
      { at: 2800, to: 90, status: '即将完成...' },
    ];
    const startTime = Date.now();
    nodeProgressTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const step = steps.find(s => elapsed < s.at) ?? { to: 92, status: '正在整理结果...' };
      setNodeProgress(step.to);
      setNodeProgressStatus(step.status);
    }, 200);
  }, []);

  const finishNodeProgress = useCallback(() => {
    if (nodeProgressTimerRef.current) {
      clearInterval(nodeProgressTimerRef.current);
      nodeProgressTimerRef.current = null;
    }
    setNodeProgress(100);
    setNodeProgressStatus('完成！');
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400">加载中...</p>
      </div>
    );
  }

  const handleGenerateFramework = async () => {
    setError('');
    setLoading(true);
    // 重新生成时清空节点缓存
    setExpandedPhases({});
    setVisibleExpanded(new Set());
    startProgress();
    try {
      const res = await fetch('/api/paths/generate/framework', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          domain,
          level,
          goal: goal || undefined,
          hours_per_week: hoursPerWeek ? parseInt(hoursPerWeek) : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '生成失败');
      }
      const data = await res.json();
      console.log('[NewPath] API response keys:', Object.keys(data));
      console.log('[NewPath] data.phases type:', typeof data.phases, Array.isArray(data.phases));
      // DeepSeek 可能返回数字 id，统一转字符串
      let phases: Phase[] = [];
      try {
        const raw = Array.isArray(data.phases) ? data.phases : [];
        console.log('[NewPath] raw phases count:', raw.length);
        phases = raw.map((p: Record<string, unknown>) => ({
          ...p,
          id: String(p.id ?? ''),
        })) as Phase[];
      } catch (mapErr) {
        console.error('[NewPath] phases mapping error:', mapErr);
        setError('数据格式异常，请重试');
        setLoading(false);
        return;
      }
      console.log('[NewPath] setting phases:', phases.length, 'step: framework');
      setPhases(phases);
      setStep('framework');
      finishProgress();
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
      finishProgress();
    } finally {
      setLoading(false);
    }
  };

  const handleExpandPhase = async (phaseId: string, phaseTitle: string) => {
    // 缓存命中：直接展开，无需请求
    if (expandedPhases[phaseId]) {
      setVisibleExpanded((prev) => new Set(prev).add(phaseId));
      return;
    }

    setExpandingPhase(phaseId);
    setError('');
    startNodeProgress();
    try {
      const res = await fetch('/api/paths/generate/nodes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          domain,
          phases_json: JSON.stringify(phases),
          phase_id: phaseId,
          phase_title: phaseTitle,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '展开失败');
      }
      const data = await res.json();
      // 写入缓存 + 设为可见
      setExpandedPhases((prev) => ({ ...prev, [phaseId]: data.nodes || [] }));
      setVisibleExpanded((prev) => new Set(prev).add(phaseId));
      finishNodeProgress();
    } catch (err) {
      setError(err instanceof Error ? err.message : '展开失败');
      finishNodeProgress();
    } finally {
      setExpandingPhase(null);
    }
  };

  const handleSave = async () => {
    setError('');
    setLoading(true);

    try {
      // 1. 收集已缓存的子节点，找出未展开的阶段
      const allChildren: Record<string, TreeNode[]> = { ...expandedPhases };
      const unexpanded = phases.filter((p) => !allChildren[p.id]);
      const total = phases.length;
      let completed = total - unexpanded.length;

      // 2. 自动为所有未展开阶段生成子节点
      if (unexpanded.length > 0) {
        for (const phase of unexpanded) {
          setProgress(Math.round((completed / total) * 100));
          setProgressStatus(`正在生成「${phase.title}」的子节点 (${completed + 1}/${total})`);

          try {
            const res = await fetch('/api/paths/generate/nodes', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                domain,
                phases_json: JSON.stringify(phases),
                phase_id: phase.id,
                phase_title: phase.title,
              }),
            });
            if (res.ok) {
              const data = await res.json();
              allChildren[phase.id] = data.nodes || [];
            }
          } catch {
            // 单个阶段失败不阻塞整体保存
          }
          completed++;
        }
      }

      // 3. 构建完整树
      const tree = {
        domain,
        level,
        phases: phases.map((p) => ({
          ...p,
          children: allChildren[p.id] || [],
        })),
      };

      setProgress(100);
      setProgressStatus('正在保存路径...');

      // 4. 保存
      const res = await fetch('/api/paths', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: `${domain}学习路径`,
          domain,
          tree_data: tree,
          isPublic: publicTemplate,
          isTemplate: publicTemplate,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '保存失败');
      }
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">生成学习路径</h1>
          <button onClick={() => router.push('/')} className="text-sm text-gray-500 hover:text-gray-700">
            返回
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <span className="text-red-500 text-lg shrink-0">⚠️</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-800">生成失败</p>
              <p className="text-sm text-red-600 mt-0.5 break-words">{error}</p>
            </div>
            <button
              onClick={() => setError('')}
              className="text-red-400 hover:text-red-600 text-sm shrink-0"
            >
              ✕
            </button>
          </div>
        )}

        {/* Step 1: Intent */}
        {step === 'intent' && (
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold">你想学什么？</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700">领域</label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="如：前端开发、Python、UI 设计"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">当前水平</label>
              <div className="mt-1 flex gap-2">
                {(['零基础', '有基础', '进阶'] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLevel(l)}
                    className={`px-4 py-2 rounded-md text-sm font-medium ${
                      level === l
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">目标（可选）</label>
              <input
                type="text"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="如：转行找工作、做副业"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">每周可投入（小时，可选）</label>
              <input
                type="number"
                value={hoursPerWeek}
                onChange={(e) => setHoursPerWeek(e.target.value)}
                placeholder="如：15"
                className="mt-1 block w-32 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {loading && (
              <div className="bg-indigo-50 rounded-lg p-4">
                <ProgressBar progress={progress} status={progressStatus} />
              </div>
            )}

            <button
              onClick={handleGenerateFramework}
              disabled={!domain.trim() || loading}
              className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading ? '⏳ AI 正在生成学习路径...' : '✨ 生成学习框架'}
            </button>
          </div>
        )}

        {/* Step 2: Framework Review */}
        {step === 'framework' && (
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded px-3 py-1.5 text-xs text-yellow-700 font-mono">
              DEBUG: step={step} | phases.length={phases.length} | loading={String(loading)} | error={error ? 'YES' : 'none'}
            </div>
            <h2 className="text-lg font-semibold">学习框架</h2>
            <p className="text-sm text-gray-500">
              点击展开每个阶段的子节点
              <span className="ml-2 text-xs text-gray-300">({phases.length} 个阶段, step={step})</span>
            </p>

            {phases.length === 0 && !loading && (
              <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                <p className="text-gray-400 text-sm">未生成任何阶段</p>
                <p className="text-gray-400 text-xs mt-1">请返回上一步重新生成</p>
              </div>
            )}

            <div className="space-y-3">
              {phases.map((phase) => (
                <div key={phase.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${phase.is_required ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                          {phase.is_required ? '必修' : '可选'}
                        </span>
                        <h3 className="font-medium">{phase.title}</h3>
                        <span className="text-xs text-gray-400">~{phase.estimated_hours}h</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{phase.description}</p>
                      <p className="text-xs text-gray-400 mt-1">{phase.why}</p>
                    </div>
                  </div>

                  {/* Expanded children */}
                  {visibleExpanded.has(phase.id) && expandedPhases[phase.id] && (
                    <div className="mt-3 ml-4 border-l-2 border-indigo-100 pl-4 space-y-2">
                      {expandedPhases[phase.id].map((node) => (
                        <div key={node.id} className="text-sm">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              node.node_type === 'required' ? 'bg-indigo-50 text-indigo-600' :
                              node.node_type === 'optional' ? 'bg-amber-50 text-amber-600' :
                              'bg-purple-50 text-purple-600'
                            }`}>
                              {node.node_type === 'required' ? '必修' : node.node_type === 'optional' ? '可选' : '进阶'}
                            </span>
                            <span className="font-medium">{node.title}</span>
                            <span className="text-gray-400">~{node.estimated_hours}h</span>
                          </div>
                          <p className="text-gray-500 mt-0.5">{node.description}</p>
                          <p className="text-gray-400 text-xs mt-0.5">✅ {node.check_criteria}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 展开中进度条 */}
                  {expandingPhase === phase.id && (
                    <div className="mt-3 bg-indigo-50 rounded-lg p-3">
                      <ProgressBar progress={nodeProgress} status={nodeProgressStatus} />
                    </div>
                  )}

                  {/* Expand button or collapse */}
                  {!visibleExpanded.has(phase.id) ? (
                    <button
                      onClick={() => handleExpandPhase(phase.id, phase.title)}
                      disabled={expandingPhase === phase.id || loading}
                      className="mt-3 text-sm text-indigo-600 hover:text-indigo-500 font-medium disabled:opacity-50"
                    >
                      {expandingPhase === phase.id
                        ? '⏳ AI 正在生成子节点...'
                        : '+ 展开子节点'}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setVisibleExpanded((prev) => {
                          const next = new Set(prev);
                          next.delete(phase.id);
                          return next;
                        });
                      }}
                      className="mt-3 text-sm text-gray-400 hover:text-gray-600"
                    >
                      收起
                    </button>
                  )}
                </div>
              ))}
            </div>

            {loading && (
              <div className="bg-indigo-50 rounded-lg p-4">
                <ProgressBar progress={progress} status={progressStatus} />
              </div>
            )}

            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={publicTemplate} onChange={e => setPublicTemplate(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
              公开为模板（其他人可以在广场 Fork）
            </label>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setStep('intent')}
                disabled={loading}
                className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                ← 重新生成
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex-1 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {loading ? '⏳ 正在生成并保存...' : '💾 保存路径'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
