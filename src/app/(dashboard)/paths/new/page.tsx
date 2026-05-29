'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';

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

  const [phases, setPhases] = useState<Phase[]>([]);
  const [expandedPhases, setExpandedPhases] = useState<Record<string, TreeNode[]>>({});
  const [expandingPhase, setExpandingPhase] = useState<string | null>(null);

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
      // DeepSeek 可能返回数字 id，统一转字符串
      const phases = (data.phases || []).map((p: Record<string, unknown>) => ({
        ...p,
        id: String(p.id),
      }));
      setPhases(phases);
      setStep('framework');
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExpandPhase = async (phaseId: string, phaseTitle: string) => {
    setExpandingPhase(phaseId);
    setError('');
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
      setExpandedPhases((prev) => ({ ...prev, [phaseId]: data.nodes || [] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '展开失败');
    } finally {
      setExpandingPhase(null);
    }
  };

  const handleSave = async () => {
    const tree = {
      domain,
      level,
      phases: phases.map((p) => ({
        ...p,
        children: expandedPhases[p.id] || [],
      })),
    };

    setError('');
    setLoading(true);
    try {
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
          <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</div>
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

            <button
              onClick={handleGenerateFramework}
              disabled={!domain.trim() || loading}
              className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading ? '生成中...' : '✨ 生成学习框架'}
            </button>
          </div>
        )}

        {/* Step 2: Framework Review */}
        {step === 'framework' && (
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold">学习框架</h2>
            <p className="text-sm text-gray-500">点击展开每个阶段的子节点</p>

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
                  {expandedPhases[phase.id] && (
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

                  {/* Expand button or loading */}
                  {!expandedPhases[phase.id] ? (
                    <button
                      onClick={() => handleExpandPhase(phase.id, phase.title)}
                      disabled={expandingPhase === phase.id}
                      className="mt-3 text-sm text-indigo-600 hover:text-indigo-500 font-medium"
                    >
                      {expandingPhase === phase.id ? '展开中...' : '+ 展开子节点'}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        const next = { ...expandedPhases };
                        delete next[phase.id];
                        setExpandedPhases(next);
                      }}
                      className="mt-3 text-sm text-gray-400 hover:text-gray-600"
                    >
                      收起
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setStep('intent')}
                className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                ← 重新生成
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex-1 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {loading ? '保存中...' : '💾 保存路径'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
