'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { ProgressBar } from '@/components/ui/progress-bar';
import UserProfileForm, { UserProfileData } from '@/components/path/user-profile-form';
import UserProfileViewer from '@/components/path/user-profile-viewer';

const PROVIDERS = [
  { id: 'deepseek', name: 'DeepSeek' },
  { id: 'mimo', name: 'MIMO' },
  { id: 'openai', name: 'GPT' },
  { id: 'openai-relay', name: 'GPT 中转站' },
] as const;

type Step = 'profile' | 'intent' | 'framework' | 'nodes' | 'ready';

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

  const [step, setStep] = useState<Step>('profile');
  const [domain, setDomain] = useState('');
  const [level, setLevel] = useState<'零基础' | '有基础' | '进阶'>('零基础');
  const [goal, setGoal] = useState('');
  const [hoursPerWeek, setHoursPerWeek] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [provider, setProvider] = useState('deepseek');
  const [configuredProviders, setConfiguredProviders] = useState<string[]>([]);

  // 用户画像相关状态
  const [userProfile, setUserProfile] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    if (token) {
      fetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.apiKeys) {
            const ids = d.apiKeys.map((k: { provider: string }) => k.provider);
            setConfiguredProviders(ids);
            // 如果当前 provider 没配置，自动切换到第一个已配置的
            if (ids.length > 0 && !ids.includes(provider)) {
              setProvider(ids[0]);
            }
          }
        })
        .catch(() => {});
    }
  }, [token]);

  const [publicTemplate, setPublicTemplate] = useState(false);
  const [phases, setPhases] = useState<Phase[]>([]);
  // expandedPhases = 节点数据缓存（展开后永久保留，不清除）
  const [expandedPhases, setExpandedPhases] = useState<Record<string, TreeNode[]>>({});
  // visibleExpanded = 当前展开可见的阶段 id 集合
  const [visibleExpanded, setVisibleExpanded] = useState<Set<string>>(new Set());
  // 支持多个并行展开的进度状态
  const [expandingPhases, setExpandingPhases] = useState<Set<string>>(new Set());
  const [nodeProgressMap, setNodeProgressMap] = useState<Record<string, { progress: number; status: string }>>({});
  const nodeProgressTimersRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

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

  const startNodeProgress = useCallback((phaseId: string) => {
    setNodeProgressMap(prev => ({ ...prev, [phaseId]: { progress: 0, status: '正在生成子节点...' } }));
    const steps = [
      { at: 600,  to: 25, status: '正在分析知识点...' },
      { at: 1200, to: 50, status: '正在规划学习顺序...' },
      { at: 2000, to: 75, status: '正在编写验收标准...' },
      { at: 2800, to: 90, status: '即将完成...' },
    ];
    const startTime = Date.now();
    nodeProgressTimersRef.current[phaseId] = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const step = steps.find(s => elapsed < s.at) ?? { to: 92, status: '正在整理结果...' };
      setNodeProgressMap(prev => ({ ...prev, [phaseId]: { progress: step.to, status: step.status } }));
    }, 200);
  }, []);

  const finishNodeProgress = useCallback((phaseId: string) => {
    if (nodeProgressTimersRef.current[phaseId]) {
      clearInterval(nodeProgressTimersRef.current[phaseId]);
      delete nodeProgressTimersRef.current[phaseId];
    }
    setNodeProgressMap(prev => ({ ...prev, [phaseId]: { progress: 100, status: '完成！' } }));
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400">加载中...</p>
      </div>
    );
  }

  // 生成用户画像
  const handleGenerateProfile = async (data: UserProfileData) => {
    if (!domain.trim()) {
      setError('请先填写学习领域');
      return;
    }

    setError('');
    setProfileLoading(true);
    try {
      const res = await fetch('/api/paths/generate/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          domain,
          ...data,
          provider,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || '生成画像失败');
      }
      const result = await res.json();
      setUserProfile(result.profile);
      setProfileData(data);
      // 根据问卷数据自动填充原有字段
      const levelMap: Record<string, '零基础' | '有基础' | '进阶'> = {
        zero: '零基础',
        beginner: '有基础',
        intermediate: '有基础',
        advanced: '进阶',
      };
      setLevel(levelMap[data.level] || '零基础');
      setHoursPerWeek(String(data.hoursPerWeek));
      const goalMap: Record<string, string> = {
        job: '找工作',
        exam: '考试/作业',
        project: '做项目',
        improve: '提升能力',
        understand: '了解原理',
      };
      setGoal(data.goalDetail || goalMap[data.goal] || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成画像失败');
    } finally {
      setProfileLoading(false);
    }
  };

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
          provider,
          userProfile: userProfile || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '生成失败');
      }
      const data = await res.json();
      // DeepSeek 可能返回数字 id，统一转字符串
      let phases: Phase[] = [];
      try {
        const raw = Array.isArray(data.phases) ? data.phases : [];
        phases = raw.map((p: Record<string, unknown>) => ({
          ...p,
          id: String(p.id ?? ''),
        })) as Phase[];
      } catch {
        setError('数据格式异常，请重试');
        setLoading(false);
        return;
      }
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

    setExpandingPhases(prev => new Set(prev).add(phaseId));
    setError('');
    startNodeProgress(phaseId);
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
          provider,
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
      finishNodeProgress(phaseId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '展开失败');
      finishNodeProgress(phaseId);
    } finally {
      setExpandingPhases(prev => {
        const next = new Set(prev);
        next.delete(phaseId);
        return next;
      });
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
                provider,
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
    <div>
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

        {/* Step 1: 用户画像问卷 */}
        {step === 'profile' && !userProfile && (
          <div>
            {/* 领域输入（先填写领域再开始问卷） */}
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
              <h2 className="text-lg font-semibold mb-4">你想学什么？</h2>

              {/* 模型选择 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">AI 模型</label>
                <div className="flex gap-2">
                  {PROVIDERS.map(p => {
                    const isConfigured = configuredProviders.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => setProvider(p.id)}
                        className={`px-3 py-1.5 rounded-full text-sm transition-colors relative ${
                          provider === p.id
                            ? 'bg-[#f97066] text-white'
                            : isConfigured
                              ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              : 'bg-gray-50 text-gray-400'
                        }`}
                      >
                        {p.name}
                        {isConfigured && provider !== p.id && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#10b981] rounded-full" />
                        )}
                      </button>
                    );
                  })}
                </div>
                {!configuredProviders.includes(provider) && (
                  <p className="text-xs text-amber-500 mt-1">
                    ⚠️ 该模型未配置 API Key，请先去<a href="/settings" className="underline ml-1">设置</a>页面配置
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">学习领域</label>
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="如：前端开发、Python、UI 设计"
                  className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#f97066] focus:ring-1 focus:ring-[#f97066]"
                />
              </div>
            </div>

            {/* 用户画像问卷 */}
            {domain.trim() && (
              <UserProfileForm
                domain={domain}
                onSubmit={handleGenerateProfile}
                onBack={() => router.push('/')}
                loading={profileLoading}
              />
            )}

            {/* 画像生成中的进度提示 */}
            {profileLoading && (
              <div className="bg-white rounded-2xl shadow-sm p-6 mt-4">
                <ProgressBar progress={50} status="AI 正在分析你的信息，生成个性化画像..." />
              </div>
            )}
          </div>
        )}

        {/* Step 1.5: 展示用户画像 */}
        {step === 'profile' && userProfile && (
          <UserProfileViewer
            profile={userProfile}
            onConfirm={() => setStep('intent')}
            onBack={() => setUserProfile(null)}
            loading={false}
          />
        )}

        {/* Step 2: Intent */}
        {step === 'intent' && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold">你想学什么？</h2>

            {/* 模型选择 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">AI 模型</label>
              <div className="flex gap-2">
                {PROVIDERS.map(p => {
                  const isConfigured = configuredProviders.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => setProvider(p.id)}
                      className={`px-3 py-1.5 rounded-full text-sm transition-colors relative ${
                        provider === p.id
                          ? 'bg-[#f97066] text-white'
                          : isConfigured
                            ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            : 'bg-gray-50 text-gray-400'
                      }`}
                    >
                      {p.name}
                      {isConfigured && provider !== p.id && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#10b981] rounded-full" />
                      )}
                    </button>
                  );
                })}
              </div>
              {!configuredProviders.includes(provider) && (
                <p className="text-xs text-amber-500 mt-1">
                  ⚠️ 该模型未配置 API Key，请先去<a href="/settings" className="underline ml-1">设置</a>页面配置
                </p>
              )}
            </div>

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
                        ? 'bg-[#f97066] text-white'
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
              <div className="bg-[#fef4f3] rounded-lg p-4">
                <ProgressBar progress={progress} status={progressStatus} />
              </div>
            )}

            <button
              onClick={handleGenerateFramework}
              disabled={!domain.trim() || loading}
              className="w-full rounded-md bg-[#f97066] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e0524a] disabled:opacity-50"
            >
              {loading ? '⏳ AI 正在生成学习路径...' : '✨ 生成学习框架'}
            </button>
          </div>
        )}

        {/* Step 2: Framework Review */}
        {step === 'framework' && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold">学习框架</h2>
            <p className="text-sm text-gray-500">
              点击展开每个阶段的子节点
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
                        <span className={`text-xs px-2 py-0.5 rounded ${phase.is_required ? 'bg-[#fde8e6] text-[#e0524a]' : 'bg-gray-100 text-gray-500'}`}>
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
                    <div className="mt-3 ml-4 border-l-2 border-[#fde8e6] pl-4 space-y-2">
                      {expandedPhases[phase.id].map((node) => (
                        <div key={node.id} className="text-sm">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              node.node_type === 'required' ? 'bg-[#fef4f3] text-[#f97066]' :
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
                  {expandingPhases.has(phase.id) && nodeProgressMap[phase.id] && (
                    <div className="mt-3 bg-[#fef4f3] rounded-lg p-3">
                      <ProgressBar progress={nodeProgressMap[phase.id].progress} status={nodeProgressMap[phase.id].status} />
                    </div>
                  )}

                  {/* Expand button or collapse */}
                  {!visibleExpanded.has(phase.id) ? (
                    <button
                      onClick={() => handleExpandPhase(phase.id, phase.title)}
                      disabled={expandingPhases.has(phase.id) || loading}
                      className="mt-3 text-sm text-[#f97066] hover:text-[#e0524a] font-medium disabled:opacity-50"
                    >
                      {expandingPhases.has(phase.id)
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
              <div className="bg-[#fef4f3] rounded-lg p-4">
                <ProgressBar progress={progress} status={progressStatus} />
              </div>
            )}

            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={publicTemplate} onChange={e => setPublicTemplate(e.target.checked)}
                className="rounded border-gray-300 text-[#f97066] focus:ring-indigo-500" />
              公开为模板（其他人可以在广场 Fork）
            </label>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setStep('intent')}
                disabled={loading}
                className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                ← 返回
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex-1 rounded-md bg-[#f97066] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e0524a] disabled:opacity-50"
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
